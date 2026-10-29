# Migrations expand-only

O deploy sobe o schema enquanto a versão anterior do app ainda pode estar no ar. Toda migration nova em `prisma/migrations` precisa ser compatível com esse app (fase **expand**). Remover ou renomear coluna, tabela, índice, tipo ou função, estreitar um tipo, ou exigir `NOT NULL` sem default quebra a versão antiga ou o próprio migrate. Isso é fase **contract** e só entra num deploy seguinte, com o label `migration-contract`.

## O que pode ir na fase expand

- Tabela nova.
- Coluna nova anulável, ou `NOT NULL` com `DEFAULT` (o valor default cobre o insert do app antigo).
- Índice novo.
- Valor novo de enum (`ALTER TYPE ... ADD VALUE`).
- `DROP NOT NULL` e outros relaxamentos de constraint.

## Com o que o lint compara

O script `scripts/lint-migrations.ts` não olha a ponta de `origin/main` na hora em que o step roda. O job `lint` faz checkout com `fetch-depth: 0`. Em `pull_request` o ref é `refs/pull/<número>/merge` (o `github.sha` desse evento é o merge commit). Em `push` o ref é o `github.sha` do push.

- `pull_request`: a base é `HEAD^1`, o primeiro pai do merge commit. O HEAD precisa ter segundo pai (`HEAD^2`). Se o checkout não for merge commit, o script sai com código 2 e não compara com `HEAD^1`. `pull_request.base.sha` fica para trás em `labeled` e `reopened`, depois que a main andou, e não entra na conta.
- `push`: a base é o `merge-base` do `HEAD` com `github.event.before`. `before` vazio ou zerado (`000…0`, o push que cria o ref) não resolve: o script sai com código 2 e não cai em `HEAD^1`.
- Outro evento, sem `MIGRATION_BASE_SHA` válido, sai com código 2. Não há fallback silencioso para `HEAD^1` nem para `origin/main`.

O diff é `git diff --name-only --no-renames <base> -- prisma/migrations`. Sem `--no-renames` o Git trata o `git mv` do diretório, ou de `migration.sql` para outro nome, como rename e esconde o caminho antigo. Com `--no-renames` a migration aplicada some do diff como remoção e o lint falha.

Se a base não resolve (`before` vazio ou zerado, evento desconhecido, `HEAD` sem `HEAD^2` no `pull_request`, `HEAD^1` ausente, `MIGRATION_BASE_SHA` inválido, ou `merge-base` impossível), o script sai com código 2. Não há fallback para `origin/main` nem para `HEAD^1` fora do merge commit: o lint não passa em silêncio.

O force push na `main` fica coberto pelo ruleset `proteger-main`, que bloqueia push que não é fast-forward. O lint não trata force push à parte: o `before` de um push na `main` continua sendo ancestral do `HEAD`.

Há dois resultados no diff:

- `migration.sql` que **não** existe nessa base é migration nova. No `pull_request`, o lint lê o SQL. No push o lint não relê o SQL de migration nova: ela já foi validada na PR, e o evento de push não traz o label `migration-contract`. Reler o SQL deixaria o `lint` vermelho na main e travaria o deployer.
- `migration.sql` que **já** existe nessa base e aparece no diff foi modificada ou removida. Editar migration aplicada é proibido, no `pull_request` e no `push`: o relatório diz `edição de migration aplicada é proibida`. O SQL antigo não é reavaliado; a falha é a edição em si. Pular o step inteiro no `push` deixaria essa edição passar.

Uma migration que entrou em `origin/main` depois do checkout não entra nesse diff. O resultado não muda se a main avança durante o `npm ci`.

## O que o lint barra

Num arquivo novo, o lint falha ao encontrar, fora de comentário, de identificador entre aspas e de literal que não seja argumento de `EXECUTE`:

| Regra | Exemplo |
| --- | --- |
| `DROP TABLE` | `DROP TABLE "SugestaoIA"` |
| `DROP SCHEMA` | `DROP SCHEMA "legado"` |
| `DROP TYPE` | `DROP TYPE "StatusAntigo"` |
| `TRUNCATE` | `TRUNCATE "MensagemWhatsApp"` |
| `DROP COLUMN` | `ALTER TABLE "Aluno" DROP COLUMN "nome"` ou `ALTER TABLE "Aluno" DROP "nome"` |
| `RENAME` | coluna, índice, tipo, função ou trigger |
| `ALTER COLUMN ... TYPE` | `ALTER COLUMN "valor" TYPE DECIMAL(12,2)` ou `ALTER "valor" SET DATA TYPE text` |
| `SET NOT NULL` sem `DEFAULT` na mesma coluna | `ALTER COLUMN "nome" SET NOT NULL` |

