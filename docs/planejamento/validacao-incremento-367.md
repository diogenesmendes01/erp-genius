# Incremento 367 — Concorrência e saldo de recuperação, 14/09/2026

Ampliada a validação de Q150 para recuperação. Duas propostas sobre a mesma base esgotada, aprovadas simultaneamente, produzem somente uma aprovação válida. Duas reservas concorrentes para a última oportunidade extra também produzem somente uma reserva. A proposta cuja base mudou pode ser rejeitada, preservando o histórico.

O cenário com limite institucional zero agora é exercitado de ponta a ponta: publicação independente da regra, nova turma vinculada à versão, resultado insuficiente, recusa inicial do plano, proposta e aprovação independente da extra, aprovação do plano e reserva. A segunda reserva é recusada; a regra institucional permanece intacta.

A tela de execução do plano distingue limite da regra, extras aprovadas, limite total, consumidas, reservadas e disponíveis. Inclui acesso à consulta/proposta de extras no vínculo autorizado. Não houve alteração de regras de negócio ou nova migration neste incremento.

## Evidências

- 62 integrações de avaliações aprovadas, incluindo os dois cenários novos: [relatório](../validacao-extras-367-2026-09-14.json).
- TypeScript, lint dos arquivos alterados e build de produção aprovados (52 páginas estáticas, além das rotas dinâmicas).
- Os 839 unitários aprovados no incremento 366 permanecem uma evidência anterior; não foram repetidos nesta rodada.

Não houve homologação interativa, envio externo ou alteração de produção. A validação desta suíte não constitui regressão integral de todas as integrações. Q150 ainda exige o fluxo de extras de segunda chamada; fechamento versionado e integração da progressão continuam pendentes. Nenhum desses requisitos é declarado concluído por esta entrega.
