"""SQLite storage and verification for one tamper-evident ledger replica."""
from __future__ import annotations
import json
import sqlite3
from hashlib import sha256
from pathlib import Path
from identity.keyring import canonical_json, unb64, b64
from crypto.pqc import sign, verify

GENESIS = "0" * 64


def proposal_payload(index: int, record: dict, recipient_signature: str, prev_hash: str) -> dict:
    return {"index": index, "record": record, "recipient_signature": recipient_signature, "prev_hash": prev_hash}


def proposal_hash(payload: dict) -> str:
    return sha256(canonical_json(payload)).hexdigest()


def entry_hash(entry: dict) -> str:
    unsigned = proposal_payload(entry["index"], entry["record"], entry["recipient_signature"], entry["prev_hash"])
    return sha256(canonical_json({**unsigned, "node_cosignatures": entry["node_cosignatures"]})).hexdigest()


class LedgerNode:
    def __init__(self, node_id: str, db_path: str | Path, secret_key: bytes, node_public_keys: dict[str, bytes], recipient_public_keys: dict[str, bytes] | None = None):
        self.node_id, self.db_path, self.secret_key = node_id, Path(db_path), secret_key
        self.node_public_keys = node_public_keys
        self.recipient_public_keys = recipient_public_keys or {}
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS entries (idx INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, entry_json TEXT NOT NULL, entry_hash TEXT NOT NULL)")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def tip(self) -> tuple[int, str]:
        with self._connect() as conn:
            row = conn.execute("SELECT idx, entry_hash FROM entries ORDER BY idx DESC LIMIT 1").fetchone()
        return (row[0], row[1]) if row else (0, GENESIS)

    def propose(self, record: dict, recipient_signature: str, prev_hash: str) -> dict:
        last_index, actual_tip = self.tip()
        if prev_hash != actual_tip:
            raise ValueError("stale or divergent previous hash")
        payload = proposal_payload(last_index + 1, record, recipient_signature, prev_hash)
        return {**payload, "node_id": self.node_id, "proposal_hash": proposal_hash(payload),
                "node_signature": b64(sign(self.secret_key, canonical_json(payload)))}

    def commit(self, entry: dict) -> str:
        last_index, actual_tip = self.tip()
        if entry["index"] != last_index + 1 or entry["prev_hash"] != actual_tip:
            raise ValueError("entry does not extend this replica")
        token = entry["record"].get("watermark_session_id")
        if not isinstance(token, str):
            raise ValueError("missing watermark session ID")
        payload = proposal_payload(entry["index"], entry["record"], entry["recipient_signature"], entry["prev_hash"])
        recipient_id = entry["record"].get("recipient_id")
        if recipient_id not in self.recipient_public_keys or not verify(
            self.recipient_public_keys[recipient_id], canonical_json(entry["record"]), unb64(entry["recipient_signature"])):
            raise ValueError("invalid recipient ML-DSA signature")
        cosigs = entry.get("node_cosignatures", {})
        valid = [node_id for node_id, signature in cosigs.items() if node_id in self.node_public_keys and
                 verify(self.node_public_keys[node_id], canonical_json(payload), unb64(signature))]
        if len(set(valid)) < 2:
            raise ValueError("entry lacks two valid node co-signatures")
        digest = entry_hash(entry)
        if entry.get("entry_hash") != digest:
            raise ValueError("incorrect entry hash")
        with self._connect() as conn:
            conn.execute("INSERT INTO entries(idx, token, entry_json, entry_hash) VALUES (?, ?, ?, ?)",
                         (entry["index"], token, json.dumps(entry, sort_keys=True), digest))
        return digest

    def lookup(self, token: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute("SELECT entry_json FROM entries WHERE token = ?", (token,)).fetchone()
        return json.loads(row[0]) if row else None

    def entries(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT entry_json FROM entries ORDER BY idx").fetchall()
        return [json.loads(row[0]) for row in rows]

    def verify_chain(self) -> dict:
        previous, errors = GENESIS, []
        count = 0
        for expected_index, entry in enumerate(self.entries(), 1):
            count = expected_index
            if entry.get("index") != expected_index or entry.get("prev_hash") != previous:
                errors.append(f"broken link at index {expected_index}")
                break
            digest = entry_hash(entry)
            if entry.get("entry_hash") != digest:
                errors.append(f"bad entry hash at index {expected_index}")
                break
            payload = proposal_payload(entry["index"], entry["record"], entry["recipient_signature"], entry["prev_hash"])
            cosigs = entry.get("node_cosignatures", {})
            valid_cosigs = [node_id for node_id, signature in cosigs.items() if node_id in self.node_public_keys and verify(
                self.node_public_keys[node_id], canonical_json(payload), unb64(signature))]
            if len(set(valid_cosigs)) < 2:
                errors.append(f"invalid node quorum at index {expected_index}")
                break
            recipient_id = entry["record"].get("recipient_id")
            if recipient_id not in self.recipient_public_keys or not verify(
                self.recipient_public_keys[recipient_id], canonical_json(entry["record"]), unb64(entry["recipient_signature"])):
                errors.append(f"invalid recipient signature at index {expected_index}")
                break
            previous = digest
        return {"node_id": self.node_id, "valid": not errors, "tip": previous, "entries": count, "errors": errors}


def compare_replicas(nodes: list[LedgerNode]) -> dict:
    checks = [node.verify_chain() for node in nodes]
    valid_tips = [check["tip"] for check in checks if check["valid"]]
    agreement = len(valid_tips) >= 2 and max(valid_tips.count(tip) for tip in set(valid_tips)) >= 2
    return {"replicas": checks, "quorum_agreement": agreement}
