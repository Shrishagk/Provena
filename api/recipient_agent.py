"""Recipient-local decryption agent for the browser control plane.

Run this process on the recipient's device, pointing it at a directory that
only that recipient controls. The gateway never receives the ML-KEM or ML-DSA
private keys. The agent deliberately binds to loopback by default.
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from localdeps import ensure_local_dependencies

ensure_local_dependencies()

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from crypto.envelope import decrypt_document
from crypto.pqc import sign
from identity.keyring import b64, canonical_json, unb64
from ledger.client import DEFAULT_NODES, append_quorum
from watermark.zero_width import embed


def _error(status: int, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail=message)


def _origins() -> list[str]:
    return [value.strip() for value in os.environ.get(
        "RECIPIENT_AGENT_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if value.strip()]


def create_app(recipient_id: str, key_dir: Path, artifact_dir: Path, nodes: list[str]) -> FastAPI:
    """Create a loopback-only API bound to one recipient identity."""
    gateway_key_dir = Path(__file__).resolve().parents[1] / "keys"
    if key_dir.resolve() == gateway_key_dir.resolve():
        raise ValueError("recipient agent refuses the gateway key directory; use a recipient-controlled vault")
    private_path = key_dir / f"{recipient_id}.private.json"
    if not private_path.is_file():
        raise FileNotFoundError(f"recipient private key not found: {private_path}")
    private = json.loads(private_path.read_text(encoding="utf-8"))
    artifact_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title=f"Recipient decryption agent ({recipient_id})", version="1.0")
    app.add_middleware(CORSMiddleware, allow_origins=_origins(), allow_credentials=False,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    @app.get("/api/v1/identity")
    def identity() -> dict:
        return {"recipient_id": recipient_id, "key_custody": "recipient-local"}

    @app.post("/api/v1/decryptions")
    async def decrypt(envelope: UploadFile = File(...)) -> dict:
        try:
            package = json.loads((await envelope.read()).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise _error(422, "encrypted package is not valid JSON") from exc
        try:
            plaintext = decrypt_document(package, recipient_id, unb64(private["kem_secret_key"])).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise _error(422, "prototype watermarking supports UTF-8 text documents only") from exc
        except (KeyError, ValueError) as exc:
            # This intentionally covers both a malformed/tampered envelope and
            # one made for a previous recipient key.  Neither case is safe to
            # decrypt; naming the common key-reset case tells the operator how
            # to recover without suggesting that authentication can be bypassed.
            raise _error(
                422,
                "encrypted package cannot be authenticated for this recipient. "
                "It may be damaged, or it was created before this recipient's keys were regenerated; "
                "create a new package and try again.",
            ) from exc

        token = os.urandom(16)
        record = {
            "doc_hash": package["ciphertext_sha256"],
            "recipient_id": recipient_id,
            "watermark_session_id": token.hex(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        signature = b64(sign(unb64(private["sign_secret_key"]), canonical_json(record)))
        try:
            committed = append_quorum(record, signature, nodes)
        except RuntimeError as exc:
            raise _error(503, f"ledger quorum unavailable: {exc}") from exc

        artifact_id = uuid.uuid4().hex
        output = artifact_dir / f"{artifact_id}.txt"
        output.write_text(embed(plaintext, token), encoding="utf-8")
        return {
            "watermarked_copy_url": f"/api/v1/download/{artifact_id}",
            "watermark_session_id": token.hex(),
            "ledger_entry_hash": committed["entry"]["entry_hash"],
            "committed_nodes": committed["committed_nodes"],
            "assurance": "recipient-local-key-custody",
        }

    @app.get("/api/v1/download/{artifact_id}")
    def download(artifact_id: str):
        if not artifact_id.isalnum() or len(artifact_id) != 32:
            raise _error(404, "artifact not found")
        path = artifact_dir / f"{artifact_id}.txt"
        if not path.is_file():
            raise _error(404, "artifact not found")
        return FileResponse(path, media_type="text/plain; charset=utf-8", filename=path.name)

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a recipient-local forensic decryption agent")
    parser.add_argument("--recipient", required=True, help="identity whose private key this agent may use")
    parser.add_argument("--key-dir", required=True, help="recipient-controlled directory containing private key JSON")
    parser.add_argument("--artifact-dir", help="local output directory; defaults beneath --key-dir")
    parser.add_argument("--nodes", nargs="*", default=DEFAULT_NODES, help="ledger replica URLs")
    parser.add_argument("--host", default="127.0.0.1", help="keep loopback unless a protected LAN deployment requires otherwise")
    parser.add_argument("--port", type=int, default=8081)
    args = parser.parse_args()
    key_dir = Path(args.key_dir).resolve()
    artifact_dir = Path(args.artifact_dir).resolve() if args.artifact_dir else key_dir / "forensic-artifacts"
    import uvicorn
    uvicorn.run(create_app(args.recipient, key_dir, artifact_dir, args.nodes), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
