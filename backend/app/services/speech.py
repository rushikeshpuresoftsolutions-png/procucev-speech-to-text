import os
from functools import lru_cache
from threading import Lock

import numpy as np
from faster_whisper import WhisperModel

RATE = 16000
STEP = 4 * RATE
OVERLAP = 2 * RATE
inference_lock = Lock()


@lru_cache(maxsize=1)
def model():
    return WhisperModel(os.getenv("WHISPER_MODEL", "small"),
                        device=os.getenv("WHISPER_DEVICE", "cpu"),
                        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
                        cpu_threads=int(os.getenv("WHISPER_THREADS", "2")))


def recognize(pcm, language):
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
    with inference_lock:
        segments, info = model().transcribe(
            samples, language=language if language in ("hi", "en") else None,
            task="transcribe", multilingual=language in ("auto", "mixed"),
            beam_size=int(os.getenv("WHISPER_BEAM_SIZE", "2")), word_timestamps=True,
            vad_filter=True, vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
        )
        words = [(w.start, w.end, w.word) for segment in segments for w in segment.words or []]
        return words, info.language


class Window:
    """Keep acoustic context on both sides of the commit boundary."""
    def __init__(self):
        self.audio = bytearray()
        self.start = 0
        self.committed_until = 0.0
        self.sequence = 0

    def apply(self, words, final=False):
        end = self.start + len(self.audio) // 2
        horizon = end if final else end - OVERLAP
        stable, provisional = [], []
        latest_word = self.committed_until
        for left, right, token in words:
            midpoint = self.start + (left + right) * RATE / 2
            if midpoint <= self.committed_until:
                continue
            if final or self.start + right * RATE <= horizon:
                stable.append(token)
                latest_word = self.start + right * RATE
            else:
                provisional.append(token)
        # Preserve any word straddling the boundary for the next inference.
        boundary = latest_word if provisional else max(latest_word, horizon)
        self.committed_until = max(self.committed_until, boundary)
        # A full extra second of left context accommodates timestamp jitter.
        trim_to = max(self.start, min(int(self.committed_until) - RATE, end - 3 * RATE))
        # Bound memory even for long stretches with no recognizable words.
        trim_to = max(trim_to, end - 12 * RATE)
        del self.audio[:2 * (trim_to - self.start)]
        self.start = trim_to
        self.sequence += 1
        return "".join(stable).strip(), "".join(provisional).strip()
