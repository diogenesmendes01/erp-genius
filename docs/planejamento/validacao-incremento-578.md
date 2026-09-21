# Incremento 578 — aplicação atômica de remarcação de segunda chamada

## Comportamento implementado

Secretaria, Gerência Pedagógica ou Administração consultam a reserva e propõem novo intervalo com motivo e evidência. Outra pessoa da Gerência Pedagógica/Administração decide. A proposta preserva o horário vigente. Aprovação reconfere estado, contexto acadêmico/contratual, professor, prazo, calendário, conflitos, indisponibilidade e horários reservados para contratação.

Na mesma transação, a aprovação cria o encontro substituto, cancela o anterior e religa a mesma agenda/reserva. Não cria outra oportunidade, nota, presença ou cobrança. A aplicação mantém os identificadores dos dois encontros; o original permanece protegido depois de deixar de ser o encontro atual. Reenvio idêntico de proposta/decisão não duplica efeitos. Horários locais são convertidos pelo helper existente, com fuso explícito.

Criados serviço, wrapper de horários locais, página de revisão e formulário em `academico/segundas-chamadas/reservas/[reservaId]/remarcacao`. O painel de segunda chamada oferece link para a revisão. Autorização continua no servidor.

Migration `20260915121000_remarcacao_agenda_segunda_chamada` aplicada exclusivamente ao PostgreSQL local descartável. Não editar seu conteúdo depois desta aplicação; correções posteriores exigem outra migration. Prisma Client gerado. Não houve implantação ou migração de dados da escola.

## Revisão e correções verificadas

- A revisão anterior à aplicação identificou perda de ramos existentes ao substituir o guard de conclusão. Foram restauradas as proteções de realização, falta e cancelamento normal, acrescentando somente as condições da remarcação.
- A primeira execução encontrou a Secretaria indevidamente excluída da ação de proposta, apesar de autorizada na consulta. A ação foi corrigida e o cenário passou.
- Uma incompatibilidade TypeScript na lista de papéis foi corrigida; verificação final de tipos passou.

## Evidência

- Bateria global anterior concluída: 1.114 integrações em 95 arquivos, zero falhas/pendências. `docs/validacao-integracao-completa-574-2026-09-15.json`. Não cobre este incremento.
- Primeira execução de segunda chamada com a migration: 43/44 passaram, incluindo os 40 cenários anteriores. A única falha foi a permissão da Secretaria descrita acima. `docs/validacao-remarcacao-578-2026-09-15.json`.
- Após correção: quatro cenários novos passaram. Depois de acrescentar concorrência e proteções diretas, os cinco cenários novos passaram: `docs/validacao-remarcacao-concorrencia-578-2026-09-15.json`. Os 40 cenários não selecionados nessa rodada são ignorados pelo filtro, não falhas.
- Testes novos cobrem aplicação/idempotência, mesma oportunidade, autoaprovação, preservação do original, relink direto recusado, conflito surgido após proposta, estado desatualizado, rejeição, permissão, prazo e concorrência com realização. A concorrência usa duas transações reais; não simula duas sessões de navegador.
- Oito testes unitários de entrada e renderização SSR passaram: `docs/validacao-remarcacao-unitaria-578-2026-09-15.json`.
- Prisma validate, lint direcionado e TypeScript final passaram. Build de produção passou (`docs/validacao-build-578-2026-09-15.log`); a posterior correção da lista de papéis e os testes adicionais foram cobertos por tipos/lint/integração.

## Limites e próximos passos

O fluxo ainda recusa intervalos não letivos: a exceção específica de Q19 precisa ser integrada, sem aprovação implícita. A consulta mostra somente as vinte propostas mais recentes; falta paginação do histórico da remarcação. Falta entrada navegável específica para a Secretaria, que já pode acessar a rota e usar as ações autorizadas. Não houve ensaio interativo no navegador nem envio de avisos externos. Esses limites impedem declarar o fluxo integralmente entregue.

Q164 continua pendente e não foi presumida. Demais pendências da SPEC, inclusive emissão recorrente e integrações operacionais, permanecem abertas. A aprovação dos testes não representa conclusão integral do projeto.
