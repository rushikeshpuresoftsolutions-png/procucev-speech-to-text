import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import origins
from ..services.speech import RATE, STEP, Window, recognize

router = APIRouter()
logger = logging.getLogger(__name__)
worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="whisper")
slots = asyncio.Semaphore(2)
formats = {"audio/webm": "matroska", "audio/ogg": "ogg", "audio/mp4": "mov"}


class StreamError(ValueError):
    pass


async def receive_audio(ws, decoder):
    size = 0
    while True:
        message = await asyncio.wait_for(ws.receive(), 30)
        if message["type"] == "websocket.disconnect":
            raise WebSocketDisconnect()
        if message.get("text") is not None:
            if json.loads(message["text"]) != {"type": "stop"}:
                raise StreamError("Expected audio or a stop message.")
            if not size:
                raise StreamError("The recording was empty.")
            decoder.stdin.close()
            return
        chunk = message.get("bytes")
        if not chunk or len(chunk) > 512_000:
            raise StreamError("Empty or oversized audio chunk.")
        size += len(chunk)
        if size > 48_000_000:
            raise StreamError("Recording size limit reached.")
        decoder.stdin.write(chunk)
        await decoder.stdin.drain()


async def transcribe_audio(ws, decoder, language):
    window = Window()
    total = 0
    while True:
        final = False
        try:
            audio = await decoder.stdout.readexactly(2 * STEP)
        except asyncio.IncompleteReadError as end:
            audio, final = end.partial, True
        total += len(audio)
        if total > 2 * RATE * 1800:
            raise StreamError("Recordings are limited to 30 minutes.")
        window.audio.extend(audio)
        if final and (await decoder.wait() or not total):
            raise StreamError("The audio stream could not be decoded.")
        if window.audio:
            loop = asyncio.get_running_loop()
            words, detected = await loop.run_in_executor(worker, recognize, bytes(window.audio), language)
            stable, partial = window.apply(words, final)
            if stable:
                await ws.send_json({"type": "final", "id": window.sequence, "text": stable,
                                    "language": detected})
            await ws.send_json({"type": "partial", "id": window.sequence, "text": partial})
        if final:
            await ws.send_json({"type": "status", "state": "complete", "duration": total / (2 * RATE)})
            return


async def session(ws):
    first = await asyncio.wait_for(ws.receive(), 20)
    if first["type"] == "websocket.disconnect":
        raise WebSocketDisconnect()
    config = json.loads(first.get("text") or "{}")
    if not isinstance(config, dict) or config.get("type") != "start":
        raise StreamError("Send a start message before audio.")
    mime = str(config.get("mime", "")).split(";")[0]
    language = config.get("language", "auto")
    if mime not in formats or language not in ("hi", "en", "mixed", "auto"):
        raise StreamError("Unsupported recording format or language.")
    decoder = await asyncio.create_subprocess_exec(
        "ffmpeg", "-nostdin", "-loglevel", "error", "-protocol_whitelist", "pipe",
        "-f", formats[mime], "-probesize", "32768", "-analyzeduration", "0", "-i", "pipe:0",
        "-vn", "-ac", "1", "-ar", str(RATE), "-f", "s16le", "pipe:1",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
    )
    tasks = []
    try:
        await ws.send_json({"type": "status", "state": "ready"})
        tasks = [asyncio.create_task(receive_audio(ws, decoder)),
                 asyncio.create_task(transcribe_audio(ws, decoder, language))]
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if decoder.returncode is None:
            with suppress(ProcessLookupError):
                decoder.kill()
        await decoder.communicate()


@router.websocket("/ws/transcribe")
async def live(ws: WebSocket):
    origin = ws.headers.get("origin")
    if origin and origin.rstrip("/") not in origins:
        await ws.close(code=1008)
        return
    await ws.accept()
    if slots.locked():
        await ws.send_json({"type": "error", "message": "Studio is busy. Please retry shortly."})
        await ws.close(code=1013)
        return
    async with slots:
        try:
            await asyncio.wait_for(session(ws), timeout=2100)
        except WebSocketDisconnect:
            return
        except (StreamError, ValueError, TimeoutError, BrokenPipeError, ConnectionResetError) as exc:
            message = str(exc) if isinstance(exc, StreamError) else "Invalid audio, invalid control message, or session timeout."
            await ws.send_json({"type": "error", "message": message})
        except Exception:
            logger.exception("Speech processing failed")
            await ws.send_json({"type": "error", "message": "Speech engine unavailable. Check model access and retry."})
        finally:
            with suppress(RuntimeError, WebSocketDisconnect):
                await ws.close()
