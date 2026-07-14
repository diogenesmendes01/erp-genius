#!/usr/bin/env bash
# Backup de produção (doc 31 — E5, gap A6 do doc 28).
# O banco é o ARQUIVO ÚNICO das conversas de WhatsApp (o WhatsApp não re-sincroniza) —
# backup diário obrigatório ANTES do go-live, com teste de restore (doc 31 §backup).
#
# O que entra:
#   1. pg_dump do banco do app (erp)          — dados de negócio + log de mensagens
#   2. pg_dump do banco da Evolution           — instâncias/credenciais da sessão Baileys
#   3. volume de uploads (data/uploads)        — mídia de mensagem + comprovantes/documentos
#   4. volume de instâncias da Evolution       — auth state Baileys (perder = re-parear QR)
#
# Uso (na VPS, no diretório do repo):  ./scripts/backup-producao.sh [destino]
# Agendamento (crontab -e):            15 3 * * *  cd /opt/erp-genius && ./scripts/backup-producao.sh >> /var/log/erp-backup.log 2>&1
set -euo pipefail

DESTINO="${1:-/var/backups/erp-genius}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
CARIMBO="$(date +%Y%m%d-%H%M%S)"
PASTA="$DESTINO/$CARIMBO"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$PASTA"

echo "[backup] $CARIMBO → $PASTA"

# 1/2. Dumps consistentes (pg_dump dentro do container; formato custom = restore seletivo).
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-erp}" -Fc erp > "$PASTA/erp.dump"
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-erp}" -Fc evolution > "$PASTA/evolution.dump"

# 3. Mídia + comprovantes (volume `uploads` montado no app em /app/data/uploads).
$COMPOSE exec -T app tar -czf - -C /app/data uploads > "$PASTA/uploads.tar.gz"

# 4. Auth state Baileys (volume da Evolution). Perder isto não perde mensagens (estão no
#    nosso banco), mas obriga a reconectar o número via QR.
$COMPOSE exec -T evolution tar -czf - -C /evolution instances > "$PASTA/evolution-instances.tar.gz"

# Integridade mínima: nenhum arquivo pode sair vazio.
for f in erp.dump evolution.dump uploads.tar.gz evolution-instances.tar.gz; do
  [ -s "$PASTA/$f" ] || { echo "[backup] ERRO: $f saiu vazio" >&2; exit 1; }
done

# Retenção: apaga pastas de backup além da janela.
find "$DESTINO" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENCAO_DIAS" -exec rm -rf {} +

echo "[backup] ok — $(du -sh "$PASTA" | cut -f1) · retenção ${RETENCAO_DIAS}d"

# ---------------------------------------------------------------------------
# RESTORE (testar ANTES do go-live — backup sem teste de restore não é backup):
#   1. banco:      $COMPOSE exec -T db pg_restore -U erp -d erp --clean --if-exists < erp.dump
#                  $COMPOSE exec -T db pg_restore -U erp -d evolution --clean --if-exists < evolution.dump
#   2. uploads:    $COMPOSE exec -T app  tar -xzf - -C /app/data      < uploads.tar.gz
#   3. instâncias: $COMPOSE exec -T evolution tar -xzf - -C /evolution < evolution-instances.tar.gz
#   4. docker compose -f docker-compose.prod.yml restart app evolution
# O passo a passo comentado vive no doc 31 §backup.
# ---------------------------------------------------------------------------
