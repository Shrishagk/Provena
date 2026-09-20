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


def load_root_public_key(path: str | Path) -> bytes:
    """Load the deployment-pinned organization root public key.

    This file is deliberately separate from the signed registries.  A public
    key bundled inside the document it verifies is not a trust anchor: a host
    administrator could replace both values together.
    """
    root = json.loads(Path(path).read_text(encoding="utf-8"))
    if root.get("algorithm") != "ML-DSA-65":
        raise ValueError("unsupported organization root key algorithm")
    return unb64(root["public_key"])


def load_verified_keyring(path: str | Path, root_public_key: bytes) -> dict:
    keyring = json.loads(Path(path).read_text(encoding="utf-8"))
    signed = {"format": keyring["format"], "recipients": keyring["recipients"]}
    if not verify(root_public_key, canonical_json(signed), unb64(keyring["signature"])):
        raise ValueError("keyring signature is invalid")
    return keyring


def load_verified_node_registry(path: str | Path, root_public_key: bytes) -> dict:
    """Load the root-signed ledger node registry and its deployment metadata."""
    registry = json.loads(Path(path).read_text(encoding="utf-8"))
    signed = {"format": registry["format"], "nodes": registry["nodes"]}
    if not verify(root_public_key, canonical_json(signed), unb64(registry["signature"])):
        raise ValueError("ledger node registry signature is invalid")
    return registry
