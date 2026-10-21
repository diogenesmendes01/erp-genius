# Incremento 363 — Recuperações sem nota no acompanhamento, 14/09/2026

## Lacuna e comportamento implementado

A revisão para Q154 encontrou em `consolidado-tx.ts` um filtro que carregava somente realizações com alguma nota. Uma recuperação já aplicada, mas ainda sem lançamento, desaparecia do consolidado e não ativava `recuperacoesPendentes`.

O acompanhamento agora carrega todas as realizações autorizadas do vínculo, contrato, nível e regra. Realização sem nota gera memória com `NOTA_AUSENTE`, fonte identificada pela realização e nota/decisão nulas. Não cria nota zero nem altera a média oficial. A pendência persiste quando outra tentativa é oficializada e desaparece quando as notas necessárias são oficializadas. O melhor resultado continua preservado.

O carregador exige finalidade explícita: `ACOMPANHAMENTO` inclui realizações sem nota; `BASE_PLANO` preserva a comparação das fontes de notas da proposta de recuperação. Essa distinção impede que executar uma etapa autorizada invalide, por si só, as demais etapas do próprio plano. Mudança nas notas/fontes continua exigindo revisão conforme o fluxo existente. O fechamento futuro deve usar o acompanhamento completo e conferir também reservas, correções, equivalências e demais pendências; a base do plano não é evidência suficiente para fechar um nível.

## Validação e limites

- Rodada intermediária: 53 integrações aprovadas e duas falhas, demonstrando que incluir a realização sem nota na comparação do plano interrompia a reserva/continuidade. Evidência: [rodada intermediária](../validacao-consolidado-363-2026-09-14.json).
- Após separar as finalidades: todas as 55 integrações de avaliações aprovadas, incluindo realização sem nota, duas tentativas, oficialização parcial, manutenção do melhor resultado, cancelamento parcial, designação, correção e revogação. Evidência: [rodada final](../validacao-consolidado-363-final-2026-09-14.json).
- 839 unitários em 91 arquivos aprovados; build com TypeScript e 52 páginas, lint direcionado e diff check aprovados.

Nenhuma migration, produção ou envio externo. Não houve homologação interativa nem regressão integral das integrações nesta rodada. O resultado continua sendo acompanhamento: persistência do fechamento versionado, frequência entre vínculos, equivalência, exceção de frequência e integração da aprovação/execução da progressão permanecem pendentes. Não declarar Q154 concluída.
