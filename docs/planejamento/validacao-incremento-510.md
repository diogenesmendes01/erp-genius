# Incremento 510 — condições mensais formalizadas

15/09/2026. Implementação com agentes Terra e verificação pelo orquestrador.

O resolvedor mensal identifica o preço formalizado vigente para uma nova cobertura. Preserva o valor original de referência e altera somente o valor negociado. Mantém moeda e histórico; mudança financeira no interior do período exige conferência, sem criar proporcionalidade. Cobertura é um intervalo de datas civis inclusivas, incluindo todo o último dia.

O loop de geração dos meses 2..N da ativação legada passa a consultar essas condições e registra por cobrança os valores, a cobertura e a referência da versão no evento de geração. Primeira mensalidade e recebimentos não são reprecificados.

## Limite estrutural identificado

Matrículas com preparação comercial são encaminhadas para `ativarPreparacaoTx`, que emite somente a entrada. Esse caminho não usa o loop legado de meses 2..N. Portanto a integração legada não comprova emissão mensal com aditivo no fluxo novo. É necessário implementar a continuidade contratual e sua emissão idempotente conforme Q30/Q64; este incremento não substitui esse requisito.

O cenário PRODUCAO_MENSAL usa a formalização da aplicação e banco descartável, com transporte e assinatura externa simulados. Confere novo valor de 500 CRC no resolvedor, preservação das cobranças anteriores e isolamento entre matrículas. Não é um teste de emissão recorrente nem de operação em produção.

## Validação

40 testes de integração de aditivos e ativação passaram, sem falhas ou ignorados: `docs/validacao-integracao-510-2026-09-15.json`. Dez testes do resolvedor passaram: `docs/validacao-resolvedor-mensal-510-2026-09-15.json`. Build aprovado em `docs/validacao-build-510-2026-09-15.log`; TypeScript foi conferido novamente após o ajuste final de validação da data inicial. Lint focado aprovado. Não houve migração ou alteração em produção.
