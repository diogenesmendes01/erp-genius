# Runbook · deployer pull de produção

Agente em `ops/deployer` que, na VPS, busca o commit mais novo da `main` com os 5 checks verdes e com imagem publicada e atestada. Se a ponta não tiver imagem, usa a publicada e atestada mais recente entre os 20 commits mais novos. Confere a attestation dos dois digests e só então faz backup, migrate e redeploy do serviço Coolify `thpvwxk6figfp347ajznvzhl`. O CI não recebe token do Coolify nem chave SSH.

A prova de rollback no app isolado (`BLOCK-DEPLOY-10/11`) fica com o DEVOPS e não faz parte deste agente. O backup off-site (`BLOCK-12`) está pendente e depende do Mendes.

## Quando ligar o timer

Não habilite `erp-deployer.timer` antes do merge da PR-A (migrations expand-only) e da PR-B (`image.yml` com attestation), e só com OK explícito do Mendes. Sem attestation o deployer aborta, de propósito. `install.sh` copia as unidades e não chama `systemctl enable`.

O intervalo é `OnUnitInactiveSec=90s` (entre 1 e 2 minutos). O orçamento do health é 30 tentativas de 5 segundos.

## Instalação

Como root, no checkout deste repositório:

```bash
./ops/deployer/install.sh
```

Isso cria o usuário de sistema `deployer` com shell `/usr/sbin/nologin` (sem login), os diretórios `/var/lib/erp-deployer` e `/var/backups/erp-deployer` em `0700`, e `/etc/erp-deployer/env` em `0600` se ainda não existir. O diretório `/etc/erp-deployer` fica `0750` `root:deployer`. O comando `erp-deployer` fica em `/usr/local/sbin`.

O script instalado em `/opt/erp-deployer` é do root e não é gravável pelo `deployer`. O `PATH` do processo é fixo (`/usr/bin` e vizinhos). O arquivo de env não pode trocar `PATH`, `LD_PRELOAD` nem o UUID do app: chaves fora da lista são ignoradas. Cada processo filho recebe só a allowlist dele. `gh` recebe `GH_TOKEN`. `pg_dump` recebe o `PGPASSFILE`. O `docker run` da migrate recebe a URL por `--env-file` ou, se não houver `MIGRATE_DATABASE_URL`, só `DATABASE_URL`. Token, cookie e URL não entram no argv.

### Grupo docker

O grupo `docker` no daemon é equivalente a root. O `install.sh` não coloca o `deployer` nesse grupo. Só use isso se o `docker run` da imagem de migrate não tiver outro caminho, e aceite o risco:

```bash
WITH_DOCKER_GROUP=1 ./ops/deployer/install.sh
```

A mitigação que o unit já traz é o binário root-owned, `NoNewPrivileges=yes` e o pin por digest já atestado. Não há socket do Docker em `ReadWritePaths`.

Preencha `/etc/erp-deployer/env` (modo `0600`, dono `deployer:deployer`). Não há segredo de deploy no GitHub. Exemplo sem valores: `ops/deployer/env.example`.

| Variável | Função |
| --- | --- |
| `COOLIFY_TOKEN` | Token com deploy e escrita de env só deste app. Vai para o curl num arquivo de header `0600`, não no argv |
| `COOLIFY_BASE_URL` | Só `localhost` ou IP privado. A API não sai da rede interna |
| `GHCR_TOKEN` | PAT com `read:packages` e acesso de leitura ao repositório, para o GHCR e para o `gh`. O script exporta o mesmo valor como `GH_TOKEN` |
| `APP_BASE_URL` | Origem `https://` do app, sem path |
| `DATABASE_URL` | Postgres alcançável pelo host, usado no `pg_dump` |
| `MIGRATE_DATABASE_URL` | Opcional. URL vista de dentro da rede do compose (`db`). Entra no container por `--env-file` `0600` |
| `DOCKER_NETWORK` | Rede onde o serviço `db` responde |
| `SMOKE_COOKIE` | Cookie de sessão de um usuário técnico só de leitura |
| `SMOKE_PATH` | Rota autenticada. Padrão `/api/inbox/nao-lidas` |
| `BACKUP_RETENTION_DAYS` | Retenção dos dumps (padrão 14) |
| `DEPLOY_NOTIFY_URL` | Opcional. `https://` para o aviso. Exige `DEPLOY_NOTIFY_TOKEN` |
| `DEPLOY_NOTIFY_TOKEN` | Bearer do aviso. Sem ele o tick aborta se a URL estiver preenchida. Falha de aviso não desfaz o deploy |

