## O que muda

<!-- contexto curto -->

## Como testar

- [ ]

## Migrations (expand-only)

Se esta PR não mexe em `prisma/migrations`, pode ignorar. Se mexe, ver `docs/migrations.md`.

- [ ] A migration nova é só expand: sem `DROP TABLE`, `DROP SCHEMA`, `DROP TYPE`, `TRUNCATE`, `DROP COLUMN` (a palavra `COLUMN` é opcional), `RENAME`, `ALTER ... TYPE` / `SET DATA TYPE` nem `SET NOT NULL` sem `DEFAULT`. O mesmo vale dentro de `EXECUTE '...'`.
- [ ] Nenhuma migration que já existe na base do PR foi editada ou removida.
- [ ] Coluna nova é anulável ou nasce com `DEFAULT`.
- [ ] Se esta é a fase contract, o PR tem o label `migration-contract` e o expand correspondente já está em produção.
- [ ] Se a migration nova tem SQL que o lint barra, o diretório dela entrou em `scripts/lint-migrations.allowlist.txt`. Sem isso, `npm test` falha. O label `migration-contract` não atualiza essa lista.
