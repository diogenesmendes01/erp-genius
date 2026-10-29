#!/usr/bin/env python3
"""Confere o JSON de `gh attestation verify` contra o commit-alvo da main.

Qualquer documento vazio, inválido ou sem o commit, a ref da main e o digest
faz o processo sair com código diferente de zero. O documento não é reimpresso.
"""
import json
import os
import sys


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("attestation saída vazia", file=sys.stderr)
        return 2
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print("attestation JSON inválido", file=sys.stderr)
        return 3
    if not isinstance(data, list) or len(data) == 0:
        print("attestation sem bundles", file=sys.stderr)
        return 4
    want_sha = os.environ.get("EXPECTED_SHA", "")
    want_digest = os.environ.get("EXPECTED_DIGEST", "")
    if len(want_sha) != 40 or not want_digest.startswith("sha256:"):
        print("parâmetros de attestation inválidos", file=sys.stderr)
        return 5
    digest_hex = want_digest.split(":", 1)[1]
    blob = json.dumps(data)
    if want_sha not in blob:
        print("attestation não contém o commit-alvo", file=sys.stderr)
        return 6
    if "refs/heads/main" not in blob:
        print("attestation não é da main", file=sys.stderr)
        return 7
    if digest_hex not in blob:
        print("attestation não contém o digest", file=sys.stderr)
        return 8
    return 0


if __name__ == "__main__":
    sys.exit(main())
