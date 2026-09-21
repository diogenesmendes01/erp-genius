# Incremento 589 — Cobertura contratual na agenda inicial e substituição docente

Data: 16/09/2026. Escopo: Q151 nas decisões de agenda inicial e substituição de professor da segunda chamada. Objetivo integral em andamento.

## Requisito e alteração

O incremento 588 corrigiu a remarcação para conferir a situação contratual em todo o intervalo. Agenda inicial e substituição ainda verificavam as extremidades, permitindo uma pausa interna sem autorização quando a matrícula estivesse ativa nas duas pontas.

A correção usa o mesmo helper temporal nos dois caminhos, no servidor e antes dos efeitos SQL. Considera os marcos de ativação, pausa, retomada, encerramento e vigência das autorizações. A autorização específica não reativa contrato nem concede saldo ou nota. Os demais requisitos de prazo, calendário, disponibilidade, atribuição, aprovação independente e idempotência permanecem.

As SPECs de agenda inicial e substituição explicitam essa cobertura contínua. A migration `20260915130000_intervalo_contratual_agenda_inicial_substituicao` redefine somente os dois aplicadores, adicionando o helper de 129 antes dos efeitos. Comparação com as definições anteriores confirmou preservação das demais guardas. Aplicação restrita ao PostgreSQL de teste em localhost:54329; migrations aplicadas não foram editadas.

## Verificações

- Cinco testes de schema aprovados: `docs/validacao-unitaria-589-2026-09-16.json`.
- Build e tipos aprovados: `docs/validacao-build-589-2026-09-16.log`.
- Regressão de **88 integrações aprovada**, sem falhas ou ignorados, após a migration 130: `docs/validacao-integrada-regressao-589-2026-09-16.json`. Inclui fluxo principal, agenda inicial, substituição, fechamento, remarcação autorizada e helper temporal.
- **Cinco novas integrações aprovadas**: `docs/validacao-integrada-intervalo-589-2026-09-16.json`. Cobrem proposta inicial recusada pelo servidor, decisão inicial e substituição recusadas no SQL com mensagem específica de cobertura, pendência visível na consulta de substituição e dois caminhos positivos com autorização.
- Lint e tipos finais aprovados: `docs/validacao-lint-589-2026-09-16.log` e `docs/validacao-tipos-589-2026-09-16.log`.

Os novos testes inicialmente falharam na preparação: faltavam fuso institucional e prazo fictício suficiente para o encontro de vários dias. A fixture passou a configurar ambos explicitamente, sem alterar parâmetros de produção. O teste de proposta passou a preparar o estado antes da pausa, para observar a recusa pela ação em vez de falhar no helper da fixture. Mensagens SQL são conferidas especificamente para impedir que uma recusa por outra causa seja aceita como prova. A edição também normalizou o arquivo para UTF-8.

## Limites

Achado de concorrência a tratar: os aplicadores SQL diretos bloqueiam calendário e fonte/reserva, mas não bloqueiam a matrícula antes de revalidar sua situação. Pausa/retomada usam bloqueios de lead e matrícula. No servidor, `bloquearLancamento` já bloqueia o contexto; a entrada SQL direta precisa seguir uma ordem compatível e testar pausa concorrente. Não adicionar simplesmente o bloqueio de matrícula depois da fonte: os caminhos do servidor podem bloquear matrícula antes da fonte. Esta rodada não comprova serialização completa desse caso.

Sem homologação interativa, produção, envio externo ou importação de dados reais. O incremento não resolve Q164 nem comprova os demais requisitos do ERP.
