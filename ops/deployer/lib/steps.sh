#!/usr/bin/env bash
# Passos do deploy. Funções chamadas sob `if` não dependem de `set -e`.
set -euo pipefail

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf 'arquivo só para source\n' >&2
  exit 1
fi

if [[ -z "${DEPLOYER_ROOT:-}" ]]; then
  # shellcheck source=common.sh
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
fi

record_check() {
  local name="$1" status="$2" conclusion="$3" prev="" pstatus="" pconclusion=""
  # shellcheck disable=SC2154
  prev="${seen[$name]:-}"
  if [[ -z "$prev" ]]; then
    seen["$name"]="${status} ${conclusion}"
    return 0
  fi
  pstatus="${prev%% *}"
  pconclusion="${prev#* }"
  if [[ "$pstatus" != "completed" || "$status" != "completed" ]]; then
    seen["$name"]="in_progress "
    return 0
  fi
  if [[ "$pconclusion" != "success" || "$conclusion" != "success" ]]; then
    seen["$name"]="completed failure"
    return 0
  fi
  seen["$name"]="completed success"
}

checks_verdict() {
  local sha="$1" tsv name status conclusion req state any_pending any_failure
  assert_sha "$sha"
  if ! tsv="$(run_allow GH_TOKEN -- gh api --paginate --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv' \
      "repos/${GITHUB_REPO}/commits/${sha}/check-runs")"; then
    return 1
  fi
  local -A seen=()
  while IFS=$'\t' read -r name status conclusion; do
    [[ -n "$name" ]] || continue
    record_check "$name" "$status" "$conclusion"
  done <<< "$tsv"
  any_pending=0
  any_failure=0
  for req in "${REQUIRED_CHECKS[@]}"; do
    if [[ -z "${seen[$req]:-}" ]]; then
      any_pending=1
      continue
    fi
    state="${seen[$req]}"
    status="${state%% *}"
    conclusion="${state#* }"
    if [[ "$status" != "completed" ]]; then
      any_pending=1
      continue
    fi
    if [[ "$conclusion" != "success" ]]; then
      any_failure=1
    fi
  done
  if [[ "$any_pending" == "1" ]]; then
    printf 'pending\n'
    return 0
  fi
  if [[ "$any_failure" == "1" ]]; then
    printf 'failure\n'
    return 0
  fi
  printf 'success\n'
}

select_candidate() {
  local list="" s="" tip="" verdict="" i=0 sha=""
  local -a shas=()
  if ! list="$(run_allow GH_TOKEN -- gh api --jq '.[].sha' "repos/${GITHUB_REPO}/commits?per_page=20&sha=main")"; then
    die "falha ao ler a main"
  fi
  [[ -n "$list" ]] || die "main sem commits"
  while IFS= read -r s; do
    [[ -n "$s" ]] || continue
    assert_sha "$s"
    shas+=("$s")
  done <<< "$list"
  [[ "${#shas[@]}" -gt 0 ]] || die "main sem commits"
  tip="${shas[0]}"
  if ! verdict="$(checks_verdict "$tip")"; then
    die "falha ao ler os checks"
  fi
  if [[ "$verdict" == "pending" ]]; then
    log_event "checks" "pendente" "$tip"
    return 10
  fi
  if [[ "$verdict" == "success" ]]; then
    CANDIDATE="$tip"
    return 0
  fi
  i=1
  while [[ "$i" -lt "${#shas[@]}" ]]; do
    sha="${shas[$i]}"
    if ! verdict="$(checks_verdict "$sha")"; then
      die "falha ao ler os checks"
    fi
    if [[ "$verdict" == "pending" ]]; then
      log_event "checks" "pendente" "$sha"
      return 10
    fi
    if [[ "$verdict" == "success" ]]; then
      CANDIDATE="$sha"
      return 0
    fi
    i=$((i + 1))
  done
  log_event "checks" "nenhum_verde" "$tip"
  return 10
}

