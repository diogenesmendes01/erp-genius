# Runbook · deployer pull da UAT

Agente em `ops/deployer` que, na VPS, busca o commit mais novo da `main` com os 5 checks verdes, confere a attestation dos dois digests e só então faz backup, migrate e redeploy do serviço Coolify `thpvwxk6figfp347ajznvzhl`. O CI não recebe token do Coolify nem chave SSH.

A Fase 2 (produção) fica fora deste runbook.

## Quando ligar o timer

Não habilite `erp-deployer.timer` antes do merge da PR-A (migrations expand-only) e da PR-B (`image.yml` com attestation). Sem attestation o deployer aborta, de propósito. `install.sh` copia as unidades e não chama `systemctl enable`.

O intervalo é `OnUnitInactiveSec=90s` (entre 1 e 2 minutos). O orçamento do health é 30 tentativas de 5 segundos. Backup, migrate e esse health cabem na meta de menos de 15 minutos do merge até a UAT quando a `main` já está verde.

## Instalação

Como root, no checkout deste repositório:

```bash
./ops/deployer/install.sh
```

Isso cria o usuário de sistema `deployer` com shell `/usr/sbin/nologin` (sem login), os diretórios `/var/lib/erp-deployer` e `/var/backups/erp-deployer` em `0700`, e `/etc/erp-deployer/env` em `0600` se ainda não existir. O diretório `/etc/erp-deployer` fica `0750` `root:deployer`.

O script instalado em `/opt/erp-deployer` é do root e não é gravável pelo `deployer`. O `PATH` do processo é fixo (`/usr/bin` e vizinhos). O arquivo de env não pode trocar `PATH`, `LD_PRELOAD` nem o UUID do app: chaves fora da lista são ignoradas.

Para o `docker run` da imagem de migrate, o usuário precisa do grupo `docker` (equivalente a root no daemon). A mitigação é o binário root-owned, `NoNewPrivileges=yes` e o pin por digest já atestado. Só então:

```bash
WITH_DOCKER_GROUP=1 ./ops/deployer/install.sh
```

Preencha `/etc/erp-deployer/env` (modo `0600`, dono `deployer:deployer`). Não há segredo de deploy no GitHub. Exemplo sem valores: `ops/deployer/env.example`.

| Variável | Função |
| --- | --- |
| `COOLIFY_TOKEN` | Token com deploy e escrita de env só deste app |
| `COOLIFY_BASE_URL` | Só `localhost` ou IP privado. A API não sai da rede interna |
| `GHCR_TOKEN` | `read:packages`, para resolver o digest no GHCR |
| `APP_BASE_URL` | Origem do app, sem path, para `/api/health` e `/api/ready` |
| `DATABASE_URL` | Postgres alcançável pelo host, usado no `pg_dump` |
| `MIGRATE_DATABASE_URL` | Opcional. URL vista de dentro da rede do compose (`db`) |
| `DOCKER_NETWORK` | Rede onde o serviço `db` responde |
| `BACKUP_RETENTION_DAYS` | Retenção dos dumps (padrão 14) |
| `DEPLOY_NOTIFY_URL` | Opcional. `https://` para o aviso. Falha de aviso não desfaz o deploy |

`DATABASE_URL` do host e a URL interna do container costumam ser diferentes. O `pg_dump` roda no host; o `prisma migrate deploy` roda na imagem atestada, com `MIGRATE_DATABASE_URL` quando o host do banco é o DNS do compose.

### Escopo do token do Coolify

O script só chama `PATCH /api/v1/services/thpvwxk6figfp347ajznvzhl/envs` e `POST /api/v1/deploy?uuid=thpvwxk6figfp347ajznvzhl`, e só se a base for localhost ou RFC1918. Um `COOLIFY_APP_UUID` diferente no ambiente aborta.

Se o Coolify não tiver escopo por app, crie um time dedicado que contenha somente o serviço `thpvwxk6figfp347ajznvzhl` e emita o token nesse time. Esta é a limitação conhecida: o produto pode não isolar o token num único app, e o time dedicado é o controle compensatório. Não reutilize o token de outro ambiente.

## O que cada tick faz

1. Se existir `/etc/erp-deployer/PAUSE`, sai sem deploy.
2. `flock -n` em `/var/lib/erp-deployer/deploy.lock`. Sem o lock, sai com código 0 (outro tick está no meio).
3. Lê a ponta da `main`. Se os 5 checks ainda não fecharam, espera. Se a ponta está verde, ela é o único candidato (latest-wins: dois merges seguidos viram um deploy, o do commit mais novo). Se a ponta falhou de vez, usa o ancestral verde mais novo.
4. Resolve os digests `sha-<7>` de `ghcr.io/diogenesmendes01/erp-genius` e `.../migrate`. Imagem ainda não publicada: sai 0 e tenta de novo. Digest fora de `^sha256:[a-f0-9]{64}$` aborta.
5. Para os dois digests, sem `|| true` e com `set -euo pipefail`:

