"""Send a real encoded recording through the same WebSocket as MediaRecorder."""
import argparse
import asyncio
import json
from pathlib import Path

from websockets.asyncio.client import connect


async def run(args):
    async with connect(args.url, open_timeout=15, max_size=1_000_000) as ws:
        await ws.send(json.dumps({"type": "start", "mime": "audio/webm", "language": args.language}))
        ready = json.loads(await ws.recv())
        assert ready.get("state") == "ready", ready
        with Path(args.audio).open("rb") as file:
            while chunk := file.read(3000):
                await ws.send(chunk)
                await asyncio.sleep(0.04)
        await ws.send(json.dumps({"type": "stop"}))
        final, ids, partials = [], set(), 0
        async for raw in ws:
            event = json.loads(raw)
            if event["type"] == "error":
                raise RuntimeError(event["message"])
            if event["type"] == "partial":
                partials += 1
            if event["type"] == "final":
                assert event["id"] not in ids
                ids.add(event["id"])
                final.append(event["text"])
            if event.get("state") == "complete":
                assert final and partials and event["duration"] > 0
                print(f"{args.language} ({event['duration']:.1f}s, {len(final)} final updates):", " ".join(final))
                return
        raise RuntimeError("Stream closed before completion")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio")
    parser.add_argument("language", choices=["en", "hi", "mixed", "auto"])
    parser.add_argument("--url", default="ws://localhost:5173/ws/transcribe")
    asyncio.run(asyncio.wait_for(run(parser.parse_args()), 240))
