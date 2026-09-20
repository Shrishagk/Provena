"""FastAPI process for a single offline ledger replica."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from localdeps import ensure_local_dependencies
ensure_local_dependencies()
from fastapi import FastAPI, HTTPException
import uvicorn
from identity.keyring import unb64
from ledger.chain import LedgerNode


def load_node(base: Path, node_id: str) -> LedgerNode:
    private = json.loads((base / "keys" / f"{node_id}.private.json").read_text(encoding="utf-8"))
    registry = json.loads((base / "keys" / "ledger_nodes.json").read_text(encoding="utf-8"))
    keyring = json.loads((base / "keys" / "keyring.json").read_text(encoding="utf-8"))
    publics = {name: unb64(item["sign_public_key"]) for name, item in registry["nodes"].items()}
    recipients = {name: unb64(item["sign_public_key"]) for name, item in keyring["recipients"].items()}
    return LedgerNode(node_id, base / "data" / f"{node_id}.sqlite3", unb64(private["secret_key"]), publics, recipients)


def create_app(node: LedgerNode) -> FastAPI:
    app = FastAPI(title=f"Offline PQ Ledger {node.node_id}")
    @app.get("/health")
    def health(): return {"node_id": node.node_id, "tip": node.tip()[1]}
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
    args = parser.parse_args()
    uvicorn.run(create_app(load_node(Path(args.base).resolve(), args.node)), host=args.host, port=args.port)


if __name__ == "__main__": main()
