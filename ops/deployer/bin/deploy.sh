#!/usr/bin/env bash
# Deploy pull da UAT. Segredos só em /etc/erp-deployer/env (0600, dono deployer).
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"
# shellcheck source=../lib/steps.sh
source "${SCRIPT_DIR}/../lib/steps.sh"

apply_defaults() {
  : "${DEPLOYER_PAUSE_FILE:=/etc/erp-deployer/PAUSE}"
  : "${DEPLOYER_STATE_FILE:=/var/lib/erp-deployer/state.json}"
  : "${DEPLOYER_LOCK_FILE:=/var/lib/erp-deployer/deploy.lock}"
  : "${DEPLOYER_LOG_FILE:=/var/lib/erp-deployer/deploy.log}"
  : "${DEPLOYER_FAILED_FILE:=/var/lib/erp-deployer/state.json.failed}"
  : "${DEPLOYER_ENV_FILE:=/etc/erp-deployer/env}"
  : "${BACKUP_DIR:=/var/backups/erp-deployer}"
  : "${BACKUP_RETENTION_DAYS:=14}"
  : "${HEALTH_ATTEMPTS:=30}"
  : "${HEALTH_INTERVAL_SECONDS:=5}"
  : "${COOLIFY_BASE_URL:=http://127.0.0.1:8000}"
  : "${SMOKE_PATH:=/api/inbox/nao-lidas}"
}

require_tools() {
  local c
  for c in gh curl python3 pg_dump pg_restore docker sha256sum flock timeout find mktemp; do
    if ! command -v "$c" >/dev/null 2>&1; then
      die "ferramenta ausente: ${c}"
    fi
  done
}

acquire_lock() {
  local dir="" rc=0
  dir="$(dirname "$DEPLOYER_LOCK_FILE")"
  mkdir -p "$dir" || die "não foi possível criar o diretório do lock"
  chmod 0700 "$dir" || die "não foi possível proteger o diretório do lock"
  exec 9>>"$DEPLOYER_LOCK_FILE"
  flock -n 9 || rc=$?
  if [[ "$rc" -eq 1 ]]; then
    log_event "lock" "ocupado"
    exit 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
  chmod 0600 "$DEPLOYER_LOCK_FILE" || die "lock sem 0600"
}

