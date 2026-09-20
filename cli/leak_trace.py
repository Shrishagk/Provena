from __future__ import annotations
import argparse
import json
from collections import Counter
from pathlib import Path
from crypto.envelope import load_envelope
from crypto.pqc import verify
from identity.keyring import canonical_json, load_root_public_key, load_verified_keyring, unb64
from ledger.client import DEFAULT_NODES, lookup_all, verify_all
from watermark.zero_width import extract


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a leaked watermark and produce a verifiable attribution report")
    parser.add_argument("leaked_copy")
    parser.add_argument("--envelope", required=True, help="original encrypted package, to verify document binding")
    parser.add_argument("--keyring", default="keys/keyring.json")
    parser.add_argument("--root-public-key", help="separately pinned organization root public key")
    parser.add_argument("--nodes", nargs="*", default=DEFAULT_NODES)
    args = parser.parse_args()
    token = extract(Path(args.leaked_copy).read_text(encoding="utf-8"))
    if not token:
        raise SystemExit("No valid repeated forensic watermark was found.")
    matches = lookup_all(token, args.nodes)
    hashes = Counter(item["entry_hash"] for _, item in matches)
    if not hashes or hashes.most_common(1)[0][1] < 2:
        raise SystemExit("Watermark found, but no two ledger replicas agree on its entry.")
    entry_hash, _ = hashes.most_common(1)[0]
    entry = next(item for _, item in matches if item["entry_hash"] == entry_hash)
    try:
        keyring_path = Path(args.keyring)
        root_path = Path(args.root_public_key) if args.root_public_key else keyring_path.with_name("org_root_public.json")
        keyring = load_verified_keyring(keyring_path, load_root_public_key(root_path))
        keyring_valid = True
    except (KeyError, ValueError, json.JSONDecodeError):
        keyring = {"recipients": {}}
        keyring_valid = False
    recipient_id = entry["record"]["recipient_id"]
    recipient = keyring["recipients"].get(recipient_id)
    signature_valid = bool(recipient) and verify(unb64(recipient["sign_public_key"]), canonical_json(entry["record"]), unb64(entry["recipient_signature"]))
    document_binding_valid = entry["record"]["doc_hash"] == load_envelope(args.envelope)["ciphertext_sha256"]
    chain_checks = verify_all(args.nodes)
    valid_chain_checks = [check for _, check in chain_checks if check["valid"]]
    same_tip = Counter(check["tip"] for check in valid_chain_checks)
    ledger_quorum_valid = len(valid_chain_checks) >= 2 and same_tip and same_tip.most_common(1)[0][1] >= 2
    report = {"watermark_session_id": token, "recipient_id": recipient_id,
              "timestamp": entry["record"]["timestamp"], "ledger_entry_hash": entry_hash,
              "keyring_signature_valid": keyring_valid, "recipient_ml_dsa_signature_valid": signature_valid,
              "document_ciphertext_binding_valid": document_binding_valid,
              "ledger_chain_and_quorum_valid": bool(ledger_quorum_valid),
              "verdict": "ATTRIBUTION VERIFIED" if keyring_valid and signature_valid and document_binding_valid and ledger_quorum_valid else "ATTRIBUTION NOT VERIFIED"}
    print(json.dumps(report, indent=2))


if __name__ == "__main__": main()
