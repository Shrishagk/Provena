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


def bootstrap(base: Path, recipients: list[str], recipient_key_dir: Path | None = None,
              root_key_dir: Path | None = None, node_key_dir: Path | None = None) -> None:
    keys = base / "keys"
    keys.mkdir(parents=True, exist_ok=True)
    if recipient_key_dir is None:
        raise ValueError("--recipient-key-dir is required; recipient private keys must not be created in the gateway key directory")
    if root_key_dir is None:
        raise ValueError("--root-key-dir is required; the organization root private key must remain offline")
    if node_key_dir is None:
        raise ValueError("--node-key-dir is required; ledger node private keys must not be created in the gateway directory")
    private_keys = recipient_key_dir
    private_keys.mkdir(parents=True, exist_ok=True)
    root_keys = root_key_dir
    root_keys.mkdir(parents=True, exist_ok=True)
    node_keys = node_key_dir
    node_keys.mkdir(parents=True, exist_ok=True)
    # The local launcher needs to use the same private node-key vault that
    # generated the public keys in the signed registry below.  Store only the
    # vault location (never key material) alongside the generated public
    # deployment files.  An explicit launcher argument or environment variable
    # may still override this local-demo convenience setting.
    _write(keys / "demo_node_vault.json", {
        "format": "pq-forensic-demo-node-vault-v1",
        "node_key_dir": str(node_keys.resolve()),
    })
    # A new keyring starts a new trust domain.  Entries signed by the previous
    # recipient/node keys must not be retained as part of this new ledger. The
    # startup script performs that reset after it has stopped old node processes
    # (Windows does not allow deleting a SQLite database that they still hold).
    reset_marker = base / "data" / "ledger-reset-required"
    reset_marker.parent.mkdir(parents=True, exist_ok=True)
    reset_marker.write_text("Regenerated demo identities require a fresh ledger.\n", encoding="utf-8")
    root_public, root_secret = sign_keygen()
    _write(root_keys / "org_root_private.json", {"algorithm": "ML-DSA-65", "secret_key": b64(root_secret)})
    _write(keys / "org_root_public.json", {"algorithm": "ML-DSA-65", "public_key": b64(root_public)})
    records: dict[str, dict[str, str]] = {}
    for recipient_id in recipients:
        kem_public, kem_secret = kem_keygen()
        sign_public, sign_secret = sign_keygen()
        _write(private_keys / f"{recipient_id}.private.json", {
            "kem_algorithm": "ML-KEM-768", "kem_secret_key": b64(kem_secret),
            "sign_algorithm": "ML-DSA-65", "sign_secret_key": b64(sign_secret),
        })
        records[recipient_id] = {"kem_public_key": b64(kem_public), "sign_public_key": b64(sign_public)}
    signed = {"format": "pq-forensic-keyring-v1", "recipients": records}
    keyring = {**signed, "signature": b64(sign(root_secret, canonical_json(signed)))}
    _write(keys / "keyring.json", keyring)

    nodes: dict[str, dict[str, str]] = {}
    for node_id in ("node1", "node2", "node3"):
        public, secret = sign_keygen()
        _write(node_keys / f"{node_id}.private.json", {"node_id": node_id, "algorithm": "ML-DSA-65", "secret_key": b64(secret)})
        # All demo nodes truthfully have the same administrator.  Production
        # registries must name independently controlled domains.
        nodes[node_id] = {"sign_public_key": b64(public), "administrator_domain": "single-host-demo"}
    node_registry = {"format": "pq-forensic-ledger-nodes-v1", "nodes": nodes}
    _write(keys / "ledger_nodes.json", {**node_registry, "signature": b64(sign(root_secret, canonical_json(node_registry)))})
    print(f"Created {len(recipients)} recipient identities; private recipient keys are in {private_keys}. "
          f"The organization root private key is in {root_keys}. Created 3 node identities in {keys}; "
          f"node private keys are in {node_keys}; start_ledger_nodes.ps1 will reset the demo ledger state.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create offline demo identities")
    parser.add_argument("--base", default=".")
    parser.add_argument("--recipients", nargs="+", default=["alice", "bob", "carol"])
    parser.add_argument("--recipient-key-dir", required=True, help="recipient-controlled directory for private recipient keys")
    parser.add_argument("--root-key-dir", required=True, help="offline issuer-controlled directory for the organization root private key")
    parser.add_argument("--node-key-dir", required=True, help="ledger-node private key directory; use separate host-controlled vaults in production")
    args = parser.parse_args()
    recipient_key_dir = Path(args.recipient_key_dir).resolve() if args.recipient_key_dir else None
    root_key_dir = Path(args.root_key_dir).resolve() if args.root_key_dir else None
    node_key_dir = Path(args.node_key_dir).resolve() if args.node_key_dir else None
    bootstrap(Path(args.base).resolve(), args.recipients, recipient_key_dir, root_key_dir, node_key_dir)


if __name__ == "__main__":
    main()
