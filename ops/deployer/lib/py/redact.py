#!/usr/bin/env python3
"""Remove segredos conhecidos de uma linha de log. Não imprime os segredos."""
import os
import sys

text = sys.stdin.read()
for name in ("COOLIFY_TOKEN", "GHCR_TOKEN", "DATABASE_URL"):
    secret = os.environ.get(name, "")
    if secret:
        text = text.replace(secret, "***")
sys.stdout.write(text)
