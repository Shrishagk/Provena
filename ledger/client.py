"""Quorum client for the three local/air-gapped ledger node services."""
from __future__ import annotations
import json
from collections import Counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from ledger.chain import entry_hash


DEFAULT_NODES = ["http://127.0.0.1:8001", "http://127.0.0.1:8002", "http://127.0.0.1:8003"]


class LedgerRequestError(ConnectionError):
    """A ledger endpoint could be reached but rejected the request."""


def _request(url: str, method: str = "GET", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=4) as response:
            return json.loads(response.read().decode())
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LedgerRequestError(f"{url}: HTTP {exc.code}: {detail}") from exc
    except (URLError, TimeoutError) as exc:
        raise ConnectionError(f"{url}: {exc}") from exc


def append_quorum(record: dict, recipient_signature: str, urls: list[str] = DEFAULT_NODES) -> dict:
    """Get two matching proposal signatures, then submit the same entry to all replicas."""
    health = []
    for url in urls:
        try: health.append((url, _request(url + "/health")))
        except ConnectionError: pass
    tips = Counter(item["tip"] for _, item in health)
    if not tips or tips.most_common(1)[0][1] < 2:
        raise RuntimeError("need two reachable replicas with the same chain tip")
    prev_hash = tips.most_common(1)[0][0]
    proposals = []
    for url, _ in health:
        try: proposals.append((url, _request(url + "/propose", "POST", {"record": record, "recipient_signature": recipient_signature, "prev_hash": prev_hash})))
        except ConnectionError: pass
    groups: dict[str, list[tuple[str, dict]]] = {}
    for item in proposals: groups.setdefault(item[1]["proposal_hash"], []).append(item)
    matching = max(groups.values(), key=len, default=[])
    if len(matching) < 2:
        raise RuntimeError("could not collect a 2-of-3 matching proposal quorum")
    first = matching[0][1]
    entry = {"index": first["index"], "record": record, "recipient_signature": recipient_signature,
             "prev_hash": prev_hash, "node_cosignatures": {reply["node_id"]: reply["node_signature"] for _, reply in matching}}
    entry["entry_hash"] = entry_hash(entry)
    committed = []
    commit_errors = []
    for url, _ in health:
        try:
            _request(url + "/commit", "POST", entry)
            committed.append(url)
        except ConnectionError as exc:
            commit_errors.append(str(exc))
    if len(committed) < 2:
        detail = "; ".join(commit_errors) or "no replica acknowledged the commit"
        raise RuntimeError(f"quorum signed but fewer than two replicas committed: {detail}")
    return {"entry": entry, "committed_nodes": committed}


def lookup_all(token: str, urls: list[str] = DEFAULT_NODES) -> list[tuple[str, dict]]:
    found = []
    for url in urls:
        try: found.append((url, _request(url + "/lookup/" + token)))
        except ConnectionError: pass
    return found


def verify_all(urls: list[str] = DEFAULT_NODES) -> list[tuple[str, dict]]:
    results = []
    for url in urls:
        try: results.append((url, _request(url + "/verify")))
        except ConnectionError: pass
    return results
