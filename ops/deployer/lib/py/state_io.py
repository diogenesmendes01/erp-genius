#!/usr/bin/env python3
"""Lê ou grava o state file. `write` lê campos pelo ambiente; `read` imprime uma chave."""
import json
import os
import sys

KEYS = ("sha", "app_digest", "migrate_digest", "result")


def write_state() -> int:
    doc = {
        "sha": os.environ["STATE_SHA"],
        "app_digest": os.environ["STATE_APP"],
        "migrate_digest": os.environ["STATE_MIG"],
        "result": os.environ["STATE_RESULT"],
        "deployed_at": os.environ["STATE_AT"],
    }
    for key in KEYS:
        if not isinstance(doc[key], str) or "\n" in doc[key]:
            return 1
    json.dump(doc, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def read_state() -> int:
    if len(sys.argv) != 4:
        return 2
    key, path = sys.argv[2], sys.argv[3]
    if key not in KEYS:
        return 2
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        return 3
    value = data.get(key, "")
    if not isinstance(value, str):
        return 3
    sys.stdout.write(value)
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        return 2
    if sys.argv[1] == "write":
        return write_state()
    if sys.argv[1] == "read":
        return read_state()
    return 2


if __name__ == "__main__":
    sys.exit(main())
