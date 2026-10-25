# QA DEV A — candidata #331

Base1ebbadc7; branch codex/inbox-e2-331-modal-tarefa. Candidata para revisão, não homologada. Sem alteração de schema/client/deps/config, sem provedor externo. Banco isolado dev-email492/558 foi reservado pelo ROOT; apenas uma integração de cada vez. Lease liberada após sessão59529 terminal8dec37 EXIT0; restauração é exclusiva do ROOT.

## Evidências terminais

| Recorte | Sessão / terminal | Resultado |
| --- | --- | --- |
| CRM referência anterior à extração |43896 / c4c285|EXIT0,1 arquivo15 testes,56.45s|
| CRM após extração inicial |7677 /6ca9a8|EXIT0,1/15,55.58s|
| Criação/edição nativa inicial |95513 /b235be|EXIT0,1/5,21.81s|
| Adversariais SQL e pool1 |93067 /b19fbd|EXIT0,2/13,52.01s|
| SQL final, inclui regressão CRM |59529 /8dec37|**EXIT0,3 arquivos35 testes,135.46s**|
| Guardas completas6 + DOM inicial |84077 /d1803a|EXIT0,7/369,76.97s,heap2048/w1|
| UI/CRM puros, recorte8 |ffdfc5|EXIT0,8/207,7.75s|
| Wiring Inbox + Modal DOM |3a2944|EXIT0,2/112,3.06s|
| Modal DOM ampliado13 |b32169|EXIT0,1/13,884ms|
| Lint whitelist18 |823f3a|EXIT0,zero erros/warnings|

Rodadas SQL: executável Node local, vitest.integration.config.ts original, TZ=UTC, maxWorkers1, heap1024. Perfil local isolado; MOTOR_URL/API, OpenAI/Anthropic e WA_LIVE em branco; configuração original também zera MOTOR. Nenhum filtro ou skip nas rodadas verdes acima. UNIT não é suíte global; recortes sobrepostos não devem ser somados. Rodada final UNIT18: sessão99758/abc344 EXIT0,18arquivos614testes,99.80s,UTC,w1,heap2048; sem filtros/skips. Inclui15 casos DOM do modal. Lint final whitelist18 cfe36e EXIT0,zero erros/warnings. Não houve TSC/global/build pelo DEV.

## Oráculos e limites

SQL final35 = CRM15 +19 novos casos +pool1real1. Usa PostgreSQL nativo e actions reais; somente sessão/cache Next são doubles de fronteira. Pool1 altera a URL no processo do teste para connection_limit1 e executa metadata, criar+concluir+replay e editar reais, sem cliente global dentro da TX.

Cobertura nova: JáFeita atômico, hash inclui intenção, replay não duplica nem reconclui, tarefa sem lead, título200/201, contexto/fuso divergentes e IDs arbitrários recusados, vínculo manter/remover/vincularAtual, Pessoa incompatível/lead de outro contexto, instante DST/duração e rearmar lembrete somente quando muda.

Barreiras SQL comprovam espera por pg_stat_activity.wait_event_type=Lock no Atendimento. Papel/contexto são alterados antes da liberação; ação relê depois da espera e recusa. Edição manter tolera perda só de visibilidade; troca real de lead/Pessoa recusa. Duas edições e edição×cancelamento ficam simultaneamente bloqueadas (dois waiters) e têm um vencedor/CAS/Evento. finally libera e drena promessas e desconecta holder. Isso não prova ausência geral de deadlocks.

NOTIFY é verificado por conexão pg LISTEN real e sentinela: commit publica um aviso, replay não publica, erro injetado **depois** do UPDATE/trigger não publica e desfaz tarefa/Eventos. Falha de aviso injetada é prova de rollback, não erro espontâneo de produto. Eventos espelhados de Lead são distinguidos pelos agregados.

DOM usa React/Modal/CampoTexto/ConfirmarAcao/useAcaoCliente reais no DOM mínimo local. Actions são doubles; refresh de props simula SSE e não comprova HTTP/SSE de rede. Prova loading/erro/retry, validação, chave retida em transporte incerto, camposAlterados, campo físico/rascunho preservado em refresh, alvo mudado, A→B→A, cancelamento único/motivo/duplo clique, ACK próprio após refresh e erro preservando motivo. Wiring adicional usa o harness histórico sem DOM, identificado como tal; não substitui DOM real nem visual.

## REDs e negativos preservados

-450e1c EXIT1: CLI recusou minWorkers antes de executar teste; corrigido para maxWorkers1, sem configuração nova.
-4b2841: teste do núcleo não carregava módulo ainda inexistente; 589766 e0bcd1b: regras/modal inexistentes. cb2574:5 casos nativos falharam por actions ainda ausentes. Esses REDs de fronteira não são anunciados como provas de concorrência.
-eaa00a:1falha/3pass na opção interna vínculo/CAS ignorada; bdacc5:1falha/4pass comprovou falta de validação comercial no vínculo interno. Corrigido no núcleo sem alterar a API pública.
-2c7211: double Prisma incompleto para atendimentoVisivel; corrigida a fronteira do teste, não o produto. d4d0e2: DOM mínimo sem options de select; adotada a mesma instrumentação local existente, sem mockar componente canônico.
-37560/0fd97d EXIT1:4 falhas de guardas e OOM1024; 360pass/4fail,1erro. Ajustes: mapa fechado9 botões, dois rótulos dinâmicos exatos, exceção nominal de submit que não é toggle; token de abertura separado da versão. Parser/regex e negativos das guardas intactos. ROOT autorizou heap2048/w1.
-0f4bc3 lint EXIT1: leitura de refs durante render; corrigido com estado de abertura/tentativa. ae1f5d lint4files EXIT0 depois.
-99842/cd1a3c EXIT1:10pass2fail por pg_stat_clear_snapshot retornar VOID em queryRaw. Instrumentação alterada para executeRaw, mesma asserção; não é deadlock produtivo.
-42025/581094 EXIT1:29pass1fail,fixture nova de usuário sem senhaHash. 77407/24524f EXIT1:15pass3fail,fixtures de Tarefa com inicioEm sem dataCivil violavam CHECK existente. Corrigidas fixtures, sem alterar restrição/schema/produto. Barreira Pessoa usa contato.id real; finally drena todas as promessas.

Os novos controles adversariais além do primeiro RED foram adicionados após implementação inicial; são regressões/cobertura, sem alegação de RED causal individual.

## Registros fechados e pendências

Novos registros: ModalTarefa no MAPA_BOTOES (9 controles); ROTULOS_DINAMICOS key tipo/key a.id (uma ocorrência cada); ALTERNANCIAS_SEM_ARIA_PRESSED somente submit Criar tarefa · Salvar (cinza/principal sinaliza validação, não seleção); confirmação de cancelarTarefaNoInbox somente no callsite ModalTarefa e cópia literal da guarda. Não há exceção por pasta/arquivo inteiro nem aria-pressed fictício.

Pendentes: TSC/fullUNIT/lint originais ROOT, QA independente no SHA exato, visual APP+PROTO original 3larguras×2temas (nova/editar, erro/loading, sem lead/equipe, teclado/foco/mobile), CI/PR/merge. Nenhuma prova antiga435/436 é atribuída a esta fonte. Não iniciar338/339 ou outra feature.
