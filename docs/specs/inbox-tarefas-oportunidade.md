# Tarefas da oportunidade no Inbox — #330 (D10)

Status: candidata técnica aprovada nos gates originais e revisão independente da fonte5e0f117b, PR436 draft. Aceite visual e gates de publicação continuam pendentes; não homologada nem concluída. Branch DEV `codex/inbox-e2-330-tarefas`, base329 `26c4da69f4785ea57d4393a4069a871fa2597915`.

## Escopo aprovado

A aba Oportunidades mostra tarefas autorizadas do atendimento ou do lead atual: abertas e cinco concluídas mais recentes; canceladas permanecem no histórico e aparecem somente ao consumidor de vínculo direto do fio. A consulta sempre intersecta pertença OR e escopoTarefas; lead null nunca vira critério global. Tarefas diretamente ligadas sobrevivem à ausência de oportunidade atual. Não amplia a aba a outros setores.

Concluir, reabrir, reagendar e cancelar com motivo usam uma transação. Cancelar mantém histórico, exige motivo trim1–500 e aceita replay apenas do mesmo autor/motivo depois da autorização. Criar/editar continuam dependentes da #331: callbacks preparados, controles somente quando o consumidor real existe. Campos adicionais D10, recorrência/colegas e prioridade BAIXA pertencem à #338; nenhum schema novo.

## Transações e autorização

A extração aprovada pelo integrador move apenas quatro transições para `crm/tarefas-transicoes.ts`, sem use-server; APIs CRM públicas preservadas, incluindo resultado opcional e InteracaoRegistrada somente quando texto/canal reais existem. Não chama ação pública nem cliente global de dentro da transação do Inbox.

Ordem parcial: ConfiguracaoOperacional FOR SHARE somente no reagendamento → Atendimento selecionado FOR UPDATE → Tarefa candidata FOR UPDATE. Após esperas, relê usuário ativo/papéis/permissões pela tx; exige tarefas.ver, atendimentoVisivel e escopoTarefas. O predicado do CAS também contém escopo/pertença, versão e status. Não depende de funil.mover e não concede capacidade a convidado. Replay continua sujeito à ACL atual. Evento, efeitos de lembrete e aviso UPDATE Atendimento participam do mesmo commit; falha propaga antes de executarAcao convertê-la em Resultado.

Refresh dos writers26c: CRM/assumir/lembretes escrevem Tarefa sem lock posterior do Atendimento; Aria CRIAR_TAREFA usa AcaoAgenteIA→Tarefa, sem aviso do Atendimento nesse ramo. Vincular329 usa Atendimento→Contato→Lead, desvincular329 Atendimento→Contato. Não foi identificado ciclo concreto nesses callsites; não se afirma ausência global de deadlocks nem linearizabilidade global de ACL.

## Calendário e fusos

Atalhos hoje18/amanha9/amanha14/seg9 usam calendário institucional explícito. Hoje18 requer futuro estrito; segunda sempre próxima; candidatos pulados/repetidos são omitidos, sem parser de Date no fuso do processo. Amanhã é recalculado no clique, inclusive quando o painel atravessa meia-noite.

O wrapper novo recebe q.fusoEscolaEsperado, compara com Config atual na tx e recusa painel antigo. Resolve o instante na escola e preserva esse instante no núcleo, sem round-trip de texto em dobra DST da origem. Mantém fusoOrigem; dataCivil/hora e grupoDaTarefa são coerentes nesse fuso, inclusive quando civil da origem ainda é dia anterior. A tela global /tarefas conserva sua regra atual.

## Interface e extensão coordenada

Lista: contagem aberta, checkbox concluir/reabrir, prazo/origem, responsável/tipo central rotular(TIPO_TAREFA_LABEL), atraso na cor canônica perigo e indicador IA. Reagendar/editar/cancelar somente abertas; concluir/reabrir/reagendar usam useAcaoCliente idempotente:false sem retry automático. Cancelar usa ConfirmarAcao real idempotente:true, um único alertdialog com Motivo, Voltar/Escape e foco seguro.

Extensão compartilhada explicitamente aprovada pelo Root: `ConfirmarAcao.podeConfirmar?:boolean`, default true. A validação adicional compõe aguardaConferencia/aguardaDigitacao e bloqueia disabled e handler. Não substitui autorização/validação do servidor. Mantém consumidores por padrão. TDD RED952e13 (2falhas/18pass)→GREEN62e5f1 (4arquivos30). A sessão só muda de identidade ao trocar atendimento. Refresh ou mudança de outra tarefa conserva o formulário e o motivo. O cancelamento guarda snapshot explícito do próprio alvo e um token de abertura: mudança/remoção desse alvo invalida a confirmação sem desmontar o campo; a invalidação persiste mesmo se a linha reaparecer. Geração nos handlers/effects veta ACK antigo; o render usa estado puro. ACK A→B→A antigo não fecha nova sessão nem atualiza outro painel. Trocar campo durante envio não produz segundo request, e o primeiro request conserva os argumentos do clique original.

