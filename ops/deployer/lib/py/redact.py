#!/usr/bin/env python3
"""Remove segredos conhecidos de uma linha de log. Não imprime os segredos."""
import os
import sys

text = sys.stdin.read()
for name in ("COOLIFY_TOKEN", "GHCR_TOKEN", "GH_TOKEN", "DATABASE_URL", "MIGRATE_DATABASE_URL", "SMOKE_COOKIE", "DEPLOY_NOTIFY_TOKEN"):
    secret = os.environ.get(name, "")
    if secret:
        text = text.replace(secret, "***")
sys.stdout.write(text)
