#!/usr/bin/env python3
"""Confere o JSON de `gh attestation verify` contra o commit-alvo da main.

A comparação é por igualdade do campo, não por substring. Qualquer documento
vazio, inválido ou sem o commit, a ref da main e o digest sai com código
diferente de zero. O documento não é reimpresso.
"""
import json
import os
import sys
from typing import Any


def texto(valor: Any) -> str:
    return valor if isinstance(valor, str) else ""


def confere(item: dict[str, Any], want_sha: str, digest_hex: str) -> bool:
    statement = item.get("verificationResult", {})
    if not isinstance(statement, dict):
        return False
    statement = statement.get("statement", {})
    if not isinstance(statement, dict):
        return False
    subjects = statement.get("subject", [])
    if not isinstance(subjects, list):
        return False
    digest_ok = False
    for subject in subjects:
        if not isinstance(subject, dict):
            continue
        digest = subject.get("digest", {})
        if isinstance(digest, dict) and texto(digest.get("sha256")) == digest_hex:
            digest_ok = True
    if not digest_ok:
        return False
    predicate = statement.get("predicate", {})
    if not isinstance(predicate, dict):
        return False
    build = predicate.get("buildDefinition", {})
    if not isinstance(build, dict):
        return False
    external = build.get("externalParameters", {})
    if not isinstance(external, dict):
        return False
    workflow = external.get("workflow", {})
    if not isinstance(workflow, dict) or texto(workflow.get("ref")) != "refs/heads/main":
        return False
    deps = build.get("resolvedDependencies", [])
    if not isinstance(deps, list):
        return False
    for dep in deps:
        if not isinstance(dep, dict):
            continue
        digest = dep.get("digest", {})
        if isinstance(digest, dict) and texto(digest.get("gitCommit")) == want_sha:
            return True
    return False


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
    if len(digest_hex) != 64:
        print("parâmetros de attestation inválidos", file=sys.stderr)
        return 5
    for item in data:
        if isinstance(item, dict) and confere(item, want_sha, digest_hex):
            return 0
    print("attestation não confere com o commit da main", file=sys.stderr)
    return 6


if __name__ == "__main__":
    sys.exit(main())
