# Incremento 528 — validação geral e fronteiras da continuidade

15/09/2026. Auditoria ampliada a partir do estado posterior ao incremento 527. Nenhuma edição de código de produção durante a execução da suíte de integração.

## Validações

Lint completo executado em 1.146 arquivos: nenhum erro e três avisos `react-hooks/set-state-in-effect`, dois em `FinanceiroPainel.tsx` e um em `Sidebar.tsx`. Evidência: `docs/validacao-lint-geral-528-2026-09-15.json`. Não foram desativadas regras para obter esse resultado.

Suíte completa de integração concluída em execução serial pelo mesmo processo contra o banco descartável: 1.073 testes aprovados nos 95 arquivos `*.int.test.ts`, sem falhas nem casos ignorados. Evidência: `docs/validacao-integracao-geral-528-2026-09-15.json`. O processo não foi reiniciado durante a espera. Os helpers isolados preparados nos incrementos 529/530 não estavam integrados ao fluxo desta execução e possuem validação unitária própria.

## Auditoria de coberturas por agentes Terra

**Recomposição Q70:** o código preserva a quantidade de dias das cobranças deslocadas e impede sobreposição com dias compensados. Porém, não define a sequência das mensalidades novas depois de uma cobertura deslocada. Exemplo: 01–31/out passa a 03/out–02/nov. Começar a próxima em 01/nov duplica cobertura; começar em 03/nov muda a referência civil; pular até dezembro deixa um intervalo descoberto. A exceção de retomada Q66 não autoriza escolher uma dessas soluções.

Q162 enviada ao usuário, ainda sem resposta: escolher novo ciclo mensal, extensão sem cobrança até a referência anterior, ou regra explícita por contrato permitindo as duas formas. Nenhuma alternativa foi implementada ou presumida. Q161 também permanece pendente quanto à comprovação da oferta.

**Cobranças canceladas:** a consulta atual da continuidade carrega todas as mensalidades e toma a maior cobertura como referência, sem classificar cancelamento ou suspensão. Excluir toda `CANCELADA` também seria incorreto: poderia reemitir uma obrigação cancelada ou pular uma pendência. O próximo tratamento precisa distinguir fonte temporal suspensa, retomada aplicada, cancelamento definitivo/legado e ajustes financeiros, preservando as ocorrências que bloqueiam a sequência.

Q158/Q159 devem ser lidas pelas aplicações de período integral da cobrança, não inferidas apenas pelo status. Crédito aplicado regulariza aquela obrigação sem oferecer cobertura futura; cobertura futura aplicada muda a cobertura da mesma cobrança. Uma proposta apenas aprovada não produz esses efeitos. O modelo `ajusteAcerto` corresponde a acerto de encerramento e não deve ser confundido com `aplicacoesPeriodoIntegral`.

## Limites

Esta auditoria não conclui a emissão recorrente, a homologação de interface ou a SPEC integral. Não houve alteração de produção nem chamadas a provedores externos. Os resultados da suíte geral orientarão as correções seguintes, sem reduzir os critérios de aceite para acomodar falhas.
