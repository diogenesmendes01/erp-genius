# Inbox #354 R1 — lock compatível com FKs e controles preservados

Base exata7440c367254936375480039ed30d434567a0cb11, branch codex/inbox-e3-354-decisoes-responsavel. Somente uma consulta de produção muda: lock inicial de AtendimentoWhatsApp no wrapper Inbox passa de FOR UPDATE para FOR NO KEY UPDATE. O resto desta filha é regressão nativa, controles, SPEC/quadro e este relatório. Nenhum código355.

## Prova causal e diagnóstico

ROOT restaurou ci-integracao492/b33126 com503originais/424hashes antes da inspeção. RO24de37 EXIT0, BEGIN READ ONLY/ROLLBACK, somentepg_constraint/pg_trigger. No perfil, Tarefa_leadId_fkey usa RI_ConstraintTrigger_c_1533938 e Tarefa_atendimentoId_fkey RI_ConstraintTrigger_c_6149584: Lead antes de Atendimento no INSERT, ambos enabledO/não deferred. Metadata em output/inbox-354-fk-ri-metadata-ro-private.json SHA256b116789d38d8c18ae23ba7d0537375d1a7e6a46460c3c4744648a03a93298f7d.

Leitura de7440 e criarTarefaTx720ac2bfcffa2c305b1d944be13f3795100d2b05 por gitshow (semcheckout) confirmou vínculo simultâneo Lead+Atendimento e ausência de prelock explícito Lead no CRM global. Não se concluiu deadlock só pela ordem de FKs.

Causal privada v1: primeira tentativa35bfea EXIT1/0casos foi erro alias.mjs, preservada em red.log, sem execução de fixture. Execução efetiva99337a EXIT1/1caso usou ações/ACL/SQL nativos7440, barreira só após next(params) concluir lock REAL do Atendimento, observer com pg_blocking_pids e espera por condição real. Grafo bilateral:CRM1094732→wrapper1095460 e inverso. PostgreSQL retornou40P01 em criarTarefa global. CRM foi vítima:0tarefas/0eventosTarefa; wrapperconcluiu:1tag/1eventoaprovação/statusAPROVADA. Todos os asserts de rollback passaram. A falha final v1 ocorreu no classificador, que esperava meta.code/inglês; Prisma5.22 retornou UnknownRequestError com40P01 no texto português. O log SQLSTATE+grafo prova o deadlock; não chamar esse detalhe de ausência de causa.

V1 IMUTÁVEIS em output/inbox-354-fk-causal-private:
- causal.test.mjs SHA256f6de65dec35159127be831f72e838a7f8202d6eb7207897b9cde95bae6c78240
- ledger.json SHA2566c11bac702f0a0f6d874cdc9f4b1fd2dc1b8e97d554cfa7c6ea5da7152a5dc89
- causal-red.log SHA2562bfd7edeaacb702502fc73a21f221d2c3da55dfbe8a31b3f034e517efe241d10

## RED nativo corrigido e patch mínimo

Regressão pública src/server/aria/decisao-inbox.fk-concorrencia.int.test.ts, SQL/ACL/ações reais e autenticação somente na fronteira de teste. A barreira inspeciona APÓS next(params), não altera argumentos/resultado, e aceita SOMENTE duas strings SQL exatas (FOR UPDATE ou FOR NO KEY UPDATE). Aguarda CRM concluir OU bloquear no Atendimento antes de liberar o wrapper. Grafo é oportunístico; o GREEN não exige ciclo. Erros classificam40P01 no texto quando Prisma não fornece meta.code.

Primeira tentativa públicaadeedc EXIT1/1caso foi instrumento que olhava sql/? em vez de text/$1; barreira não atingida, não RED de produto. Corrigida somente a observação do placeholder. RED60db37 EXIT1/1caso sobre produção7440 falhou EXATAMENTE ambos-sucessos, com40P01, ciclo bilateral1107420↔1107252 e rollback CRM0/0, wrapper1/1. Log output/inbox-354-fk-regressao-red-nativa.log. Esse é o RED comportamental para a correção.

