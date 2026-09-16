# Incremento 531 — cadeia de cobertura na prévia mensal

A prévia de continuidade usa agora `carregarUltimaCoberturaContinuidadeTx`, limitada à matrícula e às mensalidades. Cobranças canceladas permanecem na conferência. Crédito de período integral só influencia a cadeia depois da aplicação efetiva; aprovação sem aplicação não substitui a cobertura. Cobertura futura aplicada usa as datas atuais da mesma cobrança e preserva seu vencimento.

Suspensão remanescente, ajuste de acerto, cobertura incompleta, sobreposição elegível ou cancelamento/crédito posterior à última cobertura regular exigem conferência. Uma cobrança cancelada antiga, inteiramente anterior à última cobertura, não se torna a base do próximo período.

Validação no banco de teste local:

- 18 testes de período integral aprovados, incluindo base antes/depois da aplicação de cobertura futura e rejeição da base convertida em crédito: `docs/validacao-periodo-integral-531-2026-09-15.json`.
- Um cenário completo de contrato/aditivo mensal, ativação e prévia aprovado; inclui cancelamento posterior, sobreposição e cancelamento antigo, com rollback das fixtures adicionais. Outros 34 cenários não foram selecionados nesta execução: `docs/validacao-continuidade-531-2026-09-15.json`.
- 11 testes unitários da cadeia aprovados: `docs/validacao-cadeia-531-2026-09-15.json`.
- ESLint dos arquivos da integração e testes passou. Build final passou: `docs/validacao-build-final-531-2026-09-15.log`. A primeira tentativa encontrou cast inválido em um teste negativo; corrigido para explicitar a entrada propositalmente inválida, sem alterar a validação de produção.
- Revisão independente pelo agente Terra não identificou defeito concreto de isolamento ou seleção da cobertura.

O resultado geral anterior de 1.073 integrações é do incremento 528; não foi repetido integralmente nesta mudança. Não houve implantação nem validação interativa de interface. O nome PRODUCAO_MENSAL identifica fixture simulada, não operação externa.

A emissão recorrente continua indisponível. Q161 (comprovação de oferta) e Q162 (sequência após compensação) aguardam resposta. O cálculo de dias úteis do incremento 530 ainda não foi conectado à configuração contratual/emissão. Q160 permanece respeitada: a referência contratual explícita determina o mês de vencimento das cobranças novas; o vencimento da cobrança reprogramada é preservado.
