"""One-ciphertext, many-recipient ML-KEM/AES-256-GCM envelope."""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from crypto.pqc import kem_encapsulate, kem_decapsulate


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), validate=True)


def _wrap_key(shared_secret: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None,
                info=b"pq-forensic-envelope-v1").derive(shared_secret)


def encrypt_document(document: bytes, recipient_kem_keys: dict[str, bytes]) -> dict:
    if not recipient_kem_keys:
        raise ValueError("at least one recipient is required")
    content_key, content_nonce = os.urandom(32), os.urandom(12)
    ciphertext = AESGCM(content_key).encrypt(content_nonce, document, b"pq-forensic-v1")
    recipients: dict[str, dict[str, str]] = {}
    for recipient_id, public_key in recipient_kem_keys.items():
        kem_ct, secret = kem_encapsulate(public_key)
        wrap_nonce = os.urandom(12)
        wrapped = AESGCM(_wrap_key(secret)).encrypt(wrap_nonce, content_key, recipient_id.encode())
        recipients[recipient_id] = {"kem_ciphertext": b64(kem_ct), "wrap_nonce": b64(wrap_nonce),
                                    "wrapped_content_key": b64(wrapped)}
    return {"format": "pq-forensic-envelope-v1", "cipher": "AES-256-GCM",
            "content_nonce": b64(content_nonce), "ciphertext": b64(ciphertext),
            "ciphertext_sha256": hashlib.sha256(ciphertext).hexdigest(), "recipients": recipients}


def decrypt_document(envelope: dict, recipient_id: str, kem_secret_key: bytes) -> bytes:
    try:
        recipient = envelope["recipients"][recipient_id]
        secret = kem_decapsulate(kem_secret_key, unb64(recipient["kem_ciphertext"]))
        content_key = AESGCM(_wrap_key(secret)).decrypt(unb64(recipient["wrap_nonce"]),
            unb64(recipient["wrapped_content_key"]), recipient_id.encode())
        return AESGCM(content_key).decrypt(unb64(envelope["content_nonce"]),
            unb64(envelope["ciphertext"]), b"pq-forensic-v1")
    except (KeyError, ValueError) as exc:
        raise ValueError("recipient is not authorized or envelope is malformed") from exc


def load_envelope(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_envelope(envelope: dict, path: str | Path) -> None:
    Path(path).write_text(json.dumps(envelope, sort_keys=True, indent=2), encoding="utf-8")
