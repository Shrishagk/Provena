from __future__ import annotations
import argparse
import json
from ledger.client import DEFAULT_NODES, verify_all


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify all reachable ledger replica hash chains")
    parser.add_argument("--nodes", nargs="*", default=DEFAULT_NODES)
    args = parser.parse_args()
    print(json.dumps(dict(verify_all(args.nodes)), indent=2))


if __name__ == "__main__": main()
