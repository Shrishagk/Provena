"""Local FastAPI gateway consumed by the Next.js control-plane UI.

This *demo* gateway loads recipient private keys from its local filesystem in
order to make the browser workflow runnable. A signature made through this
endpoint proves only that the gateway-held key signed the record; it does not
provide recipient non-repudiation. The recipient-side CLI is the supported
workflow when a recipient controls their own key material.
"""
from __future__ import annotations

import json
import os
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from localdeps import ensure_local_dependencies
ensure_local_dependencies()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from crypto.envelope import decrypt_document, encrypt_document
from crypto.pqc import sign, verify
from identity.keyring import b64, canonical_json, load_verified_keyring, unb64
from ledger.client import DEFAULT_NODES, append_quorum, lookup_all, verify_all
from watermark.zero_width import embed, extract

BASE = Path(os.environ.get("FORENSIC_BASE_DIR", Path(__file__).resolve().parents[1])).resolve()
KEYS = BASE / "keys"
ARTIFACTS = BASE / "data" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NODE_IDS = ("node1", "node2", "node3")
TRUST_BOUNDARY = {
    "mode": "gateway-custody-demo",
    "recipient_private_keys": "loaded by the gateway from its local filesystem",
    "recipient_non_repudiation": False,
    "replica_deployment": "three local services on one host by default",
    "independent_administration": False,
}