```bash
gh attestation verify "oci://<imagem>@<digest>" \
  --repo diogenesmendes01/erp-genius \
  --signer-workflow .github/workflows/image.yml \
  --format json
```

O JSON tem de trazer o commit-alvo e `refs/heads/main`. Rede, timeout (`timeout 60`), `gh` ausente, saída vazia ou commit diferente abortam. Não há deploy.

6. `pg_dump` custom, arquivo `0600`, `sha256sum` ao lado, retenção de N dias. Falhou ou checksum não confere: aborta antes de qualquer PATCH.
7. Grava só `APP_MIGRATE_IMAGE` e roda `npx prisma migrate deploy` na imagem atestada. Se o migrate falha, a `APP_MIGRATE_IMAGE` anterior (se for digest válido) é restaurada. `APP_IMAGE` não muda e não há redeploy.
8. Grava `APP_IMAGE` e faz `POST /api/v1/deploy`.
9. `/api/health` precisa devolver o SHA do commit e `/api/ready` precisa responder 200.
10. Só então o state `/var/lib/erp-deployer/state.json` é gravado em `0600`, com arquivo temporário no mesmo diretório e `mv -f` (rename atômico).

Log JSON em stderr e em `/var/lib/erp-deployer/deploy.log`: `event`, `result`, `sha`, `app_digest`, `migrate_digest`, `duration_ms`. O token, o `DATABASE_URL` e o restante dos envs do Coolify não entram no log. O aviso HTTP é o mesmo JSON.

Os 5 checks são os jobs atuais do `image.yml`: `typecheck`, `lint`, `test (UTC)`, `test (America/Sao_Paulo)`, `build Next.js`.

## Rollback

Falha de health ou ready depois do redeploy: o script lê o state anterior e restaura `APP_IMAGE` e `APP_MIGRATE_IMAGE`, depois redeploya. Não há `pg_restore`, `prisma migrate reset`, `prisma db push` nem down-migration no código.

Em seguida grava `/var/lib/erp-deployer/state.json.failed` com o SHA que falhou, para o timer não repetir o mesmo commit e ficar derrubando a UAT. Para tentar de novo o mesmo SHA, apague esse arquivo com o agente pausado. Um commit mais novo da `main` é avaliado normalmente.

No primeiro deploy ainda não existe state. Se o health falhar, não há digest anterior para voltar. Pause o agente e use o restore manual abaixo, ou publique um commit de correção.

## Kill switch

```bash
touch /etc/erp-deployer/PAUSE
systemctl stop erp-deployer.service
```

Enquanto o arquivo existir, o tick sai 0 e não chama Coolify, GHCR nem `pg_dump`. Para voltar:

```bash
rm /etc/erp-deployer/PAUSE
```

O unit tem `ProtectSystem=strict`: o `deployer` não grava em `/etc`. Quem cria e apaga o `PAUSE` é o root.

## Restore manual do banco

O deployer não restaura o banco. Este passo é humano, depois do kill switch.

1. Pause o agente e pare um tick que ainda esteja rodando (`systemctl stop erp-deployer.service`).
2. Escolha o dump em `/var/backups/erp-deployer/` e confira o checksum no mesmo diretório:

```bash
cd /var/backups/erp-deployer
sha256sum -c NOME.dump.sha256
```

3. Combine uma janela. O `pg_restore` abaixo é manual e destrutivo para os objetos que o dump cobre. O exemplo usa as variáveis do host, sem gravar a senha no histórico se você usar um `pgpass` `0600`:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /var/backups/erp-deployer/NOME.dump
```

4. Confira `/api/health` (SHA esperado) e `/api/ready` (200).
5. Só então apague `/etc/erp-deployer/PAUSE`.

## Unidade systemd

`erp-deployer.service`: `User=deployer`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `UMask=0077`, `ReadWritePaths=/var/lib/erp-deployer /var/backups/erp-deployer`. Não há socket do Docker em `ReadWritePaths`. O acesso ao daemon, se necessário, vem do grupo `docker` documentado acima.

Habilitar, só depois da PR-A e da PR-B:

```bash
systemctl daemon-reload
systemctl enable --now erp-deployer.timer
```

Acompanhe `journalctl -u erp-deployer.service` e `/var/lib/erp-deployer/deploy.log`.

## Dependências na VPS

`gh` (com `gh attestation verify`), `curl`, `python3`, `pg_dump` (cliente PostgreSQL), `docker`, `sha256sum`, `flock`, `timeout`, `find`.