resolve_digest() {
  local repo_path="$1" tag="$2" body="" headers="" code="" digest=""
  if [[ "$repo_path" != "diogenesmendes01/erp-genius" && "$repo_path" != "diogenesmendes01/erp-genius/migrate" ]]; then
    die "repositório de imagem não permitido"
  fi
  [[ "$tag" =~ ^sha-[a-f0-9]{7}$ ]] || die "tag inválida"
  body="$(mktemp)" || die "mktemp falhou"
  headers="$(mktemp)" || die "mktemp falhou"
  if ! code="$(http_code GET "https://ghcr.io/v2/${repo_path}/manifests/${tag}" "$body" "$headers" "" "$GHCR_TOKEN" "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json")"; then
    rm -f "$body" "$headers"
    die "falha de rede no GHCR"
  fi
  rm -f "$body"
  if [[ "$code" == "404" ]]; then
    rm -f "$headers"
    return 10
  fi
  if [[ "$code" != "200" ]]; then
    rm -f "$headers"
    die "GHCR respondeu ${code}"
  fi
  digest="$(awk 'tolower($1)=="docker-content-digest:" {print tolower($2); exit}' "$headers" | tr -d '\r')"
  rm -f "$headers"
  assert_digest "$digest"
  printf '%s\n' "$digest"
}

verify_one() {
  local image_ref="$1" expected_sha="$2" expected_digest="$3" out=""
  assert_sha "$expected_sha"
  assert_digest "$expected_digest"
  if [[ "$image_ref" != "${APP_IMAGE_REPO}@${expected_digest}" && "$image_ref" != "${MIGRATE_IMAGE_REPO}@${expected_digest}" ]]; then
    die "ref de imagem não permitida"
  fi
  if ! out="$(run_allow GH_TOKEN -- timeout 60 gh attestation verify "oci://${image_ref}" \
      --repo "$GITHUB_REPO" \
      --signer-workflow "$SIGNER_WORKFLOW" \
      --format json)"; then
    die "attestation falhou"
  fi
  if [[ -z "${out//[[:space:]]/}" ]]; then
    die "attestation saída vazia"
  fi
  if ! printf '%s' "$out" | EXPECTED_SHA="$expected_sha" EXPECTED_DIGEST="$expected_digest" \
      run_allow EXPECTED_SHA EXPECTED_DIGEST -- \
      python3 "${DEPLOYER_ROOT}/lib/py/attest_check.py"; then
    die "attestation não confere com o commit da main"
  fi
}

backup_db() {
  local sha="$1" stamp="" file="" pgpass="" meta="" host="" port="" user="" db="" base=""
  assert_sha "$sha"
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL ausente"
  [[ "${BACKUP_RETENTION_DAYS}" =~ ^[1-9][0-9]*$ ]] || die "BACKUP_RETENTION_DAYS inválido"
  mkdir -p "$BACKUP_DIR" || die "não foi possível criar o diretório de backup"
  chmod 0700 "$BACKUP_DIR" || die "não foi possível proteger o diretório de backup"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="${BACKUP_DIR}/${stamp}-${sha}.dump"
  pgpass="$(secret_mktemp)" || die "mktemp falhou"
  chmod 0600 "$pgpass" || die "pgpass sem 0600"
  if ! meta="$(run_allow DATABASE_URL -- python3 "${DEPLOYER_ROOT}/lib/py/pgpass.py" "$pgpass")"; then
    rm -f "$pgpass"
    die "DATABASE_URL inválida"
  fi
  host="$(printf '%s\n' "$meta" | sed -n '1p')"
  port="$(printf '%s\n' "$meta" | sed -n '2p')"
  user="$(printf '%s\n' "$meta" | sed -n '3p')"
  db="$(printf '%s\n' "$meta" | sed -n '4p')"
  if [[ ! "$host" =~ ^[A-Za-z0-9._-]+$ || ! "$port" =~ ^[0-9]+$ || ! "$user" =~ ^[A-Za-z0-9._-]+$ || ! "$db" =~ ^[A-Za-z0-9._-]+$ ]]; then
    rm -f "$pgpass"
    die "DATABASE_URL com campos não utilizáveis"
  fi
  if ! PGPASSFILE="$pgpass" run_allow PGPASSFILE -- pg_dump --format=custom --no-password --file "$file" -h "$host" -p "$port" -U "$user" -d "$db"; then
    rm -f "$pgpass" "$file"
    printf 'deployer: pg_dump falhou\n' >&2
    return 1
  fi
  rm -f "$pgpass"
  if [[ ! -s "$file" ]]; then
    rm -f "$file"
    printf 'deployer: dump vazio\n' >&2
    return 1
  fi
  chmod 0600 "$file" || die "dump sem 0600"
  base="$(basename "$file")"
  if ! ( cd "$BACKUP_DIR" && run_allow -- sha256sum "$base" > "${base}.sha256" ); then
    printf 'deployer: não foi possível calcular o checksum\n' >&2
    return 1
  fi
  chmod 0600 "${file}.sha256" || die "checksum sem 0600"
  if ! ( cd "$BACKUP_DIR" && run_allow -- sha256sum -c "${base}.sha256" >/dev/null ); then
    printf 'deployer: checksum do dump não confere\n' >&2
    return 1
  fi
  if ! run_allow -- pg_restore --list "$file" >/dev/null; then
    printf 'deployer: pg_restore --list falhou\n' >&2
    return 1
  fi
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sha256' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
}