Manifestações nominais: novo EstadoVazio compacto, botões específicos e par exato cancelarTarefaNoInbox/callsite no registro ConfirmarAcao e cópia literal. Não há exceção nova nem relaxamento de parser/guardas. Tokens text-danger-text/text-text-muted do plano não existem no Tailwind atual: usa text-red-700/text-gray-600, sem inventar token global.

## Evidências e limites

- 329 FullUNIT base: sessão30541/terminal6f8ad2 EXIT0,966arquivos8219testes, UTC/w2/heap1536, zero filtros/skips. Prova privada própria; não equivale à regressão330.
- Atalhos RED módulo ausente→GREENeb4e79 EXIT0,2arquivos17. UI inicial SSR RED módulo ausente→GREEN98fb6e,17; integração Aba RED funcional5b076d→GREEN373d6e,46.
- Ações RED14168/2e3262 por funções ausentes→GREEN29779/509ad6 EXIT0 novos4+CRM15=19. Corridas posteriores não foram chamadas de RED causal.
- Ações ampliadas78979/4083c4 EXIT0,14SQL reais: esperas observadas pg_stat_activity para troca lead/papel/inativo/escopo; concorrência SQL nativa de concluir/cancelar; DST e rollback após aviso SQL com falha injetada. Não confundir injeção de falha com concorrência.
- Painéis99553/d77b3f EXIT0,2arquivos11. Guards69465/8f3059 EXIT1,364pass/4fail: novos manifestos e cores canônicas corrigidos; confirmação/enums/transport/fundo já passavam.
- Meia-noite RED4507e9 (1falha/7pass); correção rederiva o atalho no clique; regressão em curso.
- Gates55564/7aa6b0 EXIT0,10arquivos389; SQL61008/901d01 EXIT0,3arquivos21 (ações18/pool1real1/consulta2); regressões38708/d05145 EXIT0,3arquivos20. UNITfinal87731/bba26c EXIT0,16arquivos474,60.19s; lint24b0d3c0 EXIT0. Stale-fuso REDb6f2c4→GREEN4181bb,9/9, integrado na rodada474. Não é regressão global nem homologação.

Pendentes: terminais dos recortes atuais, TSC no integrador e regressão global coordenada, revisão TESTER no commit exato, aceite visual APP/PROTO claro/escuro×três larguras e evidência no PR. Sem browser/fixture/realaction visual nem envio/provider ativado nesta implementação. Não publicar nem marcar issue concluída enquanto gates obrigatórios faltam.
## Correção filha da candidata697 — revisão global

Root executou TSC original54920/2754c9 EXIT2: único TS2739, fixture de ausência de oportunidade sem tarefas/fusoEscola. FullUNIT46010/7ca0b4 EXIT1:969arquivos,967pass2fail;8246pass/2fail8248. Guardas campos-texto/formularios-preservados e TESTER encontraram, respectivamente, campo nativo fora do componente canônico e remount de todo formulário por versões da lista. Estes negativos são preservados, não homologação.

Correção limitada: fixture com DTO completo; CampoTexto real, minLength1/maxLength500/required e ChangeEvent<HTMLTextAreaElement>; identidade da sessão só atendimentoId. Atualização de outra tarefa mantém o mesmo campo físico e valor. Atualização/remoção do próprio alvo, fora de uma tentativa própria em voo, mantém o rascunho mas invalida a confirmação, mostra erro e ignora ACK antigo. Uma resposta ok da tentativa ativa pode reconciliar o refresh esperado do próprio cancelamento, conforme revisão R2 abaixo. Não renomeia versao nem altera qualquer guarda. Concluir/reabrir/reagendar reconciliam somente se identidade/versão/status do próprio alvo continuam atuais. Nenhuma mudança em src/server ou SQL697.

RED49350/5944c6 EXIT1:3arquivos42,5falhas/37pass (2guardas +3DOM). GREEN97005/713e5c EXIT0:42/42. Lint57fefb detectou leitura de ref em render; correção de estado explícito→lint4213dd EXIT0,3arquivos,0warnings. UNIT18 intermediária58803/a03e90 EXIT0,509/509; final60159/5058f8 EXIT0,18arquivos510,80.13s, inclui negativo de remoção/reapresentação do alvo. Regressão global e TSC precisam de nova execução pelo integrador sobre a filha; sem repetir SQL já verde, backend literal697 e banco sem lease.
## Gates originais e revisão independente — fonte5e0f117b

