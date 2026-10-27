#!/usr/bin/env bash
set -euo pipefail

DESTINO="${1:-/var/backups/erp-genius}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
CARIMBO="$(date +%Y%m%d-%H%M%S)"
PASTA="$DESTINO/$CARIMBO"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$PASTA"

echo "[backup] $CARIMBO → $PASTA"

$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-erp}" -Fc erp > "$PASTA/erp.dump"

$COMPOSE exec -T app tar -czf - -C /app/data uploads > "$PASTA/uploads.tar.gz"

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

for f in erp.dump uploads.tar.gz motor-data.tar.gz; do
  [ -s "$PASTA/$f" ] || { echo "[backup] ERRO: $f saiu vazio" >&2; exit 1; }
done

find "$DESTINO" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENCAO_DIAS" -exec rm -rf {} +

echo "[backup] ok — $(du -sh "$PASTA" | cut -f1) · retenção ${RETENCAO_DIAS}d"