ref_app_valida() {
  local value="$1" digest=""
  digest="${value#"${APP_IMAGE_REPO}@"}"
  [[ "$value" == "${APP_IMAGE_REPO}@${digest}" ]] || return 1
  [[ "$digest" =~ $DIGEST_RE ]] || return 1
  return 0
}

ref_migrate_valida() {
  local value="$1" digest=""
  digest="${value#"${MIGRATE_IMAGE_REPO}@"}"
  [[ "$value" == "${MIGRATE_IMAGE_REPO}@${digest}" ]] || return 1
  [[ "$digest" =~ $DIGEST_RE ]] || return 1
  return 0
}

coolify_set() {
  local key="$1" value="$2" body="" resp="" code=""
  case "$key" in
    APP_IMAGE)
      ref_app_valida "$value" || die "APP_IMAGE inválida"
      ;;
    APP_MIGRATE_IMAGE)
      ref_migrate_valida "$value" || die "APP_MIGRATE_IMAGE inválida"
      ;;
    *)
      die "chave de env não permitida"
      ;;
  esac
  body="$(mktemp)" || die "mktemp falhou"
  resp="$(mktemp)" || die "mktemp falhou"
  if ! ENV_KEY="$key" ENV_VALUE="$value" run_allow ENV_KEY ENV_VALUE -- python3 "${DEPLOYER_ROOT}/lib/py/json_env.py" > "$body"; then
    rm -f "$body" "$resp"
    die "não foi possível montar o env"
  fi
  if ! code="$(http_code PATCH "${COOLIFY_BASE_URL}/api/v1/services/${COOLIFY_APP_UUID_FIXO}/envs" "$resp" "" "$body" "$COOLIFY_TOKEN")"; then
    rm -f "$body" "$resp"
    die "Coolify indisponível"
  fi
  rm -f "$body" "$resp"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    die "Coolify recusou a escrita de env (${code})"
  fi
}

coolify_deploy() {
  local resp="" code=""
  resp="$(mktemp)" || return 1
  if ! code="$(http_code POST "${COOLIFY_BASE_URL}/api/v1/deploy?uuid=${COOLIFY_APP_UUID_FIXO}" "$resp" "" "" "$COOLIFY_TOKEN")"; then
    rm -f "$resp"
    return 1
  fi
  rm -f "$resp"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    return 1
  fi
}

coolify_ler_imagens() {
  local resp="" code="" parsed="" line=""
  resp="$(mktemp)" || die "mktemp falhou"
  if ! code="$(http_code GET "${COOLIFY_BASE_URL}/api/v1/services/${COOLIFY_APP_UUID_FIXO}/envs" "$resp" "" "" "$COOLIFY_TOKEN")"; then
    rm -f "$resp"
    die "Coolify indisponível na leitura"
  fi
  if [[ "$code" != "200" ]]; then
    rm -f "$resp"
    die "Coolify recusou a leitura de env (${code})"
  fi
  if ! parsed="$(run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/coolify_images.py" < "$resp")"; then
    rm -f "$resp"
    die "resposta de env do Coolify inválida"
  fi
  rm -f "$resp"
  PREV_APP=""
  PREV_MIG=""
  while IFS= read -r line; do
    case "$line" in
      "APP_IMAGE="*) PREV_APP="${line#APP_IMAGE=}" ;;
      "APP_MIGRATE_IMAGE="*) PREV_MIG="${line#APP_MIGRATE_IMAGE=}" ;;
    esac
  done <<< "$parsed"
}

