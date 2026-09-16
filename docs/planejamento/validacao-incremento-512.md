# Incremento 512 — interface e integridade da continuidade mensal

15/09/2026. Implementação com agentes Terra e revisão pelo orquestrador.

A tela `/matriculas/[id]/continuidade-mensal`, acessível pelas condições de entrada mensais, permite preparar e revisar a transcrição do contrato. Evidência documental e moeda vêm da matrícula; cláusula, preços, vigência, cobertura e antecedência são explícitos. Histórico e decisão usam os controles de acesso do servidor e não permitem autoaprovação.

A migração 750 reforça a forma completa da regra no banco. Rejeita campos ausentes ou extras, booleano textual, preço não canônico, datas inválidas, ciclo sem âncora e dia/antecedência inválidos. Não altera a migração 740 já aplicada. Aprovar uma transcrição não emite cobranças.

O planejador agora preserva anos anteriores a 0100 sem remapeá-los para 1900, restringe datas ao intervalo persistível 0001–9999 e recusa resultados fora desse intervalo. O limite da antecedência é técnico, sem valor padrão de negócio.

## Evidências e limites

Seis integrações aprovadas em `docs/validacao-continuidade-512-2026-09-15.json`; onze testes do planejador em `docs/validacao-planejamento-mensal-512-2026-09-15.json`. TypeScript, lint focado e build aprovados; log em `docs/validacao-build-512-2026-09-15.log`.

Não houve ensaio interativo da tela, assinatura externa, envios ou alteração em produção. Migração aplicada somente ao banco descartável.

Antes da emissão efetiva ainda são necessários: oferta por intervalo, prova do regime mensal para contratos legados, conferência do preço contra condições comerciais autorizadas, isolamento de pausa/recomposição, memória e unicidade da emissão. A transcrição revisada não substitui esses controles. Calendário financeiro de dias úteis e emissão recorrente continuam pendentes.