Patch aprovado: Atendimento inicial FOR NO KEY UPDATE. Compatível com KEY SHARE do FK, continua bloqueando UPDATE do responsável. Não inverte Lead→Atend, não adiciona advisory, não altera Config antesAtend, locks ordenados de Lead/revalidações, APIsCRM globais ou executor. Executor continua podendo elevar para FOR UPDATE somente depois de o wrapper proteger leads.

MESMO teste GREEN065da6 EXIT0/1caso,5,70s. Ambos concluem;1tarefa/1eventoTarefa+1tag/1eventoaprovação; nenhuma ocorrência40P01/P2034. output/inbox-354-fk-regressao-green.log. Controle real adicional no decisao-inbox.int.test.ts observa UPDATE de responsável bloqueado pelo wrapper enquanto este espera o Lead; só após decisão a troca conclui, e a repetição sem responsabilidade é recusada.

## QA e regressões

TESTER em7440 registrou25225/ffebbd EXIT1 (80casos,79passagens): a expectativa antiga de RESPONDER com efetivo null não correspondia ao fechamento dos dois alvos. O controle foi PRESERVADO com NOTA_INTERNA (capacidade geralfalse, cartão explícitoautorizado e podeDecidirtrue); negativos separados RESPONDER/DOCUMENTO com efetivo null e positivo ambosautorizados permanecem. Nenhuma alteração adicional no predicado de produção.

INT37761/b722c4 EXIT1:4arquivos45casos/44passagens,175,50s. Passaram nativoCRM×wrapper,26contextuais/póslocks/serializaçãoresponsável e15consultas. Única falha: trace de pool1 só reconhecia FOR UPDATE e produzia índiceAtend=-1. Ajuste TESTE fechado para reconhecer FOR UPDATE ou FOR NO KEY UPDATE no Atendimento, mantendo ConfigSHAREúnico e Acao→Config→Atend. Reforçado também o assert percard NOTA. Repetição afetada90635/7a739e EXIT0:2arquivos18casos completos/sem filtro ou skips,93,11s. Não é execução completa45/global; o patchprod ficou literal entre as rodadas e as demais verificações já haviam passado.

Comandos: Node local max-old-space-size1024, vitest run --config vitest.integration.config.ts --maxWorkers1. Rodada45: decisao-inbox.fk-concorrencia.int.test.ts + decisao-inbox.int.test.ts + decisao-inbox.pool1.int.test.ts + consultas-inbox.aria.int.test.ts. Rodada18: somente os dois últimos. Nenhuma suíte simultânea no banco, configurações originais sem exclusões. Lint5 ee2284 EXIT0 --max-warnings=0 nos cinco arquivos tocados.

Banco usado somente pela lease coordenada ROOT, sem provider/HTTP/worker; perfil/client pins preservados. Todas as sessões/observers encerrados ao terminal. Fixtures finais permanecem no descartável: não afirmar restore/limpeza503 após as suítes. ROOT faz restauração coordenada.

## Entrega e limites

Filha separada de7440 para integração/QA. Pendentes TypeScript/gates globais, QA independente desta filha e visual do integrador. Sem schema, deps/install/config/env, build/Next/browser/HTTP, PR ou push. Contratos globaisCRM, capacidadesAria, D2/D3/355/356/357 não mudaram. Plano355 continua leitura e aguarda GO funcional.

Fechamento final de testes: após apenas tipagem explícita do PID e cleanup seguro dos clientes, replay10428/a9c2c3 EXIT0:2arquivos/2casos executados com filtro declarado '354: criarTarefa|lock inicial continua',25fora desse recorte. Confirma novamente ambos sucessos nativos e serialização de responsável na fonte final; não é suíte completa27. Lint final5 51de77 EXIT0 --max-warnings=0. Diferença de produção conferida d60d2d: exatamente1consulta; CRM global/executor/histórico/predicado/capacidades/componentes literais7440. V1causal mantém os três hashes originais.
