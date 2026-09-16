# Incremento 434 — casos persistidos de revisão de progressão

Data: 14/09/2026. Meta integral ativa; implementação retomada.

Correções regulares e de recuperação aprovadas criam casos imutáveis na mesma transação da decisão. Cada caso identifica matrícula, alocação fonte, decisão e solicitação afetada, preservando o impacto registrado. A fila inclui o identificador do caso. Repetir a decisão não duplica casos; correção rejeitada não cria caso.

## Validação

- Dois testes direcionados de correção regular e recuperação aprovados, incluindo persistência, associação na fila, replay e rejeição de alteração/exclusão: `docs/validacao-casos-revisao-434-2026-09-14.json`.
- Dois testes da cadeia de equivalência A→B→C aprovados: `docs/validacao-casos-transitivos-434-2026-09-14.json`. Estes verificam o coletor de impactos; não comprovam isoladamente o guard SQL de alcance transitivo.
- Prisma Client gerado; TypeScript e lint direcionado aprovados. Build completo aprovado, com 62 páginas estáticas.
- Migração 196 aplicada exclusivamente ao banco local de testes. Comparação do banco local com o schema sem diferenças.

## Limites e continuação

Não há resolução dos casos nesta etapa nem preenchimento retroativo dos casos de decisões históricas; a fila mantém a leitura dos impactos históricos existentes. A revisão independente identificou que o banco ainda precisa conferir a cadeia de equivalências entre a fonte e a solicitação, além da matrícula e do JSON da decisão. Esse endurecimento está em desenvolvimento em migração posterior; a migração 196 já aplicada será preservada.

A SPEC integral não está concluída. Não houve implantação em produção ou validação visual no navegador.
