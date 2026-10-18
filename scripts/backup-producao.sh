#!/usr/bin/env bash
# Backup de produção (doc 31 — E5, gap A6 do doc 28).
# O banco é o ARQUIVO ÚNICO das conversas de WhatsApp (o WhatsApp não re-sincroniza) —
# backup diário obrigatório ANTES do go-live, com teste de restore (doc 31 §backup).
#
# O que entra:
#   1. pg_dump do banco do app (erp)          — dados de negócio + log de mensagens
#   2. volume de uploads (data/uploads)        — mídia de mensagem + comprovantes/documentos
#   3. volume do motor (/data)                 — PGlite, chave do cofre, credenciais e mídia
#                                                (perder = re-parear QR)
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

# 1. Dump consistente (pg_dump dentro do container; formato custom = restore seletivo).
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-erp}" -Fc erp > "$PASTA/erp.dump"

# 2. Mídia + comprovantes (volume `uploads` montado no app em /app/data/uploads).
$COMPOSE exec -T app tar -czf - -C /app/data uploads > "$PASTA/uploads.tar.gz"

# 3. Volume do motor (PGlite, chave do cofre, credenciais e mídia). Perder isto não perde as
#    mensagens do ERP (estão no nosso banco), mas obriga a reconectar o número via QR.
#    O PGlite grava em arquivo: copiar /data com o motor de pé pode sair inconsistente. Por
#    isso o motor PARA só durante o tar e volta a subir em seguida — também em erro (trap).
#    O tar roda num container auxiliar que monta o volume do container do motor
#    (--volumes-from, só leitura): não depende de a imagem do motor ter tar.
#    O motor fica fora do ar por alguns segundos; o webhook e a fila do ERP reenviam depois.
#    Um 503 isolado de "Motor WhatsApp inalcançável" no /api/whatsapp/health nessa janela é
#    esperado (SETUP.md §backup).
IMAGEM_TAR="${IMAGEM_TAR:-alpine:3.20}"
MOTOR_CID="$($COMPOSE ps -aq motor)"
[ -n "$MOTOR_CID" ] || { echo "[backup] ERRO: container do motor não encontrado" >&2; exit 1; }
MOTOR_PARADO=0
religar_motor() {
  if [ "$MOTOR_PARADO" = 1 ]; then
    $COMPOSE start motor >/dev/null && echo "[backup] motor de volta" || echo "[backup] ERRO: motor não voltou — rode: $COMPOSE start motor" >&2
    MOTOR_PARADO=0
  fi
}
trap religar_motor EXIT INT TERM
if [ "$(docker inspect -f '{{.State.Running}}' "$MOTOR_CID")" = "true" ]; then
  $COMPOSE stop motor >/dev/null
  MOTOR_PARADO=1
fi
docker run --rm --volumes-from "$MOTOR_CID:ro" "$IMAGEM_TAR" tar -czf - -C / data > "$PASTA/motor-data.tar.gz"
religar_motor

# Integridade mínima: nenhum arquivo pode sair vazio.
for f in erp.dump uploads.tar.gz motor-data.tar.gz; do
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
#        $COMPOSE stop app motor
#   1. recriar o banco vazio e restaurar (db de pé; app/motor PARADOS):
#        $COMPOSE up -d db
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'DROP DATABASE erp WITH (FORCE);'
#        $COMPOSE exec -T db psql -U erp -d postgres -c 'CREATE DATABASE erp;'
#        $COMPOSE exec -T db pg_restore -U erp -d erp --no-owner < erp.dump
#   2. migrations mais novas que o dump — SÍNCRONO (run --rm espera o exit; `up -d` NÃO):
#        $COMPOSE run --rm migrate        # idempotente; falhou aqui = NÃO siga (confira o log)
#   3. arquivos NOS VOLUMES com app/motor ainda parados — `run --rm --no-deps` monta o
#      volume do serviço num container efêmero, sem subir o serviço (nem as dependências);
#      `--entrypoint tar` ignora o entrypoint da imagem (a do motor pode ter um):
#        $COMPOSE run --rm --no-deps -T --entrypoint tar app       -xzf - -C /app/data   < uploads.tar.gz
#        docker run --rm -i --volumes-from "$($COMPOSE ps -aq motor)" alpine:3.20 tar -xzf - -C / < motor-data.tar.gz
#      (o motor pelo container auxiliar, como no backup: não depende de tar na imagem do motor;
#       se o container do motor não existir ainda, `$COMPOSE create motor` antes)
#   4. só agora subir os serviços (contra dados JÁ restaurados):
#        $COMPOSE up -d app motor
#   5. VALIDAR: login + fila de cobrança + thread da inbox + sessão do número.
# ---------------------------------------------------------------------------
