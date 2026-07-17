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
# RESTORE (testar ANTES do go-live — backup sem teste de restore não é backup).
# DETERMINÍSTICO: restaurar dump completo por cima de banco já migrado conflita em
# constraints (review PR #52) — o banco é RECRIADO vazio, o dump entra inteiro (inclui
# _prisma_migrations) e o migrate deploy aplica só migrations mais novas que o dump.
#
#   0. parar quem escreve:
#        $COMPOSE stop app evolution
#   1. recriar os bancos vazios e restaurar (db de pé; app/evolution PARADOS):
#        $COMPOSE up -d db
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'DROP DATABASE erp WITH (FORCE);'
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'CREATE DATABASE erp;'
#        $COMPOSE exec -T db pg_restore -U erp -d erp --no-owner < erp.dump
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'DROP DATABASE evolution WITH (FORCE);'
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'CREATE DATABASE evolution;'
#        $COMPOSE exec -T db pg_restore -U erp -d evolution --no-owner < evolution.dump
#   2. migrations mais novas que o dump — SÍNCRONO (run --rm espera o exit; `up -d` NÃO):
#        $COMPOSE run --rm migrate        # idempotente; falhou aqui = NÃO siga (confira o log)
#   3. arquivos NOS VOLUMES com app/evolution ainda parados — `run --rm --no-deps` monta o
#      volume do serviço num container efêmero, sem subir o serviço (nem as dependências);
#      `--entrypoint tar` ignora o entrypoint da imagem (a da Evolution tem um):
#        $COMPOSE run --rm --no-deps -T --entrypoint tar app       -xzf - -C /app/data   < uploads.tar.gz
#        $COMPOSE run --rm --no-deps -T --entrypoint tar evolution -xzf - -C /evolution  < evolution-instances.tar.gz
#   4. só agora subir os serviços (contra dados JÁ restaurados):
#        $COMPOSE up -d app evolution
#   5. VALIDAR: login + fila de cobrança + thread da inbox + sessão do número.
# ---------------------------------------------------------------------------
