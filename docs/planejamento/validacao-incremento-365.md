# Incremento 365 — Habilidades do plano sem tentativa, 14/09/2026

O acompanhamento agora identifica habilidades de cada plano aprovado que ainda não têm tentativa reservada ou realizada. Antes, disponibilizar um plano sem reservar nenhuma tentativa zerava as contagens operacionais relacionadas ao plano, embora as atividades ainda não tivessem execução.

A contagem consulta os planos do vínculo, contrato, nível e regra autorizados e compara suas atividades com as reservas/realizações daquele mesmo plano. Conta cada habilidade uma vez por plano. Plano ainda em aprovação não entra nessa contagem; continua na pendência de decisão. Disponibilizar não equivale a executar.

Reserva não realizada e cancelada não atende a atividade. Em cancelamento parcial, realização existente continua preservada e não volta a ser identificada como sem tentativa; sua nota/conferência permanece no acompanhamento próprio. O vencimento do prazo, por si só, não remove reservas ou atividades.

## Validação

58 integrações de avaliações aprovadas, incluindo plano antes/depois de aprovação e disponibilização, reserva parcial das habilidades, realização e cancelamento do restante. O cenário de quatro habilidades verifica a sequência: quatro sem tentativa após aprovação/disponibilização, duas após reservar fala/escrita, duas após realizar fala e três após cancelar a escrita ainda não realizada. [Evidência](../validacao-planos-365-2026-09-14.json).

839 unitários em 91 arquivos aprovados; build com TypeScript/52 páginas, lint direcionado e diff check aprovados. Nenhuma migration, produção, envio externo ou homologação interativa nesta rodada. Não houve regressão integral de todas as integrações.

## Limites

As contagens ajudam a identificar pendências; não constituem encerramento ou cumprimento integral do plano. Não interpretam tentativa sem melhora como aprovação nem encerram plano superado automaticamente. A resolução formal de planos sem continuidade, equivalências e impactos de correções, assim como o fechamento versionado de Q154 e a integração da progressão, continuam pendentes.
