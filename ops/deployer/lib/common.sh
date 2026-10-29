#!/usr/bin/env bash
# Constantes, validação e HTTP. Sem segredo em stdout.
set -euo pipefail

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf 'arquivo só para source\n' >&2
  exit 1
fi

DEPLOYER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GITHUB_REPO="diogenesmendes01/erp-genius"
SIGNER_WORKFLOW=".github/workflows/image.yml"
APP_IMAGE_REPO="ghcr.io/diogenesmendes01/erp-genius"
MIGRATE_IMAGE_REPO="ghcr.io/diogenesmendes01/erp-genius/migrate"
COOLIFY_APP_UUID_FIXO="thpvwxk6figfp347ajznvzhl"
DIGEST_RE='^sha256:[a-f0-9]{64}$'
SHA_RE='^[a-f0-9]{40}$'
SAFE_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ci.yml repete typecheck, lint e test (tz). O nome do job fica intacto por causa
# da regra de proteção. checks_verdict trata nome duplicado como fail-closed.
REQUIRED_CHECKS=(
  "typecheck"
  "lint"
  "test (UTC)"
  "test (America/Sao_Paulo)"
  "build Next.js"
)

die() {
  printf 'deployer: %s\n' "$1" >&2
  exit 1
}

log_event() {
  local event="$1" result="$2" sha="${3:-}" app="${4:-}" mig="${5:-}"
  local line redacted now
  if [[ -n "${START_MS:-}" ]]; then
    DURATION_MS="$(( $(date +%s%3N) - START_MS ))"
  fi
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  line="$(printf '{"ts":"%s","event":"%s","result":"%s","sha":"%s","app_digest":"%s","migrate_digest":"%s","duration_ms":%s}' \
    "$now" "$event" "$result" "$sha" "$app" "$mig" "${DURATION_MS:-0}")"
  if ! redacted="$(printf '%s' "$line" | run_allow COOLIFY_TOKEN GHCR_TOKEN GH_TOKEN DATABASE_URL MIGRATE_DATABASE_URL SMOKE_COOKIE DEPLOY_NOTIFY_TOKEN -- python3 "${DEPLOYER_ROOT}/lib/py/redact.py")"; then
    redacted='{"event":"log_redact_failed"}'
  fi
  LAST_LOG="$redacted"
  printf '%s\n' "$redacted" >&2
  if [[ -n "${DEPLOYER_LOG_FILE:-}" ]]; then
    if ! printf '%s\n' "$redacted" >> "${DEPLOYER_LOG_FILE}"; then
      printf 'deployer: não foi possível gravar o log\n' >&2
    fi
  fi
}

assert_digest() {
  [[ "$1" =~ $DIGEST_RE ]] || die "digest inválido"
}

assert_sha() {
  [[ "$1" =~ $SHA_RE ]] || die "sha inválido"
}

assert_token() {
  local name="$1" value="$2"
  [[ "$value" =~ ^[A-Za-z0-9._~+/=-]{16,}$ ]] || die "${name} ausente ou inválido"
}

