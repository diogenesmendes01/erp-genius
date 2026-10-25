# QA DEV A — candidata #332

Base composta da8937d2635737fb328afbdc36d35dd9ad230fc8, pais720ac2bf e11194158 revisados pelo ROOT. Branch codex/inbox-e2-332-tarefas-fio; fonte candidata para revisão, sem homologação presumida. Somente worktree A; AGENTS gerado preservado. Sem install/schema/client/config/env/cluster/provedor/push/build/TSC/global pelo DEV.

## Evidências causais e controles

| Execução | Terminal | Resultado |
| --- | --- | --- |
| Intercalação ausente | c33d99 | EXIT1, módulo ainda ausente; não é RED comportamental |
| Decoração sem variante tarefa | d45803 | EXIT1, 1 falha/8 controles, TypeError real no laço anterior |
| Composição E0/350 inicial | 147773 | EXIT0, 3 arquivos/40 testes |
| Cartão ausente e callback opcional | 93de21 / daf449 | EXIT1 módulo ausente; depois EXIT1 1 falha/6 controles antes de esconder edição sem callback |
| Rodapé/menu e DOM real | 3f64f1 /25932d | EXIT1, 3/13 e3/4; depois ca2909 EXIT0,5/28 |
| Controlador ausente | 86dc33 | EXIT1 módulo ausente |
| Controlador inicial | f8d943 | EXIT1, só expectativa textual lowercase do resultado incerto; ajustada ao texto canônico |
| Wiring da thread | 67dfac | EXIT1, 2 falhas/13 controles; controller real já verde |
| Replay terminal thread/cartão | 958437 | EXIT0,4 arquivos35 testes,3.98s; log anterior verde sem terminal não foi usado como aprovação |
| Entradas Inbox | a75bad →4d69fb | EXIT1,3 falhas/108 controles; EXIT0,111/111 |
| Guardas originais7 |33789/cfd6d3→73421/0561ff|EXIT1,2 falhas/331 controles (mapa nominal/cor inexistente); EXIT0,7/333,64.04s |
| Focais23 inicial |86753/fa1ce8|EXIT1,1/394: expectativa antiga do token de cor, produto já usava paleta válida |
| Seção de ações |abca3d|EXIT1,2 casos antes de entrada Criar tarefa; segunda rodada74330/ba2d8e revelou fixture sem capacidade e seletor apenas aria-label inadequados para texto visível; corrigidos só nos casos novos |
| Focais23 |13527/95c043|EXIT0,23 arquivos397 testes,12.79s |
| Pedido nota A→B→A |b9c1c1|EXIT1,1 falha/111 controles; pedido antigo reaparecia. Correção encerra estado na troca e usa sequência independente |

Testes DOM usam React/StrictMode e CampoTexto/Compositor reais. Doubles limitados aos limites serverActions/ícones no DOM mínimo; SSR usa ícones reais. Provas incluem campo físico/rascunho preservados, foco não roubado em refresh, tarefas sem envio, A→B→A, revogação404→200, erro/transporte sem retry, duplo clique e SSE próprio antes do ACK. VirtualList real preserva botão físico focado/chave de tarefa ao cruzar99→101→99; isso prova montagem/foco no DOM mínimo, não layout visual de navegador. Casos adicionais escritos após implementação são regressões, não reivindicados como RED causal.

## SQL nativa

Config original vitest.integration.config.ts, perfil próprio dev-email492, base558 restaurada/admitida pelo ROOT, Node local, UTC/w1/heap1024, sete flags externas vazias. Uma suíte por vez, sem filtro de caso/skip nas rodadas verdes. paineis.int.test.ts +painel-tarefas.int.test.ts: sessão53361/terminalbb7926 **EXIT0,2 arquivos17 testes,65.22s**. Controles reais de três estados diretos, mesmo lead/outra conversa excluído, só lead excluído, outra carteira excluída, professor sem tarefas.ver vazio, fora escopo null e Secretaria sem lead/com atendimento encerrado sem envio. Leitura não modifica tarefas.

Negativos preservados:83374/237fa1 EXIT1,2/15 (campo ausente e fixture que supunha sem envio num atendimento aberto cujo legado autorizava envio);5580/7f98c0 EXIT1,2/15 (novos casos já verdes, contratos exatos existentes precisavam campo aditivo tarefasNoFio). Fixture de Secretaria foi encerrada para caracterizar sem envio sem alterar permissões. Quatro expectativas DTO exatas receberam tarefasNoFio:[], sem afrouxar matcher. Lease liberada explicitamente após terminal; ROOT é responsável por restauração. Nenhuma nova SQL após liberação.

## Registros e pendências