app = FastAPI(title="Offline Forensic Watermarking Gateway", version="1.0")
origins = [item.strip() for item in os.environ.get(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


def _http_error(status: int, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail=message)


async def _read_text(upload: UploadFile, label: str) -> str:
    try:
        return (await upload.read()).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise _http_error(422, f"{label} must be a UTF-8 text file") from exc


async def _read_envelope(upload: UploadFile) -> dict:
    try:
        return json.loads((await upload.read()).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise _http_error(422, "encrypted package is not valid JSON") from exc


def _artifact_path(suffix: str) -> tuple[str, Path]:
    artifact_id = uuid.uuid4().hex
    return artifact_id, ARTIFACTS / f"{artifact_id}{suffix}"


def _load_private(recipient_id: str) -> dict:
    path = KEYS / f"{recipient_id}.private.json"
    if not path.is_file():
        raise _http_error(404, "unknown recipient identity")
    return json.loads(path.read_text(encoding="utf-8"))


def _ledger_status() -> dict:
    replies = {result["node_id"]: result for _, result in verify_all()}
    replicas = [{"node_id": node_id, "online": node_id in replies, **replies.get(node_id, {})} for node_id in NODE_IDS]
    valid_tips = [item["tip"] for item in replicas if item.get("online") and item.get("valid")]
    counts = Counter(valid_tips)
    quorum = bool(counts and counts.most_common(1)[0][1] >= 2)
    return {"quorum_agreement": quorum, "replicas": replicas}


@app.get("/api/v1/health")
def health() -> dict:
    return {"service": "forensic-watermarking-gateway", "ledger": _ledger_status(), "trust_boundary": TRUST_BOUNDARY}


@app.get("/api/v1/system/trust-boundary")
def trust_boundary() -> dict:
    """Return explicit, machine-readable demo assurance limits for the UI."""
    return TRUST_BOUNDARY


@app.get("/api/v1/recipients")
def recipients() -> dict:
    keyring = load_verified_keyring(KEYS / "keyring.json")
    return {"recipients": [{"id": recipient_id, "display_name": recipient_id.replace("_", " ").title()}
                           for recipient_id in keyring["recipients"]]}


@app.post("/api/v1/documents/encrypt")
async def encrypt(document: UploadFile = File(...), recipients: str = Form(...)) -> dict:
    text = await _read_text(document, "document")
    try:
        selected = json.loads(recipients)
    except json.JSONDecodeError as exc:
        raise _http_error(422, "recipients must be a JSON array") from exc
    if not isinstance(selected, list) or not selected or not all(isinstance(value, str) for value in selected):
        raise _http_error(422, "select at least one recipient")
    keyring = load_verified_keyring(KEYS / "keyring.json")
    if len(set(selected)) != len(selected) or any(value not in keyring["recipients"] for value in selected):
        raise _http_error(422, "recipient selection contains an unknown identity")
    public_keys = {recipient_id: unb64(keyring["recipients"][recipient_id]["kem_public_key"]) for recipient_id in selected}
    envelope = encrypt_document(text.encode("utf-8"), public_keys)
    artifact_id, output = _artifact_path(".pqe.json")
    output.write_text(json.dumps(envelope, indent=2, sort_keys=True), encoding="utf-8")
    return {"envelope_id": artifact_id, "ciphertext_sha256": envelope["ciphertext_sha256"],
            "recipient_count": len(selected), "download_url": f"/api/v1/download/{artifact_id}"}


@app.post("/api/v1/decryptions")
async def decrypt(envelope: UploadFile = File(...), recipient_id: str = Form(...)) -> dict:
    package = await _read_envelope(envelope)
    private = _load_private(recipient_id)
    try:
        plaintext = decrypt_document(package, recipient_id, unb64(private["kem_secret_key"])).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise _http_error(422, "prototype watermarking supports UTF-8 text documents only") from exc
    except ValueError as exc:
        raise _http_error(
            422,
            "encrypted package cannot be authenticated for this recipient; it may be corrupt or was created before recipient keys were regenerated. Encrypt the source document again.",
        ) from exc
    token = os.urandom(16)
    record = {"doc_hash": package["ciphertext_sha256"], "recipient_id": recipient_id,
              "watermark_session_id": token.hex(), "timestamp": datetime.now(timezone.utc).isoformat()}
    recipient_signature = b64(sign(unb64(private["sign_secret_key"]), canonical_json(record)))
    try:
        committed = append_quorum(record, recipient_signature)
    except RuntimeError as exc:
        raise _http_error(503, f"ledger quorum unavailable: {exc}") from exc
    artifact_id, output = _artifact_path(".txt")
    output.write_text(embed(plaintext, token), encoding="utf-8")
    return {"watermarked_copy_url": f"/api/v1/download/{artifact_id}", "watermark_session_id": token.hex(),
            "ledger_entry_hash": committed["entry"]["entry_hash"], "committed_nodes": committed["committed_nodes"],
            "assurance": "gateway-custody-demo"}


@app.post("/api/v1/leak-trace")
async def trace(leaked_copy: UploadFile = File(...), envelope: UploadFile = File(...)) -> dict:
    leaked_text, package = await _read_text(leaked_copy, "leaked copy"), await _read_envelope(envelope)
    token = extract(leaked_text)
    if not token:
        return {"keyring_signature_valid": False, "recipient_ml_dsa_signature_valid": False,
                "document_ciphertext_binding_valid": False, "ledger_chain_and_quorum_valid": False,
                "verdict": "NO WATERMARK FOUND", "assurance": "gateway-custody-demo"}
    matches = lookup_all(token)
    hashes = Counter(entry["entry_hash"] for _, entry in matches)
    if not hashes or hashes.most_common(1)[0][1] < 2:
        return {"watermark_session_id": token, "keyring_signature_valid": False,
                "recipient_ml_dsa_signature_valid": False, "document_ciphertext_binding_valid": False,
                "ledger_chain_and_quorum_valid": False, "verdict": "ATTRIBUTION NOT VERIFIED",
                "assurance": "gateway-custody-demo"}
    entry_hash = hashes.most_common(1)[0][0]
    entry = next(item for _, item in matches if item["entry_hash"] == entry_hash)
    keyring = load_verified_keyring(KEYS / "keyring.json")
    recipient_id = entry["record"]["recipient_id"]
    recipient = keyring["recipients"].get(recipient_id)
    signature_valid = bool(recipient) and verify(unb64(recipient["sign_public_key"]), canonical_json(entry["record"]), unb64(entry["recipient_signature"]))
    binding_valid = entry["record"]["doc_hash"] == package.get("ciphertext_sha256")
    ledger_valid = _ledger_status()["quorum_agreement"]
    verified = bool(signature_valid and binding_valid and ledger_valid)
    return {"watermark_session_id": token, "recipient_id": recipient_id, "timestamp": entry["record"]["timestamp"],
            "ledger_entry_hash": entry_hash, "keyring_signature_valid": True,
            "recipient_ml_dsa_signature_valid": signature_valid, "document_ciphertext_binding_valid": binding_valid,
            "ledger_chain_and_quorum_valid": ledger_valid,
            "verdict": "ATTRIBUTION VERIFIED" if verified else "ATTRIBUTION NOT VERIFIED",
            "assurance": "gateway-custody-demo"}


@app.get("/api/v1/ledger/status")
@app.post("/api/v1/ledger/verify")
def ledger_status() -> dict:
    return _ledger_status()


@app.get("/api/v1/download/{artifact_id}")
def download(artifact_id: str):
    if not artifact_id.isalnum() or len(artifact_id) != 32:
        raise _http_error(404, "artifact not found")
    matches = list(ARTIFACTS.glob(f"{artifact_id}.*"))
    if len(matches) != 1:
        raise _http_error(404, "artifact not found")
    path = matches[0]
    media_type = "application/json" if path.suffix == ".json" else "text/plain; charset=utf-8"
    return FileResponse(path, media_type=media_type, filename=path.name)


def main() -> None:
    import uvicorn
    uvicorn.run("api.server:app", host="127.0.0.1", port=8080, reload=False)


if __name__ == "__main__":
    main()
