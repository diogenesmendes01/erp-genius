# Migrations expand-only

O deploy sobe o schema enquanto a versão anterior do app ainda pode estar no ar. Toda migration nova em `prisma/migrations` precisa ser compatível com esse app (fase **expand**). Remover ou renomear coluna, tabela, índice, tipo ou função, estreitar um tipo, ou exigir `NOT NULL` sem default quebra a versão antiga ou o próprio migrate. Isso é fase **contract** e só entra num deploy seguinte, com o label `migration-contract`.

## O que pode ir na fase expand

- Tabela nova.
- Coluna nova anulável, ou `NOT NULL` com `DEFAULT` (o valor default cobre o insert do app antigo).
- Índice novo.
- Valor novo de enum (`ALTER TYPE ... ADD VALUE`).
- `DROP NOT NULL` e outros relaxamentos de constraint.

## O que o lint barra

O script `scripts/lint-migrations.ts` olha só as migrations **novas** do diff:

```bash
git diff --name-only origin/main -- prisma/migrations
```

Arquivo que já existe em `origin/main` não é reavaliado. Num arquivo novo, o lint falha ao encontrar, fora de comentário e de literal:

| Regra | Exemplo |
| --- | --- |
| `DROP TABLE` | `DROP TABLE "SugestaoIA"` |
| `DROP COLUMN` | `ALTER TABLE "Aluno" DROP COLUMN "nome"` |
| `RENAME` | coluna, índice, tipo, função ou trigger |
| `ALTER COLUMN ... TYPE` | `ALTER COLUMN "valor" TYPE DECIMAL(12,2)` |
| `SET NOT NULL` sem `DEFAULT` | `ALTER COLUMN "nome" SET NOT NULL` |

`SET NOT NULL` passa quando o **mesmo comando** define um `DEFAULT` (`SET DEFAULT` ou `DEFAULT` na coluna). `DROP DEFAULT` no mesmo comando não conta como default.

`DROP NOT NULL` não é `SET NOT NULL` e não é barrado. Corpo de função (`$$ ... $$`) entra na análise: `DROP TABLE` lá dentro também falha.

## Label `migration-contract`

Sem o label, o job `lint` do CI recusa a PR. Com o label, o lint registra as violações e segue. Use o label só quando o expand correspondente já está em produção e o app antigo não depende mais do objeto removido, renomeado ou estreitado.

O arquivo `scripts/lint-migrations.allowlist.txt` lista as migrations **já versionadas** que contêm esse SQL. O teste `src/test/lint-migrations.test.ts` confere que não há violação histórica fora da lista. A allowlist não libera migration nova: a única exceção no CI é o label.

## Como rodar

```bash
git fetch origin main
npx tsx scripts/lint-migrations.ts
```

Código de saída `0` quando não há violação, ou quando `PR_LABELS` / o evento do GitHub traz `migration-contract`. Código `1` quando há violação sem o label. Código `2` quando `origin/main` não está disponível.