`DATABASE_URL` do host e a URL interna do container costumam ser diferentes. O `pg_dump` roda no host; o `prisma migrate deploy` roda na imagem atestada.

### Escopo do token do Coolify

O script só chama `PATCH /api/v1/services/thpvwxk6figfp347ajznvzhl/envs` e `POST /api/v1/deploy?uuid=thpvwxk6figfp347ajznvzhl`, e só se a base for localhost ou RFC1918. Um `COOLIFY_APP_UUID` diferente no ambiente aborta.

Se o Coolify não tiver escopo por app, crie um time dedicado que contenha somente o serviço `thpvwxk6figfp347ajznvzhl` e emita o token nesse time. Esta é a limitação conhecida: o produto pode não isolar o token num único app, e o time dedicado é o controle compensatório. Não reutilize o token de outro ambiente.

## O que cada tick faz

1. Se existir `/etc/erp-deployer/PAUSE`, sai sem deploy.
2. `flock -n` em `/var/lib/erp-deployer/deploy.lock`. Sem o lock, sai com código 0 (outro tick está no meio).
3. Lê a ponta da `main`. Se os 5 checks ainda não fecharam, espera. Se a ponta está verde, ela é o único candidato (latest-wins: dois merges seguidos viram um deploy, o do commit mais novo). Se a ponta falhou de vez, usa o ancestral verde mais novo. Um nome de check repetido só passa se todas as cópias estiverem verdes. O `ci.yml` publica `typecheck`, `lint` e `test`; o `image.yml` não repete esses nomes.
4. Resolve os digests `sha-<7>` de `ghcr.io/diogenesmendes01/erp-genius` e `.../migrate`. Um 404 na ponta (a tag ainda não foi publicada; o `image.yml` deixa `cancel-in-progress: false`, então um push novo não cancela o build) não espera: o deployer percorre os commits anteriores, no máximo 20 commits, e fica com o primeiro que tenha os 5 checks verdes, os dois digests publicados e attestation válida. Se nenhum servir, grava `state.json.failed` com `result` `sem_imagem` e sai com código diferente de 0. Os digests desse marcador são zerados só para caber no formato do state; não são uma imagem para implantar. O tick seguinte não tenta de novo até `sudo erp-deployer clear-failed`. Digest fora de `^sha256:[a-f0-9]{64}$` aborta. Se, nesse percurso, `try_images` devolve um erro que não é 404 (código 10), o deployer não segue para o commit anterior: grava o marcador com `result` `ghcr_erro` e sai com código diferente de 0. Os digests zerados desse marcador também não são uma imagem. Falha de rede no GHCR ao resolver a ponta, antes desse percurso, aborta sem marcador, para o próximo tick tentar de novo.
5. Para os dois digests, sem `|| true` e com `set -euo pipefail`:

```bash
gh attestation verify "oci://<imagem>@<digest>" \
  --repo diogenesmendes01/erp-genius \
  --signer-workflow .github/workflows/image.yml \
  --format json
```

O commit, a ref `refs/heads/main` e o digest têm de ser iguais aos campos do predicate, não uma substring. Rede, timeout (`timeout 60`), `gh` ausente, saída vazia ou commit diferente abortam. Não há deploy.

