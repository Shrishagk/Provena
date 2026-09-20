"""FastAPI process for a single offline ledger replica."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from localdeps import ensure_local_dependencies
ensure_local_dependencies()
from fastapi import FastAPI, HTTPException
import uvicorn
from identity.keyring import load_root_public_key, load_verified_keyring, load_verified_node_registry, unb64
from ledger.chain import LedgerNode


def load_node(base: Path, node_id: str, node_key_path: Path | None = None,
              registry_path: Path | None = None, keyring_path: Path | None = None,
              root_public_key_path: Path | None = None, database_path: Path | None = None,
              allow_single_administrator_demo: bool = False) -> LedgerNode:
    """Load one node without requiring any other node's private key.

    Production nodes should pass all paths explicitly and keep their key file
    local to their independently administered host.
    """
    keys = base / "keys"
    private = json.loads((node_key_path or keys / f"{node_id}.private.json").read_text(encoding="utf-8"))
    if private.get("node_id", node_id) != node_id:
        raise ValueError("node private key belongs to a different node identity")
    root_public_key = load_root_public_key(root_public_key_path or keys / "org_root_public.json")
    registry = load_verified_node_registry(registry_path or keys / "ledger_nodes.json", root_public_key)
    keyring = load_verified_keyring(keyring_path or keys / "keyring.json", root_public_key)
    publics = {name: unb64(item["sign_public_key"]) for name, item in registry["nodes"].items()}
    recipients = {name: unb64(item["sign_public_key"]) for name, item in keyring["recipients"].items()}
    domains = {name: item.get("administrator_domain") for name, item in registry["nodes"].items()}
    if node_id not in publics or not all(isinstance(domain, str) and domain for domain in domains.values()):
        raise ValueError("node registry is incomplete")
    return LedgerNode(node_id, database_path or base / "data" / f"{node_id}.sqlite3",
                      unb64(private["secret_key"]), publics, recipients, domains,
                      allow_single_administrator_demo)


def create_app(node: LedgerNode) -> FastAPI:
    app = FastAPI(title=f"Offline PQ Ledger {node.node_id}")
    @app.get("/health")
    def health(): return {"node_id": node.node_id, "tip": node.tip()[1],
                          "single_administrator_demo": node.allow_single_administrator_demo}
    @app.post("/propose")
    def propose(body: dict):
        try: return node.propose(body["record"], body["recipient_signature"], body["prev_hash"])
        except (KeyError, ValueError) as exc: raise HTTPException(409, str(exc))
    @app.post("/commit")
    def commit(body: dict):
        try: return {"entry_hash": node.commit(body)}
        except ValueError as exc: raise HTTPException(409, str(exc))
    @app.get("/lookup/{token}")
    def lookup(token: str):
        entry = node.lookup(token)
        if not entry: raise HTTPException(404, "not found")
        return entry
    @app.get("/verify")
    def chain_verify(): return node.verify_chain()
    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", required=True, choices=["node1", "node2", "node3"])
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--base", default=".")
    parser.add_argument("--host", default="127.0.0.1", help="bind address; keep loopback for the single-host demo")
    parser.add_argument("--node-key-path", help="path to only this node's private signing key")
    parser.add_argument("--node-registry-path", help="path to the root-signed node registry")
    parser.add_argument("--recipient-keyring-path", help="path to the root-signed recipient keyring")
    parser.add_argument("--root-public-key-path", help="path to the separately pinned organization root public key")
    parser.add_argument("--database-path", help="path to this node's local SQLite database")
    parser.add_argument("--allow-single-administrator-demo", action="store_true",
                        help="only for the local demo; disables independent-administrator quorum enforcement")
    args = parser.parse_args()
    uvicorn.run(create_app(load_node(
        Path(args.base).resolve(), args.node,
        Path(args.node_key_path).resolve() if args.node_key_path else None,
        Path(args.node_registry_path).resolve() if args.node_registry_path else None,
        Path(args.recipient_keyring_path).resolve() if args.recipient_keyring_path else None,
        Path(args.root_public_key_path).resolve() if args.root_public_key_path else None,
        Path(args.database_path).resolve() if args.database_path else None,
        args.allow_single_administrator_demo,
    )), host=args.host, port=args.port)


if __name__ == "__main__": main()