is_private_ipv4() {
  local ip="$1" a b c d
  [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  a="${BASH_REMATCH[1]}"
  b="${BASH_REMATCH[2]}"
  c="${BASH_REMATCH[3]}"
  d="${BASH_REMATCH[4]}"
  if (( 10#$a > 255 || 10#$b > 255 || 10#$c > 255 || 10#$d > 255 )); then
    return 1
  fi
  if (( 10#$a == 10 || 10#$a == 127 )); then
    return 0
  fi
  if (( 10#$a == 192 && 10#$b == 168 )); then
    return 0
  fi
  if (( 10#$a == 172 && 10#$b >= 16 && 10#$b <= 31 )); then
    return 0
  fi
  return 1
}

assert_coolify_base_url() {
  local url="$1" hostport host port
  [[ "$url" =~ ^https?://([^/@[:space:]]+)$ ]] || die "COOLIFY_BASE_URL rejeitada"
  hostport="${BASH_REMATCH[1]}"
  if [[ "$hostport" == "localhost" || "$hostport" == "::1" ]]; then
    COOLIFY_BASE_URL="$url"
    return 0
  fi
  if [[ "$hostport" == *:*:* ]]; then
    die "COOLIFY_BASE_URL rejeitada"
  fi
  host="$hostport"
  if [[ "$hostport" == *:* ]]; then
    host="${hostport%%:*}"
    port="${hostport##*:}"
    [[ "$port" =~ ^[0-9]{1,5}$ ]] || die "COOLIFY_BASE_URL rejeitada"
    if (( 10#$port < 1 || 10#$port > 65535 )); then
      die "COOLIFY_BASE_URL rejeitada"
    fi
  fi
  if is_private_ipv4 "$host"; then
    COOLIFY_BASE_URL="$url"
    return 0
  fi
  die "COOLIFY_BASE_URL fora de localhost ou da rede interna"
}

assert_app_base_url() {
  local url="$1"
  [[ "$url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ ]] || die "APP_BASE_URL rejeitada"
  APP_BASE_URL="$url"
}

assert_smoke_cookie() {
  local value="$1" re='^[A-Za-z0-9._%+=/;:-]{16,}$'
  [[ "$value" =~ $re ]] || die "SMOKE_COOKIE ausente ou inválido"
}

assert_smoke_path() {
  local value="$1"
  [[ "$value" =~ ^/[A-Za-z0-9._~/-]+$ ]] || die "SMOKE_PATH inválido"
  [[ "$value" != *..* ]] || die "SMOKE_PATH inválido"
}

assert_notify_url() {
  local url="$1"
  [[ "$url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$ ]] || die "DEPLOY_NOTIFY_URL rejeitada"
}

http_header_file() {
  local line="$1" file=""
  file="$(secret_mktemp)" || return 1
  chmod 0600 "$file" || return 1
  printf '%s\n' "$line" > "$file" || return 1
  printf '%s' "$file"
}

http_code() {
  local method="$1" url="$2" body_out="$3" header_out="${4:-}" data_file="${5:-}" auth="${6:-}" accept="${7:-application/json}" extra="${8:-}"
  local -a args=()
  local -a temps=()
  local code="" header_file=""
  args+=(--silent --show-error --max-redirs 0 --proto "=http,https")
  args+=(--connect-timeout 10 --max-time 60)
  args+=(-o "$body_out" -w "%{http_code}" -X "$method")
  args+=(-H "Accept: ${accept}")
  if [[ -n "$header_out" ]]; then
    args+=(-D "$header_out")
  fi
  if [[ -n "$auth" ]]; then
    header_file="$(http_header_file "Authorization: Bearer ${auth}")" || return 1
    temps+=("$header_file")
    args+=(-H "@${header_file}")
  fi
  if [[ -n "$extra" ]]; then
    header_file="$(http_header_file "$extra")" || { rm -f "${temps[@]}"; return 1; }
    temps+=("$header_file")
    args+=(-H "@${header_file}")
  fi
  if [[ -n "$data_file" ]]; then
    args+=(-H "Content-Type: application/json" --data-binary "@${data_file}")
  fi
  args+=(--url "$url")
  if ! code="$(run_allow -- curl "${args[@]}")"; then
    if [[ "${#temps[@]}" -gt 0 ]]; then
      rm -f "${temps[@]}"
    fi
    return 1
  fi
  if [[ "${#temps[@]}" -gt 0 ]]; then
    rm -f "${temps[@]}"
  fi
  if [[ ! "$code" =~ ^[0-9]{3}$ ]]; then
    return 1
  fi
  printf '%s' "$code"
}

load_env_file() {
  local file="$1" key="" value="" mode="" owner="" raw=""
  [[ -f "$file" ]] || die "arquivo de segredos ausente: ${file}"
  mode="$(stat -c %a "$file")"
  if [[ "$mode" != "600" && "$mode" != "0600" ]]; then
    die "env sem modo 0600"
  fi
  if id deployer >/dev/null 2>&1; then
    owner="$(stat -c %U "$file")"
    if [[ "$owner" != "deployer" ]]; then
      die "env não pertence ao usuário deployer"
    fi
  fi
  raw="$(secret_mktemp)" || die "mktemp falhou"
  if ! run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/load_env.py" "$file" > "$raw"; then
    rm -f "$raw"
    die "env file inválido"
  fi
  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    case "$key" in
      COOLIFY_TOKEN|GHCR_TOKEN|COOLIFY_BASE_URL|APP_BASE_URL|DATABASE_URL|MIGRATE_DATABASE_URL|BACKUP_DIR|BACKUP_RETENTION_DAYS|DEPLOYER_STATE_FILE|DEPLOYER_LOCK_FILE|DEPLOYER_LOG_FILE|DEPLOYER_FAILED_FILE|DEPLOYER_PAUSE_FILE|HEALTH_ATTEMPTS|HEALTH_INTERVAL_SECONDS|DOCKER_NETWORK|DEPLOY_NOTIFY_URL|DEPLOY_NOTIFY_TOKEN|SMOKE_COOKIE|SMOKE_PATH)
        printf -v "$key" '%s' "$value"
        case "$key" in
          COOLIFY_TOKEN|GHCR_TOKEN|DATABASE_URL|MIGRATE_DATABASE_URL|SMOKE_COOKIE|DEPLOY_NOTIFY_TOKEN)
            export -n "${key?}"
            ;;
          *)
            export "${key?}"
            ;;
        esac
        ;;
      *)
        die "chave de env inesperada"
        ;;
    esac
  done < "$raw"
  rm -f "$raw"
}

pin_path() {
  local tool_root="${1:-}"
  PATH="$SAFE_PATH"
  if [[ -n "$tool_root" && "$tool_root" == /* && -d "$tool_root" ]]; then
    PATH="${tool_root}:${PATH}"
  fi
  export PATH
}

init_secret_tmp() {
  if [[ -n "${SECRET_TMP_DIR:-}" && -d "$SECRET_TMP_DIR" ]]; then
    return 0
  fi
  SECRET_TMP_DIR="$(mktemp -d)" || return 1
  chmod 0700 "$SECRET_TMP_DIR" || return 1
}

secret_mktemp() {
  init_secret_tmp || return 1
  mktemp "${SECRET_TMP_DIR}/sec.XXXXXX"
}

cleanup_secret_tmp() {
  if [[ "${BASH_SUBSHELL:-0}" -ne 0 ]]; then
    return 0
  fi
  if [[ -n "${SECRET_TMP_DIR:-}" && "$SECRET_TMP_DIR" == /* && -d "$SECRET_TMP_DIR" ]]; then
    rm -rf "$SECRET_TMP_DIR"
    SECRET_TMP_DIR=""
  fi
}

on_secret_signal() {
  local code="$1"
  if [[ "${BASH_SUBSHELL:-0}" -eq 0 ]]; then
    cleanup_secret_tmp
  fi
  exit "$code"
}

trap cleanup_secret_tmp EXIT
trap 'on_secret_signal 130' INT
trap 'on_secret_signal 143' TERM

if ! init_secret_tmp; then
  printf 'deployer: mktemp falhou\n' >&2
  exit 1
fi

run_allow() {
  local -a keys=()
  local envfile="" k="" rc=0
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    keys+=("$1")
    shift
  done
  if [[ "${1:-}" != "--" ]]; then
    printf 'deployer: run_allow sem comando\n' >&2
    return 1
  fi
  shift
  envfile="$(secret_mktemp)" || return 1
  chmod 0600 "$envfile" || return 1
  {
    printf 'PATH=%q\n' "$PATH"
    printf 'HOME=%q\n' "${HOME:-/}"
    printf 'LANG=%q\n' "${LANG:-C.UTF-8}"
    printf 'TZ=%q\n' "${TZ:-UTC}"
    printf 'TMPDIR=%q\n' "${TMPDIR:-/tmp}"
    if [[ -n "${MOCK_DIR:-}" ]]; then
      printf 'MOCK_DIR=%q\n' "$MOCK_DIR"
    fi
    if [[ -n "${LC_ALL:-}" ]]; then
      printf 'LC_ALL=%q\n' "$LC_ALL"
    fi
    if [[ "${#keys[@]}" -gt 0 ]]; then
      for k in "${keys[@]}"; do
        if [[ -n "${!k+x}" ]]; then
          printf '%s=%q\n' "$k" "${!k}"
        fi
      done
    fi
  } > "$envfile" || return 1
  # shellcheck disable=SC2016
  env -i PATH="$PATH" bash --noprofile --norc -c 'set -a; source "$1"; set +a; shift; exec "$@"' _ "$envfile" "$@" || rc=$?
  rm -f "$envfile"
  return "$rc"
}

# Contrato lido por bin/deploy.sh e lib/steps.sh.
: "${GITHUB_REPO}${SIGNER_WORKFLOW}${APP_IMAGE_REPO}${MIGRATE_IMAGE_REPO}${COOLIFY_APP_UUID_FIXO}${REQUIRED_CHECKS[0]}${LAST_LOG:-}${COOLIFY_BASE_URL:-}${APP_BASE_URL:-}"