Mapa de botões recebe somente CartaoTarefaFio Editar fantasma/sm e Concluir secundario/sm; AbaOportunidades Criar tarefa e Adicionar nota fantasma/md. BotaoIcone mantém primitivo canônico. Nenhum parser/regex/exceção de arquivo foi ampliado. Nenhuma action/ACL/TX de330/331 alterada.

Blueprint offline output/inbox-332-fixture-blueprint-v1-private.json, SHA256 a39e537c4e261c1c2f555db7d0f1ae037f95c1366554e5450b9cd210663166e5. Somente registros novos fictícios, quatro atores, três contextos,13 tarefas/controles e paginação opcional; aplicação/snapshot/credenciais exclusivos ROOT. Não aplicado, não READY. Matriz APP/PROTO original1440×900,1024×768,390×844 ×claro/escuro proposta, nenhuma captura reivindicada.

Pendentes: TSC/global/lint originais do integrador, QA independente do SHA congelado, composição #354/patch437C1 e aceite visual fio-tarefa anexado à PR. Sem PR/push pelo DEV.

## Verificações finais da candidata

Regressões da composição: sessão97856/terminale58624 EXIT0,10 arquivos262 testes,10.05s; inclui o caso novo A→B→A e controles originais de Inbox/foco/detalhes/Aria-eventos/Conversa/menções/handoff/cartão350. Lint whitelist29: terminalfad680 EXIT0, zero erros/warnings, --max-warnings=0; lista exata privada em output/inbox-332-lint-whitelist-private.json. Núcleos/actions330/331 e ModalTarefa/Modal comparados à base da8937d2 sem diff; único runtime servidor novo é a leitura aditiva do painel. AGENTS SHA2560544fa933b6a99c977a69e49aa01fe616ea88b8fb96bf06bd42722648eab22b8 preservado.

UNITs usam configuração original, Node local, TZ=UTC, um worker; heap1024 nos focais e2048 nas guardas. São recortes completos dos arquivos nomeados, sem filtros de casos ou skips, não uma suíte global. Contagens se sobrepõem e não devem ser somadas como testes únicos. O recorte adicional final reforça A→B→A do controlador sem key por atendimento no harness, exercitando sua geração própria.
Guardas finais ampliadas: sessão34396/terminal8589c9 EXIT0,15 arquivos464 testes,89.10s (13 guardas completos, Botao e controlador DOM sem key por atendimento). Incluem os sete anteriores e fundo sobre página, estados vazios, confirmações, contraste e tipografia. O mapa final já inclui a entrada Criar tarefa da seção de ações. Sem filtros/skips.

Lint final da mesma whitelist29: terminal00d718 EXIT0 com --max-warnings=0. ROOT confirmou restauração do banco dev-email492 após liberação, terminal184c39 EXIT0,424 hashes/558 originais; sem nova lease SQL. Composição posterior21f55/patch437C1/#354 não foi importada nesta candidata.

## Replay global original e correção filha de8b8

Global original da fonte8b8be9f0: sessão26145/terminalab2fff EXIT1,989 arquivos (987 passaram/2 falharam),8.523 testes (8.521 passaram/2 falharam),272.69s,UTC/maxWorkers2/heap2048, sem filtros/skips. Negativos reais preservados: design-system proíbe IconBrandWhatsapp no cartão; identificacao-registro acusa tarefaEmEdicaoId somente na prop interna VirtualList.pinKeys. ESLint . original da mesma fonte:81736/45e511 EXIT0,zero erros/50 warnings; isso não representa lint sem warnings. JSONs privados registram fonte/comandos/exitCode reais.

GO técnico ROOT: ícone trocado por IconMessageCircle canônico, guarda design-system literal. EXCECOES_ID recebe uma entrada nominal por arquivo/tipo prop/expressão exata/alvo tarefaEmEdicaoId/vezes1/categoria nao-registro; cópia literal atualizada. Âncora AST separada no teste exige exatamente uma ocorrência da expressão como prop de VirtualList; trocar por Outro ou duplicar falha. Parser genérico, conferirExcecoesId, listas livres e limites permanecem literais. Controles de mutação recusam ID em texto, aria-label e placeholder; title continua livre pela política histórica, não foi alterado. DOM real confirma chave só em data-virtual-key, sem texto/aria-label/title do botão.

RED causal novamente26a8c3 EXIT1,3 arquivos57 testes (2 falhas/55 controles), com novos controles já presentes e sem corrigir runtime/registro. GREEN9c3660 EXIT0,6 arquivos79 testes,6.99s: design-system, identificacao-registro, VirtualList.estavel e consumidores cartão puro/controlador/thread. Não chamar esse recorte de global. Nova fonte filha será submetida novamente a global/eslint originais e TSC original8192 conforme janela coordenada pelo ROOT. Sem nova SQL/DB/build/PR/push.