No Postgres, `COLUMN` é opcional. `DROP [COLUMN] [IF EXISTS] coluna` e `ALTER [COLUMN] coluna [SET DATA] TYPE` contam igual, com ou sem `IF EXISTS` na tabela ou na coluna. `ALTER COLUMN type SET DEFAULT` não é mudança de tipo: `type` aí é o nome da coluna.

`TRUNCATE`, `DROP SCHEMA` e `DROP TYPE` esvaziam ou apagam objetos que a versão anterior do app ainda pode usar.

`EXECUTE '...'` (também `EXECUTE format('...')` e `EXECUTE $$...$$`) roda o literal. `DROP`, `TRUNCATE` e `ALTER` destrutivo aí dentro falham do mesmo jeito. `SELECT 'DROP TABLE "t"'` e `PERFORM '...'` continuam sendo texto e não falham.

`SET NOT NULL` passa quando a **mesma coluna** recebe `SET DEFAULT` no mesmo comando. `DEFAULT` de outra coluna no mesmo comando não cobre. `DROP DEFAULT` no mesmo comando não conta como default.

`DROP NOT NULL`, `DROP DEFAULT` e `DROP CONSTRAINT` não são `DROP COLUMN` e não são barrados. Corpo de função (`$$ ... $$`) entra na análise: `DROP TABLE` lá dentro também falha. Um identificador entre aspas (`"rename"`, `"truncate"`) não dispara a palavra-chave.

## O que fica com a review

Estes casos continuam sendo fase contract na política acima, mas o lint não os barra. Eles ficam com a review:

- `DROP INDEX` (também `DROP INDEX CONCURRENTLY`)
- `DROP VIEW` e `DROP MATERIALIZED VIEW`
- `DROP FUNCTION`

## Label `migration-contract`

O label `migration-contract` libera somente violações de SQL destrutivo em migration nova. Sem o label, o job `lint` do CI recusa essa migration. Com o label, o lint registra as violações de SQL e segue, desde que nenhuma migration já aplicada tenha sido editada ou removida. Use o label só quando o expand correspondente já está em produção e o app antigo não depende mais do objeto removido, renomeado ou estreitado.

Editar ou remover uma migration que já existe na base falha sempre, com ou sem o label, no `pull_request` e no `push`. O relatório diz `edição de migration aplicada é proibida`. O label não é override dessa edição.

O arquivo `scripts/lint-migrations.allowlist.txt` lista as migrations **já versionadas** que contêm esse SQL. O teste `src/test/lint-migrations.test.ts` confere que não há violação histórica fora da lista. A allowlist não libera migration nova nem edição de migration aplicada. A única exceção no CI é o label, e só para SQL destrutivo em migration nova.

Uma migration nova com SQL que o lint barra precisa entrar em `scripts/lint-migrations.allowlist.txt` na mesma PR. O label `migration-contract` não atualiza essa lista. Sem o nome no arquivo, `npm test` falha.

O workflow `ci.yml` dispara em `pull_request` dos tipos `opened`, `synchronize`, `reopened`, `labeled` e `unlabeled`, para o CI rodar de novo quando o label entra ou sai. Os jobs que não são o `lint` também rodam: um job pulado no run mais novo substitui o check obrigatório que já estava verde.

O lint de migrations fica no job `lint`, no step `Lint de migrations (expand-only)`. Não é um job separado. SQL destrutivo em migration nova sem o label `migration-contract` faz esse step sair com código 1. Editar ou remover migration já aplicada também sai com código 1, com ou sem o label. Nos dois casos o job `lint` falha. O job `lint` deve ser check obrigatório na branch protection de `main`. No ruleset `proteger-main` o contexto `lint` já está na lista de status obrigatórios.

## Como rodar

No CI, `pull_request` usa `HEAD^1` e `push` usa `github.event.before`. Localmente, passe o sha com que o `merge-base` deve ser calculado:

```bash
MIGRATION_BASE_SHA=$(git rev-parse origin/main) npx tsx scripts/lint-migrations.ts
```

Código de saída `0` quando não há edição de migration aplicada e não há violação de SQL, ou quando o label `migration-contract` cobre só SQL destrutivo em migration nova. Código `1` quando há SQL destrutivo em migration nova sem o label, ou quando uma migration já aplicada foi editada ou removida, com ou sem o label, no `pull_request` e no `push`. Código `2` quando a base não resolve: `before` vazio ou zerado, evento desconhecido, `HEAD` sem `HEAD^2` no `pull_request`, `HEAD^1` ausente, `MIGRATION_BASE_SHA` inválido, ou `merge-base` impossível. Esses casos não caem em `HEAD^1`.
