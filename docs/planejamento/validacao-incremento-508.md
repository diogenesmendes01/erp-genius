# Incremento 508 — preço formalizado na apuração por hora

15/09/2026. Implementação com agentes Terra, integração e testes pelo orquestrador.

A prévia financeira de particulares resolve a versão de condições formalizadas efetiva no início do encontro. Usa HORA_VALOR quando existente, conserva as regras-base e registra preço aplicado e referência da versão no snapshot. A tela indica a versão do aditivo. O fechamento continua usando a conferência preservada, sem reprecificar recebimentos ou conferências anteriores.

Mudança de preço/moeda/regime dentro do intervalo exige revisão; alteração cadastral com condições financeiras herdadas não bloqueia. Moeda incompatível é recusada: esta entrega não implementa conversão cambial. A migração 730 confere o preço e a referência efetiva e preserva as validações anteriores da ocorrência. Foi aplicada somente ao banco descartável.

## Evidências

Regressão de aditivos e condições por hora aprovada em `docs/validacao-integracao-hora-aditivo-508-2026-09-15.json`. Seis testes do resolvedor passaram em `docs/validacao-hora-aditivo-508-2026-09-15.json`, cobrindo vigência, alterações durante o encontro, herança cadastral, moeda e integridade. TypeScript, lint e build aprovados; log `docs/validacao-build-508-2026-09-15.log`.

## Limites de comprovação

A regressão do banco exercita o fluxo financeiro existente sem aditivo de preço e a resolução de uma versão cadastral formalizada. A mudança positiva de preço foi verificada no resolvedor puro. Ainda falta o cenário completo no banco: contrato por hora, aditivo de preço assinado, conferência e fechamento com o valor alterado. Não declarar esse fluxo ponta a ponta concluído com estes testes.

Não houve assinatura externa real, envios, ensaio interativo da tela ou alteração em produção. Integração de mensalidades, mudanças de agenda e demais efeitos contratuais seguem pendentes. A meta integral permanece ativa.
