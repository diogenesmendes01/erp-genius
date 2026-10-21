# Incremento 484 — retomada e proteção da substituição contratual

Data: 15/09/2026. A consulta da meta retornou `active`; não foi necessário criar outra meta. O trabalho foi retomado com o agente Terra e coordenação principal.

## Correção e entradas

Os testes adversariais Terra demonstraram que a regra pura de aprovação aceitava uma proposta com `matriculaSubstitutoId` diferente da matrícula fonte. A preparação já conferia esse vínculo, mas a aprovação não o revalidava. A correção exige mesma matrícula e artefato substituto distinto e não vazio na aprovação, no início do cancelamento e na confirmação. O teste que falhava passou após a correção; também foram cobertas as três transições para vínculo incorreto, artefato igual e artefato vazio.

Adicionados schemas estritos de preparação e decisão. A entrada humana informa identificadores, revisões esperadas, motivo e chave idempotente na preparação; a decisão exige proposta, hash esperado, booleano explícito e motivo. Autoria, versão, diferenças e snapshot não são aceitos do formulário: deverão ser derivados e conferidos pelo serviço. Esses schemas ainda não estão conectados a uma ação pública.

## Validação e limites

Relatório: `docs/validacao-substituicao-484-2026-09-15.json`, com os testes existentes, adversariais e de entrada. Os 16 testes passaram. ESLint dos quatro arquivos envolvidos passou. A execução inicial Terra teve 4 aprovações e uma falha, usada como reprodução da correção.

A regressão de integração 482 continua na sessão 17801. Não houve execução concorrente de testes no banco, instalação de dependências, geração Prisma ou aplicação da migration 216. As regras puras alteradas não são importadas pelos testes de integração existentes. A migration permanece preparada e não validada no PostgreSQL. Persistência transacional, cancelamento externo autenticado e interface Q116 continuam pendentes; esta entrega não comprova o fluxo completo nem a meta integral.