PR [#436](https://github.com/diogenesmendes01/erp-genius/pull/436), draft aberta pelo integrador, branch `codex/inbox-e2-330-publicacao`, head `5e0f117beabc6fa59c3419564c8d7b063850424a`, base real #435. Este filho altera só documentação; fontes de produção/teste permanecem literais5e0.

- ROOT TypeScript ORIGINAL `tsc --noEmit --incremental false`: sessão53463/terminal03fd29, EXIT0, config inalterada e sem exclusões novas; prova privada `output/inbox-330-final-tsc-terminal-root-private.json`.
- ROOT UNIT completa ORIGINAL UTC: sessão19816/terminal1287ab, EXIT0,969arquivos8254testes,234.20s, sem filtros/skips solicitados; provas `output/inbox-330-final-global-terminal-root-private.json` e raw/log correspondentes. Não somar à rodada DEV18/510.
- ROOT lint ORIGINAL `eslint .`: sessão97309/terminalf24d9c, EXIT0,0erros/50warnings, configuração inalterada; provas `output/inbox-330-final-lint2-terminal-root-private.json` e log. A primeira rodada global de lint5e0 havia saído1; é negativa histórica separada. Arquivos privados e caches foram arquivados pelo integrador preservando hashes, sem install/config/ignore novo; o DEV não os moveu.
- TESTER independente no head5e0: parecer favorável informado pelo ROOT (identificador e3c7c1e…),34arquivos completos/749testes mais17controles adversariais, EXIT0. Backend continua literal697; integração independente8arquivos66testes foi concluída e o banco restaurado. Não agregar essas contagens às unitárias nem tratar testes instrumentados de falha como SQL concorrente.

Os negativos originais TS2739/CampoTexto/remount da fonte697 e o lint intermediário permanecem no histórico acima. A aprovação técnica sobre5e0 os substitui como estado atual; não transforma a execução697 em green. Ainda pendem aceite visual APP/PROTO e demais gates de publicação/CI/merge coordenados pelo integrador. PR draft e feature não marcada concluída; nenhuma publicação foi feita pelo DEV. #331 criar/editar e #338 extras seguem reservadas. Sem nova execução de Node/SQL/DB nesta atualização documental.
## PR436 — revisão R2 dos comentários C3 e C4

Referência: [comentário6398421505](https://github.com/diogenesmendes01/erp-genius/pull/436#issuecomment-6398421505). Esta revisão preserva a autorização e o contrato das mutações330; não usa os gates históricos5e0 como homologação da nova fonte.

C3: a tentativa de cancelamento em voo fica associada à abertura e ao próprio resultado. Enquanto aguarda, o refresh esperado da tarefa não mostra obsolescência prematura. Uma resposta ok autoritativa fecha/reconcilia somente a mesma tentativa e abertura ainda vivas, mesmo se o item já saiu da lista. Trocar A→B→A, fechar/reabrir, desmontar por403/404 ou perder a permissão continuam invalidando a resposta antiga. Em erro ou resultado incerto, o motivo permanece e a obsolescência é aplicada sem presumir sucesso. A confirmação real continua serializando cliques; não há retry automático, hook/catch redundante ou extensão de componente compartilhado.

C4: o cálculo de podeVerLeadNaThread agora precede a consulta de tarefas, tornando explícita a separação. Não há early-return antes de carregar tarefas: sua ACL continua sendo escopoTarefas intersectado com a pertença OR do atendimento/lead. Vínculo direto sem lead e tarefa própria de oportunidade oculta continuam autorizados; negar a alçada comercial do lead só impede o DTO da oportunidade.

TDD: C3 REDa7aeca,2falhas/17pass; GREEN95934/db6353,2arquivos86 (20DOM+66guardas). C4 RED3c2ebc,2falhas/1pass→GREEN4157aa,3/3. INT46569/ca6c5f EXIT0,2arquivos13,65.49s, incluindo tarefas próprias por vínculo direto e por lead oculto, sem Evento. UNIT final36496/d4922d EXIT0,19arquivos518,93.49s,UTC/w1/heap1024,sem filtros/skips. Lint whitelist5 904df3 EXIT0,0warnings.

Os testes DOM usam os componentes/hooks reais com serveraction double e refresh de props simulando a chegada de SSE antes do ACK; não são prova de entrega SSE no browser. Os controles403/404 simulam a desmontagem da superfície, sem alegar uma chamada HTTP real. QA visual APP/PROTO e gates originais/independentes da fonte R2 continuam com o integrador. Banco e Node foram liberados; #331 permanece suspensa.