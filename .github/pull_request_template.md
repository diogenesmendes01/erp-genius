## O que muda

<!-- contexto curto -->

## Como testar

- [ ]

## Migrations (expand-only)

Se esta PR não mexe em `prisma/migrations`, pode ignorar. Se mexe, ver `docs/migrations.md`.

- [ ] A migration nova é só expand: sem `DROP TABLE`, `DROP COLUMN`, `RENAME`, `ALTER COLUMN ... TYPE` nem `SET NOT NULL` sem `DEFAULT`.
- [ ] Coluna nova é anulável ou nasce com `DEFAULT`.
- [ ] Se esta é a fase contract, o PR tem o label `migration-contract` e o expand correspondente já está em produção.