6. `pg_dump` custom, arquivo `0600`, `sha256sum` ao lado. Em seguida `pg_restore --list` no dump. Falhou o dump, o checksum ou o `--list`: aborta antes de qualquer PATCH e grava o marcador. Depois que o backup termina, `falhar_pos_backup` fica armada com trap `ERR` e `EXIT`. Toda saída diferente de 0 dali grava o marcador antes de encerrar, exceto SIGINT (130) e SIGTERM (143). Um SIGTERM depois do backup encerra com 143 e não grava o marcador: o tick foi interrompido, não falhou, e o seguinte pode tentar de novo. O SIGINT segue a mesma regra. Os `die` do Coolify continuam gravando o marcador: leitura 401 ou 5xx, resposta inválida, escrita recusada de `APP_MIGRATE_IMAGE` e escrita recusada de `APP_IMAGE`. O tick seguinte vê o mesmo SHA e não roda outro `pg_dump`.
7. Se o commit, ou algum ancestral desde o último state, tiver o label `migration-contract`, o tick aborta. O deploy desse lote é manual (seção abaixo).
8. Grava só `APP_MIGRATE_IMAGE` e roda `npx prisma migrate deploy` na imagem atestada. Se o migrate falha, a `APP_MIGRATE_IMAGE` anterior (se for digest válido) é restaurada. `APP_IMAGE` não muda e não há redeploy.
9. Grava `APP_IMAGE` e faz `POST /api/v1/deploy`. Se o Coolify recusar, restaura os digests anteriores.
10. `/api/health` precisa devolver o SHA do commit, `/api/ready` precisa responder 200 e `SMOKE_PATH` precisa responder 200 com o cookie do usuário técnico. Qualquer falha restaura os digests.
11. Só então o state `/var/lib/erp-deployer/state.json` é gravado em `0600`, com arquivo temporário no mesmo diretório e `mv -f` (rename atômico).

Log JSON em stderr e em `/var/lib/erp-deployer/deploy.log`: `event`, `result`, `sha`, `app_digest`, `migrate_digest`, `duration_ms`. O token, o cookie, o `DATABASE_URL` e o restante dos envs do Coolify não entram no log.

Os 5 checks são `typecheck`, `lint`, `test (UTC)` e `test (America/Sao_Paulo)` do `ci.yml`, e `build Next.js` do `image.yml` no push da `main`.

## Deploy manual com migration-contract

Um PR com o label `migration-contract` não sobe sozinho.

1. `sudo erp-deployer pause`
2. Confira o diff da migration e o dump mais novo (`sha256sum -c` e `pg_restore --list`).
3. Rode o `prisma migrate deploy` na imagem de migrate já atestada, com a URL interna do banco, na janela combinada.
4. Atualize `APP_IMAGE` e `APP_MIGRATE_IMAGE` no Coolify para os digests atestados e faça o deploy pelo painel.
5. Confira health, ready e a rota do smoke.
6. Grave o state só se o health fechou. Se o agente marcou o SHA, `sudo erp-deployer clear-failed` apaga `state.json.failed`.
7. `sudo erp-deployer resume`

## Incidente

O primeiro passo é congelar o agente, antes de mexer no banco ou no Coolify:

```bash
sudo erp-deployer pause
```

Os motivos que gravam `state.json.failed` são `migration-contract`, dump inválido, leitura ou escrita recusada pelo Coolify depois do backup, migrate, health, smoke, `POST /deploy`, ponta sem imagem publicada (`sem_imagem`) e erro do GHCR no fallback que não é 404 (`ghcr_erro`). Um SIGTERM depois do backup não entra nessa lista. Depois de corrigir a causa de cada um deles:

```bash
sudo erp-deployer clear-failed
```

Sem esse comando o mesmo SHA não é tentado de novo. Se o incidente começou com `pause`, termine com `sudo erp-deployer resume`.

## Rollback

Falha de health, ready, smoke ou do `POST /deploy` depois da troca de imagem: o script restaura `APP_IMAGE` e `APP_MIGRATE_IMAGE` e redeploya. A fonte é o state anterior. No primeiro deploy, sem state, usa as imagens que o Coolify já tinha, se forem digests válidos. O banco não é revertido. O código automático só chama `pg_restore --list`. Não há `prisma migrate reset`, `prisma db push` nem down-migration.

