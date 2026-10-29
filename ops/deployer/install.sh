#!/usr/bin/env bash
# Instala unidades e diretórios. Não habilita o timer e não grava segredo.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${PREFIX:-/opt/erp-deployer}"
ETC="${ETC:-/etc/erp-deployer}"
STATE="${STATE:-/var/lib/erp-deployer}"
BACKUP="${BACKUP:-/var/backups/erp-deployer}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SYSUSERS_DIR="${SYSUSERS_DIR:-/usr/lib/sysusers.d}"

if [[ "$(id -u)" -ne 0 && -z "${DESTDIR:-}" ]]; then
  printf 'install.sh precisa de root, ou de DESTDIR para um ensaio local\n' >&2
  exit 1
fi

base="${DESTDIR:-}"
install -d -m 0755 "${base}${PREFIX}/bin" "${base}${PREFIX}/lib/py" "${base}/usr/local/sbin"
install -d -m 0750 "${base}${ETC}"
install -d -m 0700 "${base}${STATE}" "${base}${BACKUP}"
install -d -m 0755 "${base}${SYSTEMD_DIR}" "${base}${SYSUSERS_DIR}"

install -m 0755 "${ROOT}/bin/deploy.sh" "${base}${PREFIX}/bin/deploy.sh"
install -m 0755 "${ROOT}/bin/erp-deployer" "${base}/usr/local/sbin/erp-deployer"
for f in "${ROOT}/lib/"*.sh; do
  install -m 0644 "$f" "${base}${PREFIX}/lib/$(basename "$f")"
done
for f in "${ROOT}/lib/py/"*.py; do
  install -m 0644 "$f" "${base}${PREFIX}/lib/py/$(basename "$f")"
done
install -m 0644 "${ROOT}/systemd/erp-deployer.service" "${base}${SYSTEMD_DIR}/erp-deployer.service"
install -m 0644 "${ROOT}/systemd/erp-deployer.timer" "${base}${SYSTEMD_DIR}/erp-deployer.timer"
install -m 0644 "${ROOT}/systemd/erp-deployer.sysusers" "${base}${SYSUSERS_DIR}/erp-deployer.conf"

if [[ ! -f "${base}${ETC}/env" ]]; then
  install -m 0600 "${ROOT}/env.example" "${base}${ETC}/env"
fi
chmod 0600 "${base}${ETC}/env"

if [[ -z "${DESTDIR:-}" ]]; then
  if ! id deployer >/dev/null 2>&1; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$STATE" --no-create-home --user-group deployer
  fi
  chown deployer:deployer "${ETC}/env" "$STATE" "$BACKUP"
  chown root:deployer "$ETC"
  if [[ "${WITH_DOCKER_GROUP:-}" == "1" ]]; then
    usermod -aG docker deployer
  fi
fi

printf 'Arquivos instalados. O timer não foi habilitado: só ligue depois do merge da PR-A e da PR-B.\n'
