# Incremento 523 — referência contratual do vencimento (Q160)

15/09/2026. Q160 aprovada: para mensalidades novas, o contrato identifica se o vencimento pertence ao mês de início da cobertura, ao anterior ou ao seguinte, mantendo o dia contratado. A mensalidade cuja cobertura foi reprogramada conserva seu vencimento, conforme Q159. Condição incompleta exige conferência, sem referência presumida.

## Implementação

O planejamento calcula o vencimento pela próxima cobertura, sem avançar simplesmente o vencimento da cobrança anterior. Quando o dia contratado não existe no mês calculado, usa o último dia desse mês e conserva a referência contratada para os seguintes. A antecedência da emissão é calculada sobre esse vencimento. O formulário exige escolha explícita e o histórico mostra a regra.

A migração 840 exige a referência nas novas condições e aprovações. Não preenche contratos antigos nem altera cobranças emitidas. Uma condição legada sem referência não permite calcular a prévia; uma nova versão completa, conferida e aprovada pode substituí-la a partir da vigência correspondente. O histórico permanece preservado.

O carregamento da prévia foi extraído para uma função interna transacional, preservando a autorização da consulta pública, o contrato, preço, cobertura e conferência de indisponibilidade. Essa preparação não implementa a emissão: a prévia continua com `podeEmitir: false`.

## Validação

- 22 testes unitários aprovados: `docs/validacao-unitarios-523-2026-09-15.json`.
- 10 integrações das condições contratuais aprovadas: `docs/validacao-integracao-523-2026-09-15.json`. Incluem as três referências, aprovação independente, rejeição de regras incompletas e preservação da cobrança existente.
- Uma integração do fluxo mensal com aditivo e prévia aprovada: `docs/validacao-continuidade-aditivo-523-2026-09-15.json`. Os outros 34 casos desse arquivo não foram selecionados nessa execução. O provedor de assinatura é simulado no teste, sem comprovação de integração externa real.
- ESLint focado sem erros ou avisos. Revisão somente leitura por agente Terra sem divergência concreta com Q160.
- A primeira compilação identificou que o estado vazio do seletor precisava ser validado antes do envio; o formulário recebeu essa validação explícita. Recompilação aprovada, registrada em `docs/validacao-build-523-2026-09-15.log`.

## Pendências preservadas

A emissão mensal recorrente, a comprovação positiva de oferta no executor e o ensaio interativo permanecem pendentes. Não houve migração de produção nem cobrança externa. A migração foi aplicada somente ao banco descartável local. Q157 permanece sem decisão. A SPEC integral continua em implementação.