Em seguida grava `/var/lib/erp-deployer/state.json.failed` com o SHA que falhou. Enquanto esse marcador existir para o mesmo SHA, o timer não tenta de novo e não roda outro `pg_dump`. Isso vale para `migration-contract`, dump corrompido, leitura ou escrita do Coolify depois do backup, migrate, health, smoke, o `POST /deploy`, a ausência de imagem publicada (`sem_imagem`) e o erro do GHCR no fallback (`ghcr_erro`). Um SIGTERM depois do backup encerra com 143 e não grava o marcador. A retomada é manual: `sudo erp-deployer clear-failed` apaga só o marcador, e `sudo erp-deployer resume` apaga o marcador e o `PAUSE`. Um commit mais novo da `main` é avaliado normalmente.

Se não houver state nem imagem anterior válida, pause o agente e use o restore manual abaixo, ou publique um commit de correção.

## Kill switch

```bash
sudo erp-deployer pause
```

Isso cria `/etc/erp-deployer/PAUSE` e para `erp-deployer.timer` e `erp-deployer.service`. Enquanto o arquivo existir, o tick sai 0 e não chama Coolify, GHCR nem `pg_dump`. Para voltar:

```bash
sudo erp-deployer resume
```

O `resume` apaga o arquivo e o marcador `state.json.failed`. O timer só volta a ser iniciado se já estiver `enabled`. Quem ainda não recebeu o OK do Mendes continua com o timer desligado. O unit tem `ProtectSystem=strict`: o `deployer` não grava em `/etc`. Quem cria e apaga o `PAUSE` é o root, por esse comando. Para liberar um SHA bloqueado sem mexer no `PAUSE`:

```bash
sudo erp-deployer clear-failed
```

## Restore manual do banco

O deployer não restaura o banco. Este passo é humano, depois do kill switch.

1. `sudo erp-deployer pause`
2. Escolha o dump em `/var/backups/erp-deployer/` e confira o checksum no mesmo diretório:

```bash
cd /var/backups/erp-deployer
sha256sum -c NOME.dump.sha256
pg_restore --list NOME.dump
```

3. Combine uma janela. O `pg_restore` abaixo é manual e destrutivo para os objetos que o dump cobre. A URL fica num env-file `0600`, não no argv do host:

```bash
umask 077
envfile="$(mktemp)"
chmod 0600 "$envfile"
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > "$envfile"
docker run --rm --env-file "$envfile" \
  -v /var/backups/erp-deployer:/backup:ro \
  --entrypoint sh postgres:16 \
  -c 'pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /backup/NOME.dump'
rm -f "$envfile"
```

4. Confira `/api/health` (SHA esperado), `/api/ready` (200) e a rota do smoke.
5. `sudo erp-deployer resume`

## Unidade systemd

`erp-deployer.service`: `User=deployer`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `UMask=0077`, `ReadWritePaths=/var/lib/erp-deployer /var/backups/erp-deployer`. Não há socket do Docker em `ReadWritePaths`.

Habilitar, só depois da PR-A, da PR-B e do OK do Mendes:

```bash
systemctl daemon-reload
systemctl enable --now erp-deployer.timer
```

Acompanhe `journalctl -u erp-deployer.service` e `/var/lib/erp-deployer/deploy.log`.

## Backup off-site (BLOCK-12, pendente)

O dump em `/var/backups/erp-deployer` fica na própria VPS. A cópia off-site do `BLOCK-12` ainda não existe neste agente: está pendente e depende do Mendes. Este runbook não liga essa cópia, não muda o timer e não implementa o `BLOCK-12`.

## Dependências na VPS

`gh` (com `gh attestation verify`), `curl`, `python3`, `pg_dump` e `pg_restore` (cliente PostgreSQL), `docker`, `sha256sum`, `flock`, `timeout`, `find`.
