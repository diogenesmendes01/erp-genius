# Incremento 551 — disponibilização autorizada na interface

A consulta operacional identifica a autorização de preparação válida para disponibilizar um plano aprovado antes da pausa, sem alterar a proposta original. Somente a gestão recebe essa referência e a permissão de disponibilizar. O formulário exibe o prazo em UTC e transmite a referência ao servidor, que confere novamente a autorização e a data efetiva. Quando falta autorização, a gestão encontra um atalho para solicitá-la na lista de planos.

Interface preparada pelo agente Terra e revisada pelo orquestrador. O adaptador de horário local encaminha a autorização para a ação validada. O formulário usa a referência na chave para não conservar dados associados a uma autorização substituída.

Validação: quatro integrações selecionadas aprovadas, zero falhas e 91 não selecionadas, em `docs/validacao-disponibilizacao-interface-551-2026-09-15.json`. O cenário anterior à pausa verifica a consulta antes/depois da autorização, restrição ao professor, disponibilização pelo adaptador local, idempotência e preservação da proposta, decisão e matrícula pausada. Inclui regressão de preparação após pausa e encerramento. ESLint focado e build Next.js aprovados (`docs/validacao-build-551-2026-09-15.log`); texto informativo ajustado após o build para indicar autorização que será usada, sem sugerir operação já executada.

Não houve execução interativa no navegador nem alteração em produção. Continuam pendentes a harmonização das autorizações na transição pausa→encerramento e a validação integral da Q151. A SPEC geral permanece em implementação.
