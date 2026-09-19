"""Zero-width Unicode watermark with a magic header, checksum, and repetition."""
from __future__ import annotations
import hashlib

ZERO = "\u200b"
ONE = "\u200c"
MAGIC = b"WM1!"
TOKEN_BYTES = 16
COPIES = 3


def _bits(data: bytes) -> str:
    return "".join(f"{byte:08b}" for byte in data)


def _bytes(bits: str) -> bytes:
    return bytes(int(bits[index:index + 8], 2) for index in range(0, len(bits), 8))


def _frame(token: bytes) -> str:
    if len(token) != TOKEN_BYTES:
        raise ValueError("watermark token must be 128 bits")
    raw = MAGIC + token + hashlib.sha256(token).digest()[:4]
    return _bits(raw)


def embed(text: str, token: bytes) -> str:
    """Append invisible code points; rendered text remains exactly the same."""
    bits = _frame(token) * COPIES
    return text + "".join(ZERO if bit == "0" else ONE for bit in bits)


def extract(text: str) -> str | None:
    encoded = "".join("0" if char == ZERO else "1" for char in text if char in (ZERO, ONE))
    frame_len = len(_frame(b"\0" * TOKEN_BYTES))
    candidates: list[bytes] = []
    for offset in range(0, max(0, len(encoded) - frame_len + 1), 8):
        raw = _bytes(encoded[offset:offset + frame_len])
        if raw[:4] == MAGIC and hashlib.sha256(raw[4:20]).digest()[:4] == raw[20:24]:
            candidates.append(raw[4:20])
    if not candidates:
        return None
    # Need two matching frames (or three); a single accidental frame is rejected.
    for candidate in candidates:
        if sum(item == candidate for item in candidates) >= 2:
            return candidate.hex()
    return None