run_migrate() {
  local image="$1" digest="" envfile="" rc=0
  local -a db_env=()
  local -a net=()
  digest="${image#"${MIGRATE_IMAGE_REPO}@"}"
  [[ "$image" == "${MIGRATE_IMAGE_REPO}@${digest}" ]] || die "imagem de migrate inválida"
  assert_digest "$digest"
  if [[ -n "${DOCKER_NETWORK:-}" ]]; then
    [[ "${DOCKER_NETWORK}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$ ]] || die "DOCKER_NETWORK inválida"
    net=(--network "$DOCKER_NETWORK")
  fi
  if [[ -n "${MIGRATE_DATABASE_URL:-}" ]]; then
    [[ "${MIGRATE_DATABASE_URL}" =~ ^postgres(ql)?://[^[:space:]]+$ ]] || die "MIGRATE_DATABASE_URL inválida"
    envfile="$(secret_mktemp)" || return 1
    chmod 0600 "$envfile" || return 1
    printf 'DATABASE_URL=%s\n' "$MIGRATE_DATABASE_URL" > "$envfile" || return 1
    db_env=(--env-file "$envfile")
  else
    db_env=(-e DATABASE_URL)
  fi
  if ! run_allow -- docker pull "$image"; then
    if [[ -n "$envfile" ]]; then
      rm -f "$envfile"
    fi
    return 1
  fi
  if [[ -n "$envfile" ]]; then
    if [[ "${#net[@]}" -eq 0 ]]; then
      run_allow -- docker run --rm --pull never "${db_env[@]}" --entrypoint npx "$image" prisma migrate deploy || rc=$?
    else
      run_allow -- docker run --rm --pull never "${net[@]}" "${db_env[@]}" --entrypoint npx "$image" prisma migrate deploy || rc=$?
    fi
  elif [[ "${#net[@]}" -eq 0 ]]; then
    run_allow DATABASE_URL -- docker run --rm --pull never "${db_env[@]}" --entrypoint npx "$image" prisma migrate deploy || rc=$?
  else
    run_allow DATABASE_URL -- docker run --rm --pull never "${net[@]}" "${db_env[@]}" --entrypoint npx "$image" prisma migrate deploy || rc=$?
  fi
  if [[ -n "$envfile" ]]; then
    rm -f "$envfile"
  fi
  [[ "$rc" -eq 0 ]]
}

wait_healthy() {
  local sha="$1" i=1 body="" code="" got="" ready_body="" ready_code="" smoke_body="" smoke_code=""
  assert_sha "$sha"
  while [[ "$i" -le "$HEALTH_ATTEMPTS" ]]; do
    body="$(mktemp)" || die "mktemp falhou"
    code="000"
    if code="$(http_code GET "${APP_BASE_URL}/api/health" "$body" "" "" "")"; then
      :
    else
      code="000"
    fi
    got=""
    if [[ "$code" == "200" ]]; then
      if got="$(run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/health_sha.py" < "$body")"; then
        :
      else
        got=""
      fi
    fi
    rm -f "$body"
    ready_body="$(mktemp)" || die "mktemp falhou"
    ready_code="000"
    if ready_code="$(http_code GET "${APP_BASE_URL}/api/ready" "$ready_body" "" "" "")"; then
      :
    else
      ready_code="000"
    fi
    rm -f "$ready_body"
    smoke_body="$(mktemp)" || die "mktemp falhou"
    smoke_code="000"
    if smoke_code="$(http_code GET "${APP_BASE_URL}${SMOKE_PATH}" "$smoke_body" "" "" "" "application/json" "Cookie: ${SMOKE_COOKIE}")"; then
      :
    else
      smoke_code="000"
    fi
    rm -f "$smoke_body"
    if [[ "$got" == "$sha" && "$ready_code" == "200" && "$smoke_code" == "200" ]]; then
      return 0
    fi
    if [[ "$i" -lt "$HEALTH_ATTEMPTS" && "$HEALTH_INTERVAL_SECONDS" != "0" ]]; then
      sleep "$HEALTH_INTERVAL_SECONDS"
    fi
    i=$((i + 1))
  done
  return 1
}

write_json_atomic() {
  local dest="$1" sha="$2" app="$3" mig="$4" result="$5"
  local dir="" tmp=""
  assert_sha "$sha"
  assert_digest "$app"
  assert_digest "$mig"
  dir="$(dirname "$dest")"
  mkdir -p "$dir" || die "não foi possível criar o diretório de state"
  chmod 0700 "$dir" || die "diretório de state sem proteção"
  tmp="$(mktemp "${dir}/.state.XXXXXX")" || die "mktemp falhou"
  chmod 0600 "$tmp" || die "state temporário sem 0600"
  if ! STATE_SHA="$sha" STATE_APP="$app" STATE_MIG="$mig" STATE_RESULT="$result" \
      STATE_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      run_allow STATE_SHA STATE_APP STATE_MIG STATE_RESULT STATE_AT -- \
      python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" write > "$tmp"; then
    rm -f "$tmp"
    die "não foi possível gravar o state"
  fi
  mv -f "$tmp" "$dest" || die "rename do state falhou"
  chmod 0600 "$dest" || die "state sem 0600"
}

rollback_from_state() {
  local app="" mig="" app_ref="" mig_ref=""
  if [[ -f "$DEPLOYER_STATE_FILE" ]]; then
    if ! app="$(run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" read app_digest "$DEPLOYER_STATE_FILE")"; then
      die "state file ilegível"
    fi
    if ! mig="$(run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" read migrate_digest "$DEPLOYER_STATE_FILE")"; then
      die "state file ilegível"
    fi
    assert_digest "$app"
    assert_digest "$mig"
    mig_ref="${MIGRATE_IMAGE_REPO}@${mig}"
    app_ref="${APP_IMAGE_REPO}@${app}"
  elif ref_app_valida "${PREV_APP:-}" && ref_migrate_valida "${PREV_MIG:-}"; then
    app_ref="$PREV_APP"
    mig_ref="$PREV_MIG"
    app="${PREV_APP#"${APP_IMAGE_REPO}@"}"
    mig="${PREV_MIG#"${MIGRATE_IMAGE_REPO}@"}"
  else
    log_event "rollback" "sem_state"
    return 1
  fi
  coolify_set APP_MIGRATE_IMAGE "$mig_ref"
  coolify_set APP_IMAGE "$app_ref"
  if ! coolify_deploy; then
    log_event "rollback" "deploy_falhou" "" "$app" "$mig"
    return 1
  fi
  log_event "rollback" "ok" "" "$app" "$mig"
}

commit_has_contract() {
  local sha="$1" names="" name=""
  if [[ ! "$sha" =~ $SHA_RE ]]; then
    printf 'deployer: sha inválido no histórico\n' >&2
    return 2
  fi
  if ! names="$(run_allow GH_TOKEN -- gh api --jq '.[] | .labels[]?.name' "repos/${GITHUB_REPO}/commits/${sha}/pulls")"; then
    printf 'deployer: falha ao ler o label migration-contract\n' >&2
    return 2
  fi
  while IFS= read -r name; do
    if [[ "$name" == "migration-contract" ]]; then
      return 0
    fi
  done <<< "$names"
  return 1
}

append_shas() {
  local batch="$1" sha=""
  while IFS= read -r sha; do
    [[ -n "$sha" ]] || continue
    if [[ ! "$sha" =~ $SHA_RE ]]; then
      printf 'deployer: sha inválido no histórico\n' >&2
      return 1
    fi
    RANGE_SHAS+=("$sha")
    if [[ "${#RANGE_SHAS[@]}" -gt 250 ]]; then
      printf 'deployer: comparação de commits acima de 250\n' >&2
      return 1
    fi
  done <<< "$batch"
}

fetch_sha_pages() {
  local jq_expr="$1" url_base="$2"
  local page=1 batch="" before=0 added=0 sep="?"
  RANGE_SHAS=()
  if [[ "$url_base" == *\?* ]]; then
    sep="&"
  fi
  while [[ "$page" -le 5 ]]; do
    if ! batch="$(run_allow GH_TOKEN -- gh api --jq "$jq_expr" "${url_base}${sep}per_page=100&page=${page}")"; then
      printf 'deployer: histórico de migrations indisponível\n' >&2
      return 1
    fi
    if [[ -z "${batch//[[:space:]]/}" ]]; then
      break
    fi
    before="${#RANGE_SHAS[@]}"
    if ! append_shas "$batch"; then
      return 1
    fi
    added=$(( ${#RANGE_SHAS[@]} - before ))
    if [[ "$added" -lt 100 ]]; then
      break
    fi
    page=$((page + 1))
  done
}

reject_contract() {
  local rc=0
  commit_has_contract "$1" || rc=$?
  if [[ "$rc" -eq 0 ]]; then
    printf 'deployer: migration-contract exige deploy manual\n' >&2
    return 1
  fi
  if [[ "$rc" -ne 1 ]]; then
    return 1
  fi
  return 0
}

guard_migration_contract() {
  local sha="" prev=""
  if [[ ! -f "$DEPLOYER_STATE_FILE" ]]; then
    if ! fetch_sha_pages '.[].sha' "repos/${GITHUB_REPO}/commits?sha=main"; then
      return 1
    fi
    if [[ "${#RANGE_SHAS[@]}" -eq 0 ]]; then
      printf 'deployer: histórico de migrations indisponível\n' >&2
      return 1
    fi
  else
    if ! prev="$(run_allow -- python3 "${DEPLOYER_ROOT}/lib/py/state_io.py" read sha "$DEPLOYER_STATE_FILE")"; then
      printf 'deployer: state file ilegível\n' >&2
      return 1
    fi
    if [[ ! "$prev" =~ $SHA_RE ]]; then
      printf 'deployer: sha inválido no histórico\n' >&2
      return 1
    fi
    if [[ "$prev" == "$CANDIDATE" ]]; then
      RANGE_SHAS=()
    elif ! fetch_sha_pages '.commits[].sha' "repos/${GITHUB_REPO}/compare/${prev}...${CANDIDATE}"; then
      return 1
    fi
  fi
  if ! reject_contract "$CANDIDATE"; then
    return 1
  fi
  if [[ "${#RANGE_SHAS[@]}" -eq 0 ]]; then
    return 0
  fi
  for sha in "${RANGE_SHAS[@]}"; do
    if [[ "$sha" == "$CANDIDATE" ]]; then
      continue
    fi
    if ! reject_contract "$sha"; then
      return 1
    fi
  done
}

notify_line() {
  local line="$1" body="" resp="" code=""
  if [[ -z "${DEPLOY_NOTIFY_URL:-}" ]]; then
    return 0
  fi
  assert_notify_url "$DEPLOY_NOTIFY_URL"
  assert_token "DEPLOY_NOTIFY_TOKEN" "${DEPLOY_NOTIFY_TOKEN:-}"
  body="$(mktemp)" || die "mktemp falhou"
  resp="$(mktemp)" || die "mktemp falhou"
  printf '%s\n' "$line" > "$body"
  if code="$(http_code POST "$DEPLOY_NOTIFY_URL" "$resp" "" "$body" "$DEPLOY_NOTIFY_TOKEN")"; then
    if [[ "$code" != "200" && "$code" != "201" && "$code" != "202" && "$code" != "204" ]]; then
      log_event "notify" "http_${code}"
    fi
  else
    log_event "notify" "falhou"
  fi
  rm -f "$body" "$resp"
}

# CANDIDATE, PREV_APP, PREV_MIG e RANGE_SHAS são lidos pelos passos do deploy.
RANGE_SHAS=()
: "${CANDIDATE:-}${PREV_APP:-}${PREV_MIG:-}"
