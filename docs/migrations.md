# Migrations expand-only

O deploy sobe o schema enquanto a versão anterior do app ainda pode estar no ar. Toda migration nova em `prisma/migrations` precisa ser compatível com esse app (fase **expand**). Remover ou renomear coluna, tabela, índice, tipo ou função, estreitar um tipo, ou exigir `NOT NULL` sem default quebra a versão antiga ou o próprio migrate. Isso é fase **contract** e só entra num deploy seguinte, com o label `migration-contract`.

## O que pode ir na fase expand

- Tabela nova.
- Coluna nova anulável, ou `NOT NULL` com `DEFAULT` (o valor default cobre o insert do app antigo).
- Índice novo.
- Valor novo de enum (`ALTER TYPE ... ADD VALUE`).
- `DROP NOT NULL` e outros relaxamentos de constraint.

## O que o lint barra

O script `scripts/lint-migrations.ts` olha o diff:

```bash
git diff --name-only origin/main -- prisma/migrations
```

Há dois resultados:

- `migration.sql` que **não** existe em `origin/main` é migration nova. O lint lê o SQL.
- `migration.sql` que **já** existe em `origin/main` e aparece no diff foi modificada ou removida. Editar migration aplicada é proibido: o relatório diz `edição de migration aplicada é proibida`. O SQL antigo não é reavaliado; a falha é a edição em si.

Num arquivo novo, o lint falha ao encontrar, fora de comentário e de literal que não seja argumento de `EXECUTE`:

| Regra | Exemplo |
| --- | --- |
| `DROP TABLE` | `DROP TABLE "SugestaoIA"` |
| `DROP SCHEMA` | `DROP SCHEMA "legado"` |
| `DROP TYPE` | `DROP TYPE "StatusAntigo"` |
| `TRUNCATE` | `TRUNCATE "MensagemWhatsApp"` |
| `DROP COLUMN` | `ALTER TABLE "Aluno" DROP COLUMN "nome"` ou `ALTER TABLE "Aluno" DROP "nome"` |
| `RENAME` | coluna, índice, tipo, função ou trigger |
| `ALTER COLUMN ... TYPE` | `ALTER COLUMN "valor" TYPE DECIMAL(12,2)` ou `ALTER "valor" SET DATA TYPE text` |
| `SET NOT NULL` sem `DEFAULT` | `ALTER COLUMN "nome" SET NOT NULL` |

No Postgres, `COLUMN` é opcional. `DROP [COLUMN] [IF EXISTS] coluna` e `ALTER [COLUMN] coluna [SET DATA] TYPE` contam igual, com ou sem `IF EXISTS` na tabela ou na coluna.

`TRUNCATE`, `DROP SCHEMA` e `DROP TYPE` esvaziam ou apagam objetos que a versão anterior do app ainda pode usar.

`EXECUTE '...'` (também `EXECUTE format('...')` e `EXECUTE $$...$$`) roda o literal. `DROP`, `TRUNCATE` e `ALTER` destrutivo aí dentro falham do mesmo jeito. `SELECT 'DROP TABLE "t"'` e `PERFORM '...'` continuam sendo texto e não falham.

`SET NOT NULL` passa quando o **mesmo comando** define um `DEFAULT` (`SET DEFAULT` ou `DEFAULT` na coluna). `DROP DEFAULT` no mesmo comando não conta como default.

`DROP NOT NULL`, `DROP DEFAULT` e `DROP CONSTRAINT` não são `DROP COLUMN` e não são barrados. Corpo de função (`$$ ... $$`) entra na análise: `DROP TABLE` lá dentro também falha.

## Label `migration-contract`

Sem o label, o job `lint` do CI recusa a PR. Com o label, o lint registra as violações e segue. Use o label só quando o expand correspondente já está em produção e o app antigo não depende mais do objeto removido, renomeado ou estreitado. O mesmo label é o único override para editar ou apagar uma migration que já está em `origin/main`.

O arquivo `scripts/lint-migrations.allowlist.txt` lista as migrations **já versionadas** que contêm esse SQL. O teste `src/test/lint-migrations.test.ts` confere que não há violação histórica fora da lista. A allowlist não libera migration nova nem edição de migration aplicada: a única exceção no CI é o label.

O workflow `ci.yml` dispara em `pull_request` dos tipos `opened`, `synchronize`, `reopened`, `labeled` e `unlabeled`, para o CI rodar de novo quando o label entra ou sai.

O lint de migrations fica no job `lint`, no step `Lint de migrations (expand-only)`. Não é um job separado. Sem o label `migration-contract`, esse step sai com código 1 e o job `lint` falha. O job `lint` deve ser check obrigatório na branch protection de `main`.

## Como rodar

```bash
git fetch origin main
npx tsx scripts/lint-migrations.ts
```

Código de saída `0` quando não há violação, ou quando `PR_LABELS` / o evento do GitHub traz `migration-contract`. Código `1` quando há violação sem o label. Código `2` quando `origin/main` não está disponível.
