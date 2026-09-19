"""Create demo identities, a signed offline keyring, and ledger-node signing keys."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from crypto.pqc import kem_keygen, sign_keygen, sign
from identity.keyring import b64, canonical_json


def _write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")


def bootstrap(base: Path, recipients: list[str]) -> None:
    keys = base / "keys"
    keys.mkdir(parents=True, exist_ok=True)
    root_public, root_secret = sign_keygen()
    _write(keys / "org_root_private.json", {"algorithm": "ML-DSA-65", "secret_key": b64(root_secret)})
    records: dict[str, dict[str, str]] = {}
    for recipient_id in recipients:
        kem_public, kem_secret = kem_keygen()
        sign_public, sign_secret = sign_keygen()
        _write(keys / f"{recipient_id}.private.json", {
            "kem_algorithm": "ML-KEM-768", "kem_secret_key": b64(kem_secret),
            "sign_algorithm": "ML-DSA-65", "sign_secret_key": b64(sign_secret),
        })
        records[recipient_id] = {"kem_public_key": b64(kem_public), "sign_public_key": b64(sign_public)}
    signed = {"format": "pq-forensic-keyring-v1", "recipients": records}
    keyring = {**signed, "org_root_public_key": b64(root_public),
               "signature": b64(sign(root_secret, canonical_json(signed)))}
    _write(keys / "keyring.json", keyring)

    nodes: dict[str, dict[str, str]] = {}
    for node_id in ("node1", "node2", "node3"):
        public, secret = sign_keygen()
        _write(keys / f"{node_id}.private.json", {"algorithm": "ML-DSA-65", "secret_key": b64(secret)})
        nodes[node_id] = {"sign_public_key": b64(public)}
    _write(keys / "ledger_nodes.json", {"format": "pq-forensic-ledger-nodes-v1", "nodes": nodes})
    print(f"Created {len(recipients)} recipient identities and 3 node identities in {keys}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create offline demo identities")
    parser.add_argument("--base", default=".")
    parser.add_argument("--recipients", nargs="+", default=["alice", "bob", "carol"])
    args = parser.parse_args()
    bootstrap(Path(args.base).resolve(), args.recipients)


if __name__ == "__main__":
    main()
