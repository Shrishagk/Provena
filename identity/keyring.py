"""Signed, offline JSON keyring utilities."""
from __future__ import annotations
import base64
import json
from pathlib import Path
from crypto.pqc import verify


def canonical_json(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), validate=True)


def load_verified_keyring(path: str | Path, org_root_public_key: str | None = None) -> dict:
    keyring = json.loads(Path(path).read_text(encoding="utf-8"))
    root_pk = org_root_public_key or keyring.get("org_root_public_key")
    if not root_pk:
        raise ValueError("org root public key is required for keyring verification")
    signed = {"format": keyring["format"], "recipients": keyring["recipients"]}
    if not verify(unb64(root_pk), canonical_json(signed), unb64(keyring["signature"])):
        raise ValueError("keyring signature is invalid")
    return keyring
