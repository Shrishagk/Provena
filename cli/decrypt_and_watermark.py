from __future__ import annotations
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from crypto.envelope import decrypt_document, load_envelope
from crypto.pqc import sign
from identity.keyring import canonical_json, unb64, b64
from ledger.client import DEFAULT_NODES, append_quorum
from watermark.zero_width import embed


def main() -> None:
    parser = argparse.ArgumentParser(description="Decrypt, watermark, sign, and quorum-commit a text document")
    parser.add_argument("envelope")
    parser.add_argument("--recipient", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--key-dir", default="keys")
    parser.add_argument("--nodes", nargs="*", default=DEFAULT_NODES)
    args = parser.parse_args()
    private = json.loads((Path(args.key_dir) / f"{args.recipient}.private.json").read_text(encoding="utf-8"))
    envelope = load_envelope(args.envelope)
    plaintext = decrypt_document(envelope, args.recipient, unb64(private["kem_secret_key"]))
    try: text = plaintext.decode("utf-8")
    except UnicodeDecodeError as exc: raise SystemExit("prototype watermark supports UTF-8 text documents only") from exc
    token = os.urandom(16)
    record = {"doc_hash": envelope["ciphertext_sha256"], "recipient_id": args.recipient,
              "watermark_session_id": token.hex(), "timestamp": datetime.now(timezone.utc).isoformat()}
    signature = b64(sign(unb64(private["sign_secret_key"]), canonical_json(record)))
    result = append_quorum(record, signature, args.nodes)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(embed(text, token), encoding="utf-8")
    print(json.dumps({"watermarked_copy": args.output, "session_token": token.hex(),
                      "ledger_entry_hash": result["entry"]["entry_hash"], "committed_nodes": result["committed_nodes"]}, indent=2))


if __name__ == "__main__": main()