validate_config() {
  local url=""
  if [[ "${COOLIFY_APP_UUID+x}" == "x" && "$COOLIFY_APP_UUID" != "$COOLIFY_APP_UUID_FIXO" ]]; then
    die "COOLIFY_APP_UUID é fixo no app thpvwxk6figfp347ajznvzhl"
  fi
  assert_token "COOLIFY_TOKEN" "${COOLIFY_TOKEN:-}"
  assert_token "GHCR_TOKEN" "${GHCR_TOKEN:-}"
  url="${COOLIFY_BASE_URL%/}"
  assert_coolify_base_url "$url"
  [[ -n "${APP_BASE_URL:-}" ]] || die "APP_BASE_URL ausente"
  assert_app_base_url "${APP_BASE_URL%/}"
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL ausente"
  assert_smoke_cookie "${SMOKE_COOKIE:-}"
  assert_smoke_path "${SMOKE_PATH:-}"
  if [[ -n "${DEPLOY_NOTIFY_URL:-}" ]]; then
    assert_notify_url "$DEPLOY_NOTIFY_URL"
    assert_token "DEPLOY_NOTIFY_TOKEN" "${DEPLOY_NOTIFY_TOKEN:-}"
  fi
  [[ "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || die "HEALTH_ATTEMPTS inválido"
  [[ "$HEALTH_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || die "HEALTH_INTERVAL_SECONDS inválido"
}

already_deployed() {
  local current=""
  if [[ ! -f "$DEPLOYER_STATE_FILE" ]]; then
    return 1
  fi
  if ! current="$(python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" read sha "$DEPLOYER_STATE_FILE")"; then
    die "state file ilegível"
  fi
  [[ "$current" == "$1" ]]
}

failed_same() {
  local current=""
  if [[ ! -f "$DEPLOYER_FAILED_FILE" ]]; then
    return 1
  fi
  if ! current="$(python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" read sha "$DEPLOYER_FAILED_FILE")"; then
    die "marcador de falha ilegível"
  fi
  [[ "$current" == "$1" ]]
}

rollback_or_note() {
  if ! rollback_from_state; then
    log_event "rollback" "indisponivel" "${1:-}"
  fi
}

main() {
  local rc=0 tool_root="" pause_file="" app_digest="" mig_digest=""
  START_MS="$(date +%s%3N)"
  DURATION_MS=0
  CANDIDATE=""
  tool_root="${DEPLOYER_TOOL_ROOT:-}"
  pause_file="${DEPLOYER_PAUSE_FILE:-/etc/erp-deployer/PAUSE}"
  pin_path "$tool_root"
  unset DEPLOYER_TOOL_ROOT
  apply_defaults
  if [[ -e "/etc/erp-deployer/PAUSE" || -e "$pause_file" ]]; then
    log_event "pause" "kill_switch"
    exit 0
  fi
  load_env_file "$DEPLOYER_ENV_FILE"
  apply_defaults
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    GH_TOKEN="$GHCR_TOKEN"
    export GH_TOKEN
  fi
  if [[ -e "/etc/erp-deployer/PAUSE" || -e "$DEPLOYER_PAUSE_FILE" ]]; then
    log_event "pause" "kill_switch"
    exit 0
  fi
  validate_config
  acquire_lock
  require_tools
  rc=0
  select_candidate || rc=$?
  if [[ "$rc" -eq 10 ]]; then
    exit 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
  if already_deployed "$CANDIDATE"; then
    log_event "noop" "ja_deployado" "$CANDIDATE"
    exit 0
  fi
  if failed_same "$CANDIDATE"; then
    log_event "skip_failed" "aguardar_correcao" "$CANDIDATE"
    exit 0
  fi
  SHORT="sha-${CANDIDATE:0:7}"
  rc=0
  app_digest="$(resolve_digest "diogenesmendes01/erp-genius" "$SHORT")" || rc=$?
  if [[ "$rc" -eq 10 ]]; then
    log_event "digest" "ausente" "$CANDIDATE"
    exit 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
  rc=0
  mig_digest="$(resolve_digest "diogenesmendes01/erp-genius/migrate" "$SHORT")" || rc=$?
  if [[ "$rc" -eq 10 ]]; then
    log_event "digest" "ausente" "$CANDIDATE"
    exit 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    exit "$rc"
  fi
  verify_one "${APP_IMAGE_REPO}@${app_digest}" "$CANDIDATE" "$app_digest"
  verify_one "${MIGRATE_IMAGE_REPO}@${mig_digest}" "$CANDIDATE" "$mig_digest"
  backup_db "$CANDIDATE"
  guard_migration_contract
  coolify_ler_imagens
  coolify_set APP_MIGRATE_IMAGE "${MIGRATE_IMAGE_REPO}@${mig_digest}"
  if ! run_migrate "${MIGRATE_IMAGE_REPO}@${mig_digest}"; then
    log_event "migrate" "falhou" "$CANDIDATE" "$app_digest" "$mig_digest"
    if ref_migrate_valida "$PREV_MIG"; then
      coolify_set APP_MIGRATE_IMAGE "$PREV_MIG"
    else
      log_event "migrate" "sem_ref_anterior_valida" "$CANDIDATE"
    fi
    exit 1
  fi
  coolify_set APP_IMAGE "${APP_IMAGE_REPO}@${app_digest}"
  if ! coolify_deploy; then
    log_event "deploy" "coolify_falhou" "$CANDIDATE" "$app_digest" "$mig_digest"
    write_json_atomic "$DEPLOYER_FAILED_FILE" "$CANDIDATE" "$app_digest" "$mig_digest" "deploy_fail"
    rollback_or_note "$CANDIDATE"
    exit 1
  fi
  if ! wait_healthy "$CANDIDATE"; then
    log_event "health" "falhou" "$CANDIDATE" "$app_digest" "$mig_digest"
    write_json_atomic "$DEPLOYER_FAILED_FILE" "$CANDIDATE" "$app_digest" "$mig_digest" "health_fail"
    rollback_or_note "$CANDIDATE"
    exit 1
  fi
  write_json_atomic "$DEPLOYER_STATE_FILE" "$CANDIDATE" "$app_digest" "$mig_digest" "success"
  log_event "deploy" "success" "$CANDIDATE" "$app_digest" "$mig_digest"
  notify_line "$LAST_LOG"
}

main "$@"
