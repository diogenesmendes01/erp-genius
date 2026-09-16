# Incremento 506 — versões de condições formalizadas

15/09/2026. Agentes Terra implementaram modelo, serviços, fixture e tela; o orquestrador revisou e integrou.

`VersaoCondicoesAditivo` preserva, por matrícula, proposta, conferência final, autoria, vigência e mapa das alterações estruturadas. O mapa contém condições alteradas por aditivos, não substitui sozinho todas as condições do contrato original. O registro exige conclusão em PRODUCAO, conferência final exata, integridade e valores tipados. SANDBOX é bloqueado. A consulta resolve a versão pela data informada e verifica seu hash.

A operação está disponível na página do original após conferência final válida. Registra a vigência, sem reescrever cadastro, emitir taxa ou executar acertos financeiros. A migração 710 verifica a composição das condições, sequência, origem e imutabilidade; foi aplicada somente ao banco descartável.

## Validação

Os cenários de conclusão exercitam SANDBOX e PRODUCAO com respostas e arquivos simulados. Verificam bloqueio de SANDBOX, registro, replay, consulta antes/no início da vigência, imutabilidade, hash incorreto e revogação de acesso. Relatório direcionado: `docs/validacao-condicoes-aditivo-506-2026-09-15.json`; regressão: `docs/validacao-aditivo-506-2026-09-15.json`. Build com verificação de tipos e lint direcionado aprovados; log `docs/validacao-build-506-2026-09-15.log`.

## Limites e continuação

Não houve assinatura externa real, envio ou alteração em produção. Consumidores financeiros e acadêmicos ainda não usam essas versões. A preparação do próximo documento ainda precisa incorporar a cadeia dos aditivos anteriores, e os efeitos em cobranças/agenda exigem integração transacional. A presença do registro não comprova aplicação financeira. Não houve ensaio interativo da nova tela. A meta integral permanece ativa.
