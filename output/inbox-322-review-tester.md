# QA independente #322 — composição cea66f08343fe1b79ef14d70f8e17a88b3195ffd

Parecer: favorável ao backend #322 nesta fonte exata. Sem bloqueio encontrado no recorte de código, schema e testes executados. UI/browser não fazem parte deste aceite.

## Fonte e contrato

- Checkout TESTER destacado em `cea66f08343fe1b79ef14d70f8e17a88b3195ffd`, perfil `tester`, rastreados limpos (checagem terminal chunk `803377`, exit 0).
- Os sete objetos `prisma/src` específicos da #322 são idênticos aos de `b29b5f4d35c8c8a87f898b2cfef26b7d689e111e`; os quatro objetos produtivos de #321 são idênticos aos de `9d0225b4da449159e755448945bc1c89f1b61355`; `package.json` e `package-lock.json` idênticos a main `b6b451a37fe728280fd0899058344f32780ebaba` (mesma checagem).
- Coluna opcional e FK `RESTRICT/CASCADE` na primeira migration; índice `(atendimentoId,status)` na migration isolada com `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Relação inversa e índice Prisma concordam. A verificação física `indisvalid/indisready`, client e migrações foi responsabilidade do integrador.
- `atendimentoId` só entra no schema de criação. A criação exige `tarefas.ver`, valida `atendimentoVisivel(autor,id,false,tx)` e vínculos CRM na mesma transação da tarefa/evento; o escopo da função aceita esse mesmo cliente transacional. Edição descarta campo adicional, preserva versão e escopo. O hash de idempotência distingue atendimentos e preserva a entrada legada sem campo.
- Aria grava o ID da ação/turno confiável, não o campo livre da proposta. Evento humano/Aria publica ID ou null. Casos SUGERIR, SHADOW, NEGAR e rollback não deixam tarefa efetiva; não observei mudança de transporte, SSE ou autorização global.

## Execução própria

- Node 22 local, seis arquivos unitários dirigidos: **6 arquivos/43 testes, exit 0**, chunk `5b1259`, `--maxWorkers=2`. Incluídos regras/permissões CRM, capacidades Aria, índice de idempotência, migration encoding e guarda de identificação.
- Banco descartável exclusivo `tester` liberado pelo integrador após Prisma/migrations 487 e snapshot E2. Executei `vitest.integration.config.ts`, `--maxWorkers=1`, transportes externos vazios, os quatro arquivos completos `tarefa-atendimento.int.test.ts`, `executor-crm.int.test.ts`, `criar-tarefa-idempotencia.int.test.ts`, `tarefas.int.test.ts`, sem filtros/skips. Executor sessão **53653**, chunk final `25856d`, **4 arquivos/62 testes, exit 0**, 207,57 s. Banco liberado ao integrador após saída terminal, sem restauração por este TESTER.

## Limites

Não repeti suite global, TSC/lint do DEV/ROOT, browser ou inspeção SQL direta de catálogo: esses gates não são atribuídos à minha execução. O primeiro generate do integrador havia terminado em timeout antes de qualquer migration; a preparação posterior dele encerrou exit 0 antes desta suíte. Este parecer é do commit exato acima e não homologa futuras composições ou UI E2.
