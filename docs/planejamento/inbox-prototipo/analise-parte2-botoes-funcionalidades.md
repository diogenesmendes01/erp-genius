# Inbox: protótipo × ERP, parte 2 (botões, ações e funcionalidades)

Fontes conferidas: `prototipo/Inbox.dc.html` (as linhas citadas como "L123" são desse arquivo), `role.js` e `mobile.js`; ERP em `/home/claude/erp-genius` (main `7e4810e5`), com caminhos relativos a `src/`; `planejamento/03-funcoes-do-inbox.md` (doc 03), `02-modelo-atendimento-crm-erp.md` (doc 02) e `plano/03`, `04` e `05`; e `docs/planejamento/quadro-entregas.md`. Só leitura: nada foi alterado no repositório.

## Resumo executivo

1. **A base de atendimento está pronta e é mais rica que o protótipo** em governança: assumir, devolver, atribuir, transferir entre setores, convidar, encerrar, nota, agendar, opt-out, cobrança, vínculo de contato, triagem, ações por mensagem (reagir, encaminhar, editar, apagar) e SSE.
2. **O protótipo gira em torno do estado da Aria, e no ERP esse estado quase não chega à tela.** Faltam o chip e o selo "IA atendendo / Aprovação / Handoff", os filtros e contadores, o cartão de sugestão na conversa, a faixa e o modal de handoff, o compositor travado com "Assumir para responder" e o interruptor "Aria ativa". A Aria só aparece num bloco do painel lateral (`app/(app)/inbox/PainelAria.tsx:30-47`).
3. **O painel do protótipo é um mini-CRM** (abas, tags, campos, etapa, tarefas, perdido, outras oportunidades, histórico com desfazer, Insights). No ERP ele é só leitura por setor. Quase todo o back-end disso já existe (tarefas, tags, campos, `moverEtapa`, `marcarPerdido`, `desfazerAcaoAria`), então o gap ali é sobretudo de UI.
4. **Bugs reais encontrados:**
   - abrir a conversa não marca como lida: `marcarLida` e `marcarConversaLida` existem, mas nenhuma tela as chama;
   - o selo "Prazo estourado" usa um `agora` congelado na montagem (`ListaAtendimentos.tsx:31`);
   - notas internas são gravadas, mas nunca exibidas;
   - os itens "Contato", "Enquete" e "Localização" do anexo não têm `onClick` (`Compositor.tsx:255`).
5. **Há conflitos de regra com decisões registradas.** Status manual e "Arquivar" vão contra o doc 03. Bloquear sem motivo e por qualquer papel, aprovar sugestões e pausar a Aria pelo vendedor, transferir para pessoa por qualquer atendente e o compositor travado enquanto a IA atende vão contra a matriz e a DF5-13 ou DF5-6. São 20 perguntas ao dono.
6. **Números do inventário:** 149 itens comparáveis com o protótipo: 27 EXISTE, 27 PARCIAL, 17 DIVERGE e 78 FALTA. Dos 78 FALTA, 39 são só de UI e o back-end já existe.

## Como ler as tabelas

- **Status:** EXISTE, PARCIAL, DIVERGE ou FALTA. Linhas marcadas "(ver X)" repetem um controle já contado e não entram nos números.
- **Tipo de gap:**
  - **UI:** o back-end existe e a função é citada;
  - **back-end:** falta ação, consulta ou modelo;
  - **motor:** depende do motor;
  - **Aria:** depende do turno, da configuração ou de dado da IA.
- **Papéis no protótipo:** o protótipo só distingue três papéis (`ROLE` em L866, a partir do `localStorage` de `role.js`):
  - **vendedor:** vê só conversas com dono "Você", "{AI}" ou sem dono (L879);
  - **seletor de número (`WA_VIS`):** admin, ou gerente com a flag `crm-ger-wa` (L871);
  - **"Gerenciar números":** só admin (L104 e L1115);
  - **demais controles:** iguais para os três papéis, sem nenhuma checagem. Na tabela isso aparece como "todos".

---

## 1. Lista de conversas

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| L1 | Seletor "Todos os WhatsApp · N conectados" (ícone smartphone, chevron) | Abre o popover "Ver conversas de" com todos os números: ponto de cor, número, contagem de conversas, aviso "Instável" e check. Filtra a lista por `waSel` (L42, L99-106, L1115-1117) | admin; gerente com flag | Select "Número" no `PainelFiltros` (`app/(app)/inbox/PainelFiltros.tsx:66-69`), com opções de `opcoesFiltroInbox` | **PARCIAL** | UI + back-end | Sem contagem por número e sem saúde "Instável" (há `server/whatsapp/saude.ts`, mas não ligado à lista). No ERP o select aparece para todos os papéis do Inbox. |
| L2 | Link "Gerenciar números em Configurações" | Leva a `Configuracoes.dc.html#wa` (L104) | admin | Tela existe (`app/(app)/configuracao/whatsapp/NumerosPainel.tsx`), mas o Inbox não tem atalho | **FALTA** | UI | Trivial. |
| L3 | Botão Filtros (ícone list-filter) com selo de quantidade | Abre o popover "Filtrar conversas" com grupos e contagem por opção (L44, L80-98, L1036-1048) | todos | Filtros sempre visíveis (`PainelFiltros.tsx:53-75`), sem popover | **DIVERGE** | UI | O ERP mostra selects fixos de setor, número e status. |
| L4 | Filtro "Etapa do funil" | Multi-seleção pelas 6 etapas (L1047) | todos | Não existe | **FALTA** | back-end + UI | `condicoesDosFiltros` (`server/inbox/consultas-pagina.ts:56-67`) não filtra por etapa da oportunidade. |
| L5 | Filtro "Tags" | Multi-seleção (L1047) | todos | Não existe | **FALTA** | back-end + UI | O dado existe em `PessoaTag`, mas sem condição na consulta. |
| L6 | Filtro "Responsável" (pessoas e "Aria") | Multi-seleção (L1047) | todos | Chips "Minhas" e "Fila" (`PainelFiltros.tsx:46-47`). A URL aceita `resp=<id>` (`server/inbox/filtros.ts:21-22`; `consultas-pagina.ts:62`) | **PARCIAL** | UI (+Aria) | O back-end já filtra por id. Falta o seletor de pessoa. "Aria" como responsável não existe como conceito. |
| L7 | Filtro "Tipo de contato" B2C/B2B | (L1047) | todos | Não existe | **FALTA** | back-end + UI | `Pessoa.empresaId` existe no schema. |
| L8 | Filtro "Não lidas" | Opção "Outros" (L989) | todos | Chip "Não lidas" (`PainelFiltros.tsx:48`; `consultas-pagina.ts:66`, não lida pessoal) | **EXISTE** | — | O ERP calcula por usuário, como manda o doc 03. |
| L9 | Filtro "Fixadas" | (L989) | todos | Fixadas vêm no topo (`consultas-pagina.ts:94-97`), sem filtro | **FALTA** | UI + back-end | É uma condição pequena (`fixadaDoUsuario`, `consultas-pagina.ts:70-71`). |
| L10 | Filtros "Tarefa atrasada" e "Sem tarefa aberta" | (L989) | todos | Não existem | **FALTA** | back-end + UI | |
| L11 | Filtros "Sem resposta há +15 min" e "+1 h" | Limiares fixos (L989; `WAIT`/`SLA_MIN` em L872) | todos | Chip "Prazo estourado" (`PainelFiltros.tsx:49`; `consultas-pagina.ts:64`), pelo prazo do setor | **DIVERGE** | regra | O ERP usa o prazo configurável por setor (pendência Q3 da Fase 3), não 15 min ou 1 h fixos. |
| L12 | Contagem em cada opção, chips removíveis, "Limpar" e "Mostrar N conversas" | (L88, L129-134, L94-95, L1040) | todos | Nada disso | **FALTA** | UI + back-end | As contagens exigem consulta agregada. |
| L13 | Nova conversa (lápis, `square-pen`) | Popover com busca por nome ou número; lista "Contatos e conversas recentes"; "Conversar com +55…" cria contato e oportunidade em Novo lead; abre a conversa existente se o telefone já existe; a conversa nasce "humano/Você", com evento "a primeira mensagem precisa ser um modelo aprovado" (L45, L48-79, L934-939, L1041-1054) | todos | `NovoAtendimento` acima da lista (`app/(app)/inbox/page.tsx:69`; `NovoAtendimento.tsx:25-63`): escolhe destino (lead ou aluno do escopo) e canal, depois `abrirAtendimentoInstitucional` | **DIVERGE** | back-end + UI | Não aceita número livre nem cria contato. A regra do "modelo aprovado" vem da Meta e não vale no motor. |
| L14 | "Novo contato" (dentro de Nova conversa) | Cria a conversa só se o campo tiver número válido; senão mostra toast (L64-67, L1052) | todos | Não existe no Inbox | **FALTA** | back-end + UI | A criação de contato mora em Contatos. |
| L15 | Busca "Buscar conversas, contatos, tags" | Filtra ao digitar por nome, tags e etapa (L110, L991) | todos | Busca enviada com Enter (`PainelFiltros.tsx:54-56`): nome, perfil, responsável, aluno, lead e dígitos do telefone (`server/whatsapp/busca-inbox.ts:19-38`) | **PARCIAL** | back-end + UI | Não busca tags nem etapa e não filtra ao digitar. |
| L16 | Atalho ⌘K | Só o rótulo; o protótipo não tem handler (L111) | todos | Não existe | **FALTA** | UI | Nem o protótipo implementa. |
| L17 | Interruptor "Aria ativa" | Liga e desliga `aiOn`, só no estado local; o texto vira "Pausada · novas conversas vão para a equipe" (L114-121, L1033-1034). Sem confirmação nem motivo | todos (até vendedor, ver shot) | Pausa global existe: `pausarAria({motivo})` e `reativarAria` (`server/aria/estado.ts:72-119`), na tela `/aria` (`app/(app)/aria/_componentes/Cabecalho.tsx:59-87`), capacidade `pausar` só para Admin e Gerente Comercial (`server/aria/permissoes-tela.ts:22-30`) | **FALTA** | UI | O back-end exige motivo (`estado.ts:76-77`). Conflito de papel: ver pergunta 5. |
| L18 | Faixa "N em atendimento · M aguardando você" | Contagem por estado da IA (L118, L1026, L1033) | todos | Não existe | **FALTA** | back-end + Aria | Falta definir "em atendimento pela IA" (ligada e sem pausa no atendimento). |
| L19 | Chip "Todas" | (L984-985) | todos | Chip "Todas" (`PainelFiltros.tsx:45`) | **EXISTE** | — | Sem contador (ver L26). |
| L20 | Chip "IA atendendo" | `state==='ia'` (L984, L991) | todos | Não existe | **FALTA** | back-end + Aria | O dado existe (`AtendimentoWhatsApp.iaPausadaEm`, estado da Aria), mas não há filtro. |
| L21 | Chip "Aprovação" | `state==='aprovacao'` | todos | Não existe | **FALTA** | back-end + Aria | Daria para derivar de `AcaoAgenteIA` com status `SUGERIDA`. |
| L22 | Chip "Handoff" | `state==='handoff'` | todos | Não existe | **FALTA** | back-end + Aria | Daria para derivar de `iaPausaMotivo = HANDOFF`. |
| L23 | Chip "Humanos" | `state==='humano'` | todos | O mais próximo é "Minhas" (`PainelFiltros.tsx:46`) | **DIVERGE** | UI + back-end | "Humanos" mostra todas com pessoa; "Minhas" só as do usuário. |
| L24 | Chip "Sem resposta" | Espera ≥ 15 min (L983) | todos | "Prazo estourado" (`PainelFiltros.tsx:49`) | **PARCIAL** | regra | Mesma função, com a regra do prazo por setor. |
| L25 | Chip "Não atribuídas" | Fila (L983) | todos | Chip "Fila" (`PainelFiltros.tsx:47`; `consultas-pagina.ts:61`) | **EXISTE** | — | Muda só o rótulo. |
| L26 | Contadores nos chips | (L125, L983) | todos | Não existem | **FALTA** | back-end + UI | |
| L27 | Clique no item | Seleciona, limpa o rascunho e a nota, vai para a vista conversa e **zera não lidas** (L137, L996) | todos | `abrir` seleciona e grava `?c=` (`InboxNovo.tsx:169-177`) | **PARCIAL** | UI | Ver L28. |
| L28 | Zerar não lidas ao abrir | (L996) | todos | **Ninguém chama** `marcarLida` (`server/whatsapp/preferencias.ts:54`) nem `marcarConversaLida` (`server/whatsapp/acoes.ts:330`). Busca no `src` sem resultado fora dos próprios arquivos | **FALTA** | UI | Bug: o contador não baixa ao ler e a confirmação de leitura no WhatsApp (doc 03) não é enviada. |
| L29 | Selo de não lidas no item | (L149) | todos | `ListaAtendimentos.tsx:42` | **EXISTE** | — | |
| L30 | Hora em verde quando há não lida | (L145, L992) | todos | Hora sem destaque (`ListaAtendimentos.tsx:42`) | **PARCIAL** | UI | Cosmético. |
| L31 | Prévia com autor ("Aria: …", "Você: …", "Aria sugere: …") | (L148, L987) | todos | Prévia sem autor: `preview` (`server/whatsapp/consultas-inbox.ts:74`) | **PARCIAL** | back-end + UI | Faltam a origem da última mensagem e a sugestão pendente. |
| L32 | Chip de estado (IA atendendo / Aguardando aprovação / Handoff pendente / Com você / Com X) | (L152, L994) | todos | Status do atendimento (Na fila / Em atendimento / Aguardando cliente) e nome do responsável (`ListaAtendimentos.tsx:64-65`) | **DIVERGE** | back-end + Aria | O item da lista não traz o estado da Aria. |
| L33 | Selo IA (sparkles) no avatar | `isAI = state!=='humano'` (L139, L993) | todos | Não existe | **FALTA** | back-end + Aria | |
| L34 | Chip da etapa do funil | (L153) | todos | No lugar, mostra setor e número (`ListaAtendimentos.tsx:62-63`) | **FALTA** | back-end + UI | |
| L35 | Chip "Sem resposta · X min" (amarelo ≥ 15, vermelho ≥ 30) | (L153, L994) | todos | "Prazo estourado" sem minutos (`ListaAtendimentos.tsx:66`), com `agora` fixo na montagem (`ListaAtendimentos.tsx:31`) | **PARCIAL** | UI | Bug: quem estoura depois de montar a lista não ganha o selo até recarregar a página. |
| L36 | Chip "Sem nome" | (L153, `noName`) | todos | Não existe | **FALTA** | UI + back-end | `fonteNome`/`nomeSalvo` existem em `AcoesContatoInbox`, mas não no item da lista. |
| L37 | Chip "Na fila" | (L153, `QUEUE`) | todos | Status "Na fila" (`lib/labels.ts:515`; `ListaAtendimentos.tsx:64`) | **EXISTE** | — | |
| L38 | Ícones de pino e de silenciado no item | (L144) | todos | O item tem `fixada` e `silenciada` (`server/inbox/consultas-pagina.ts:20`), mas a lista não mostra | **FALTA** | UI | |
| L39 | Avatar quadrado para B2B | (L138, L992) | todos | Avatar sempre redondo | **FALTA** | back-end + UI | Cosmético. |
| L40 | Estado vazio "Nenhuma conversa neste filtro." | (L158) | todos | `ListaAtendimentos.tsx:51` | **EXISTE** | — | |

## 2. Cabeçalho da conversa e menu ⋮

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| C1 | Voltar (celular) | `mBackList` (L164) | todos | `ConversaAberta.tsx:112` | **EXISTE** | — | |
| C2 | Nome, selo de status da conversa (Aberta, Pendente, Resolvida ou Arquivada) e linha de estado ("Aria está atendendo", "Aria aguarda sua aprovação", "Aria pediu um humano", "Você está atendendo") | (L165-171, L998) | todos | Nome, setor, número, status do atendimento, responsável e "Transferido de …" (`ConversaAberta.tsx:113-123`) | **DIVERGE** | Aria + regra | Falta o estado da Aria. Os status são outros (ver C11). |
| C3 | Buscar na conversa (lupa) | Botão **sem handler** (L173); no menu, mostra só um toast (L1185) | todos | Não existe | **FALTA** | back-end + UI | O doc 03 lista "busca" como função do app original. |
| C4 | Transferir para pessoa | Passo 1 "Pessoas": presença (online, ausente, offline), carga "N conversas", exclui o dono atual (L191-198, L1173); passo 2 e `doTransfer` (L960-968) | todos | "Atribuir" só para gerente do setor (`AcoesAtendimento.tsx:97, 200-264`; `server/inbox/permissoes.ts:60-61`) | **DIVERGE** | regra + back-end | O atendente não passa para um colega. Não há presença nem carga. Pendência 8 da Fase 3. |
| C5 | Transferir para "Equipes e filas" (Fila Vendas B2C por rodízio, Fila Corporativo, Pedagógico) | (L199-206, `TEAMS` L834) | todos | "Transferir" entre **setores** (`AcoesAtendimento.tsx:98, 146-198`; `transferirAtendimento` em `server/whatsapp/acoes-atendimento.ts:216`: encerra e abre outro) e "Devolver para a fila" do mesmo setor (`AcoesAtendimento.tsx:96`) | **DIVERGE** | modelo | Não há subfilas dentro de um setor (Corporativo × B2C). |
| C6 | "Devolver para Aria" no menu Transferir | Só quando `humano`; transfere na hora (L207-213, L1175) | todos | Botão no painel, só com a Aria pausada e escopo de envio (`PainelAria.tsx:33-35`; `devolverParaAria` em `server/aria/pausa.ts:80`) | **PARCIAL** | UI | Muda o lugar. Ver também C9. |
| C7 | "Contexto para quem recebe" | Textarea **opcional**, vira nota (L224-226, L965) | todos | "Contexto da transferência" **obrigatório**, com no mínimo 12 caracteres (`AcoesAtendimento.tsx:188-190, 194`) | **DIVERGE** | regra | |
| C8 | "Anexar resumo da Aria como nota" e "Continuar seguindo a conversa" | Checkboxes; o resumo só entra se a conversa estava com a IA (L227-228, L964-966) | todos | Não existem | **FALTA** | back-end + Aria | "Seguir conversa" foi excluído de propósito (Fase 3, pendência 12). O "Convidar participante" do ERP é o mais próximo. |
| C9 | "Assumir conversa" (mão) | Abre o modal "Resumo de handoff" e depois `takeOver`: estado vira humano, dono vira "Você", **rejeita sugestões pendentes** e registra o evento "Você assumiu" (L175-177, L911). Aparece sempre que o estado não é humano | todos | "Assumir" só da fila (`AcoesAtendimento.tsx:95`; `permissoes.ts:51-57`). `assumirAtendimento` não pausa a Aria nem decide sugestões (`acoes-atendimento.ts:89-115`) | **DIVERGE** | back-end + Aria | O motivo `MANUAL` existe no enum, mas ninguém o usa. A Aria só pausa quando sai mensagem humana (`pausa.ts:62-69`). |
| C10 | "Devolver para Aria" no cabeçalho | `giveBack` (L178-180, L912) | todos | No painel (`PainelAria.tsx:33-35`) | **PARCIAL** | UI | |
| C11 | Alternar painel (`panel-right`) | `togglePanel`: abaixo de 700 px vira a vista painel; nas outras larguras mostra ou esconde (L181, L1113) | todos | Botão só abaixo de 1100 px, abre Drawer (`ConversaAberta.tsx:126`; `InboxNovo.tsx:247-249`). A partir de 1100 px o painel é fixo | **PARCIAL** | UI | Não dá para esconder no desktop. |
| C12 | Menu ⋮ › Status da conversa (Aberta, Pendente, Resolvida, Arquivada) | Segmentado; grava evento "Status alterado" e toast (L239-244, L865, L1178) | todos | Status automáticos (`server/whatsapp/status-atendimento.ts:11-21`); a ação manual é só "Encerrar atendimento", com `ConfirmarAcao` (`AcoesAtendimento.tsx:103, 117-129`; papéis em `permissoes.ts:29-34, 62-63`) | **DIVERGE** | regra | Conflito com o doc 03 ("Arquivar → encerrar"). Pergunta 1. |
| C13 | ⋮ › Marcar como não lida | Toast "Marcada como não lida **para a equipe**" (L1180) | todos | `marcarNaoLida` pessoal existe (`preferencias.ts:45`), mas não está na tela | **FALTA** | UI | Conflito pessoal × equipe: pergunta 2. |
| C14 | ⋮ › Fixar / Desafixar | (L1181) | todos | Botão no cabeçalho, "só para você" (`AcoesAtendimento.tsx:105, 108`; `alternarFixada` em `preferencias.ts:19`) | **EXISTE** | — | Fica no cabeçalho, não no menu. |
| C15 | ⋮ › Silenciar (8 h) / Reativar notificações | (L1182) | todos | `AcoesAtendimento.tsx:48, 106` | **EXISTE** | — | Também por usuário. |
| C16 | ⋮ › Criar tarefa | `openTask('new')` (L1183) | todos | Não existe no Inbox; `criarTarefa` existe (`server/crm/tarefas-acoes.ts:20`) | **FALTA** | UI | Ver o modal em R8. |
| C17 | ⋮ › Agendar mensagem | `openSp()` (L1184) | todos | "Agendar mensagem" no cabeçalho (`AcoesAtendimento.tsx:101`) | **EXISTE** | — | O conteúdo do diálogo está na seção 5. |
| C18 | ⋮ › Buscar na conversa (⌘F) | Só toast (L1185) | todos | (ver C3) | — | — | Repete C3. |
| C19 | ⋮ › Mesclar contato duplicado ("1 possível") | Só toast (L1186) | todos | `mesclarPessoas` (`server/crm/duplicados.ts:214`), usado em `/contatos` (`app/(app)/contatos/MesclarContatos.tsx`) | **FALTA** | UI | Excluído de propósito na Fase 3 (pendência 12). Pergunta 11. |
| C20 | ⋮ › Exportar conversa (PDF) | Só toast (L1187) | todos | Não existe | **FALTA** | back-end | Excluído de propósito (pendência 12). |
| C21 | ⋮ › Arquivar contato | Status vira "Arquivada" e grava evento (L1188) | todos | Substituído por "Encerrar atendimento" (doc 03; `AcoesAtendimento.tsx:103`) | **DIVERGE** | regra | Pergunta 1. |
| C22 | ⋮ › Bloquear contato (vermelho) | Evento e toast, **sem confirmação e sem motivo** (L1189) | todos | Botão sempre desabilitado, com `AVISO_RECURSO_MOTOR`, para gerente ou admin (`AcoesAtendimento.tsx:104`; `permissoes.ts:66-67`). `bloquearContatoWhatsApp({motivo})` existe (`server/whatsapp/motor/acoes-mensagem.ts:510`) | **PARCIAL** | UI | O botão continua desabilitado mesmo com o motor conectado. Pergunta 3. |
| C23 | Faixa de handoff ("Aria pediu ajuda há 4 min" + motivo + "Ver resumo e assumir") | (L253-262) | todos | Só o texto "Aria pausada · Handoff" no painel (`PainelAria.tsx:30-32`) | **PARCIAL** | UI + back-end | O motivo e o resumo do handoff são gravados como `NotaInterna` (`server/aria/turno/handoff.ts:110, 137`), mas não aparecem. |
| C24 | Modal "Resumo de handoff" (O que o contato quer · O que a Aria já fez · Próxima ação sugerida · Cancelar / Assumir e responder) | (L435-468, L1112) | todos | Não existe | **FALTA** | UI + Aria | Os dados existem em parte: a nota do handoff e o histórico de `AcaoAgenteIA`. |
| C25 | Toast de retorno | (L185, L959) | todos | `FeedbackAcao` em cada ação (`AcoesAtendimento.tsx:109`) | **EXISTE** | — | |

## 3. Conversa (thread)

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| T1 | Separador de dia ("Hoje", "Ontem") | (L266) | todos | Não encontrado em `BalaoMensagem`/`VirtualList` | **FALTA** | UI | |
| T2 | Eventos na conversa ("Aria preencheu…", "Você assumiu", "transferiu", "moveu para…", "desfez…") | (L267-272, L887) | todos | A thread só traz `MensagemWhatsApp`. Os eventos ficam em `Evento` e não são exibidos | **FALTA** | back-end + UI | |
| T3 | Balões entrada, IA, eu e nota, com autor ("Aria · IA", "Você", "Nota interna · só equipe") e ✓✓ | (L273-282, L1009-1013) | todos | `BalaoMensagem` com autor (`components/conversa/BalaoMensagem.tsx:17-22`; "Aria" em `lib/labels.ts:158`) e status de entrega (`BalaoMensagem.tsx:24-30`) | **EXISTE** | — | O ERP mostra mais estados de entrega. |
| T4 | Nota interna na conversa (balão tracejado) | (L273-279, L1011) | todos | **Não exibida.** A nota vira `Evento` (`server/whatsapp/acoes-conversa.ts:24-46`). `notasDoAtendimento` (`acoes-conversa.ts:48`) não é usada e a rota devolve `notas` do lead (`server/inbox/consultas-pagina.ts:183`), que o cliente ignora | **FALTA** | UI | Bug funcional: quem anota não vê a própria nota. |
| T5 | Anexo no balão | (L277) | todos | `MidiaMensagem` e visualizador (`BalaoMensagem.tsx:78, 106`) | **EXISTE** | — | |
| T6 | Cartão de tarefa na conversa (cabeçalho, título, prazo e responsável, ✏️ Editar, ✓ Concluir, estado "Concluída/Excluída") | (L283-297, L1005-1007) | todos | Não existe | **FALTA** | UI | Back-end: `editarTarefa` e `concluirTarefa` (`server/crm/tarefas-acoes.ts:23-28`). |
| T7 | Cartão de mensagem agendada na conversa ("Agendada para…", "por você/por Aria", anexo, recorrência) | (L328-348, L1087-1091) | todos | As agendadas só aparecem no diálogo "Convites e agendamentos" (`AcoesAtendimento.tsx:102, 378-389`) | **FALTA** | UI | |
| T8 | Agendada › Editar | `openSp({editId})` (L342, L943) | todos | Não existe no Inbox. `reagendarMensagem` só troca a data (`server/crm/mensagens-agendadas.ts:320`) | **PARCIAL** | UI + back-end | Não edita o texto. |
| T9 | Agendada › Enviar agora | `schedOp('now')` (L343, L956) | todos | Não existe | **FALTA** | back-end | |
| T10 | Agendada › Cancelar | Sem confirmação (L344, L957) | todos | `Cancelar agendamento` com `ConfirmarAcao` (`AcoesAtendimento.tsx:385, 345-357`; `cancelarAgendamentoDoAtendimento` em `acoes-conversa.ts:102`) | **EXISTE** | — | O ERP pede confirmação. |
| T11 | Pergunta "X respondeu depois que você agendou. Ainda quer enviar?" (Cancelar envio / Manter agendada) | (L335-340, L954, L1090) | todos | Não encontrado no despachante nem no inbound | **FALTA** | back-end | |
| T12 | Envio automático da agendada no horário | `setInterval` de 10 s (L881) | — | Despachante com `agendadaPara` (`server/whatsapp/despachante.ts:190-192`) | **EXISTE** | — | |
| T13 | "Mensagens anteriores" (paginação) | Não há | — | `ConversaAberta.tsx:146` | N/A | — | Só no ERP. |

## 4. Cartão de sugestão da Aria

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| A1 | Cartão inline na conversa: cabeçalho "Aria sugere · aguardando aprovação", título, justificativa, texto proposto e lista de ações (enviar, mover etapa, criar tarefa, agendar) | (L298-326, L1014-1019) | todos | Bloco "Aria" no **painel lateral**: rótulo da ação, resumo de até 200 caracteres (`server/whatsapp/consultas-inbox.ts:266-271`) e "Expira às" (`PainelAria.tsx:40-44`) | **DIVERGE** | UI + modelo | O protótipo agrupa várias ações numa aprovação. No ERP cada `AcaoAgenteIA` é uma sugestão. Pergunta 16. |
| A2 | "Aprovar e enviar" / "Aprovar" / "Agendar" | `approve`: envia, muda a etapa, cria a tarefa ou agenda, registra log e volta a "IA atendendo" (L318, L893-901) | todos | "Aprovar" (`PainelAria.tsx:46`; `aprovarAcaoAria` em `server/aria/historico.ts:44-57`). Só para quem tem `decidirHistorico`, ou seja Admin e Gerente Comercial (`consultas-inbox.ts:280`; `permissoes-tela.ts:22-30`) | **PARCIAL** | UI + regra | O vendedor não vê as sugestões no ERP. Pergunta 4. |
| A3 | "Editar" (texto inline e "Aprovar e enviar editado"; no agendamento abre o agendador; na tarefa abre o modal) | (L319, L1021-1022) | todos | Não existe. `aprovarAcaoAria(id)` não recebe texto editado (`historico.ts:44`) | **FALTA** | back-end + UI | Pergunta 17 (autoria do texto editado). |
| A4 | "Rejeitar" / "Ignorar" | `reject` (L320, L902) | todos | "Rejeitar" (`PainelAria.tsx:47`). `rejeitarAcaoAria(id, motivo?)` aceita motivo (`historico.ts:59`), mas a UI não pede | **EXISTE** | — | |
| A5 | "Editar tarefa" (na linha da ação) e o modal "Revisar tarefa sugerida" com "Aprovar com edições" | (L312, L919, L924) | todos | Não existe | **FALTA** | back-end + UI | |
| A6 | Aviso "Isso será enviado agora no WhatsApp e não poderá ser desfeito." | (L315) | todos | O aprovar não tem aviso nem confirmação (`PainelAria.tsx:46`) | **FALTA** | UI | |
| A7 | Estado decidido fica no cartão ("Aprovado por você · hh:mm" / "Rejeitado") | (L323, L1017) | todos | A sugestão some do painel (só `SUGERIDA` é listada); o registro fica em `/aria` › Histórico | **PARCIAL** | UI | |

## 5. Rodapé e compositor

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| F1 | Barra travada "Aria está respondendo…" com "Nota interna" e "Assumir para responder" | O compositor fica fechado enquanto o estado não é humano (L408-415, L997-999) | todos | O compositor abre para quem tem escopo de envio (`ConversaAberta.tsx:163-175`; `podeEnviar` em `server/inbox/paineis.ts:39`). Enviar pausa a Aria sozinho (`server/aria/pausa.ts:62-69`, chamado em `despachante.ts:546`) | **DIVERGE** | regra | Pergunta 6. |
| F2 | Abas "Responder" e "🔒 Nota interna" | Troca o modo; "Responder" só com estado humano (L418-420, L1105) | todos | `Compositor` tem `modo="nota"` (`components/conversa/Compositor.tsx:22, 72, 210`), mas `ConversaAberta` sempre passa `"responder"` (`ConversaAberta.tsx:165`). A nota sai pelo diálogo do cabeçalho (`AcoesAtendimento.tsx:100, 266-288`) | **PARCIAL** | UI | Basta ligar a aba. |
| F3 | Respostas rápidas "/" | Só o texto de ajuda no compositor (L422); chips no agendador (L373) | todos | Atalho "/" com lista e variáveis (`Compositor.tsx:207, 228-239`; `components/conversa/respostas-rapidas.ts:5`; carga em `ConversaAberta.tsx:101`) | **EXISTE** | — | O ERP faz mais que o protótipo. A Fase 3 excluía; a Fase 5 trouxe (DF5-12). |
| F4 | "@ mencionar" em nota | Texto de ajuda e exemplo "@Rodrigo" (L422, L804, L1108) | todos | Não existe | **FALTA** | back-end + UI | Precisa notificar o mencionado. Pergunta 19. |
| F5 | Anexar (clipe) › Documento | `attach('doc')` envia na hora (L425, L970-972) | todos | `Compositor.tsx:248` (envia na hora, com legenda) | **EXISTE** | — | |
| F6 | Anexar › Fotos e vídeos | (L1161) | todos | `Compositor.tsx:249` | **EXISTE** | — | |
| F7 | Anexar › Câmera | (L1161) | todos | Não existe | **FALTA** | UI | Basta `capture` no input. |
| F8 | Anexar › Áudio | (L1161) | todos | Arquivo de áudio (`Compositor.tsx:250`) e gravação de voz (`Compositor.tsx:170-199, 284-286`) | **EXISTE** | — | |
| F9 | Anexar › Localização | (L1161) | todos | Item aparece, mas o botão **não tem `onClick`** (`Compositor.tsx:251-259`). `enviarConteudoInbox` existe (`server/whatsapp/motor/acoes-mensagem.ts:405`) | **PARCIAL** | UI (+motor) | Mesmo com o motor conectado, nada acontece. |
| F10 | Anexar › Contato | (L1161) | todos | Mesmo caso (`Compositor.tsx:54-58, 255`) | **PARCIAL** | UI (+motor) | |
| F11 | Anexar › Proposta (gerada da oportunidade) | (L1161, L970) | todos | Não existe no Inbox | **FALTA** | back-end | Não encontrei geração de PDF de proposta ligada à conversa. |
| F12 | Anexar › Catálogo | (L1161) | todos | Não existe para humanos. Fontes `enviavelAoLead` só servem à Aria (`server/aria/tela.ts:16`) | **FALTA** | back-end + UI | |
| F13 | Anexar › Template | Insere um texto modelo no rascunho (L971) | todos | Coberto pelas respostas rápidas (F3); `TemplateWhatsApp MODELO_AUTOMACAO` não é inserível | **PARCIAL** | UI | |
| F14 | Agendar (relógio) › texto | Exige estado humano, senão mostra toast "Assuma a conversa…" (L426, L940) | todos | `DialogoAgendar` (`AcoesAtendimento.tsx:291-321`). Qualquer um com acesso pode agendar (`permissoes.ts:47`) | **DIVERGE** | regra | Pergunta 14. |
| F15 | Agendar › "Escrever com Aria" | Preenche com o "próximo passo" dos Insights (L367, L1095) | todos | Não existe | **FALTA** | Aria | |
| F16 | Agendar › chips de respostas rápidas | (L373, L1079) | todos | Não existe no diálogo | **FALTA** | UI | O back-end já existe (F3). |
| F17 | Agendar › Anexar (Proposta, Catálogo, Foto) | (L374-378, L1081) | todos | `agendarMensagemNoAtendimento` só aceita texto (`acoes-conversa.ts:72`) | **FALTA** | back-end | |
| F18 | Agendar › atalhos "Em 1 hora / Hoje 18:00 / Amanhã 09:00 / Amanhã 14:00 / Segunda 09:00" | (L382, L861, L1082) | todos | Só o campo de data e hora | **FALTA** | UI | |
| F19 | Agendar › data e hora com fuso | "Horário de Brasília (GMT-3)" fixo (L383-387) | todos | `CampoDataHoraLocal` com o fuso de exibição do usuário (`AcoesAtendimento.tsx:313-315`) | **EXISTE** | — | O ERP é mais correto. |
| F20 | Agendar › erro de horário passado | (L388, L947) | todos | `validarQuando` (`AcoesAtendimento.tsx:56-62`) | **EXISTE** | — | |
| F21 | Agendar › aviso de conflito (outra agendada a menos de 2 h) | (L389, L1076, L1084) | todos | Não existe | **FALTA** | UI | |
| F22 | Agendar › "Perguntar antes de enviar se o contato responder" | (L391) | todos | Não existe (ver T11) | **FALTA** | back-end | |
| F23 | Agendar › Repetir | (L395) | todos | Não existe | **FALTA** | back-end | Excluído de propósito (pendência 12 da Fase 3). |
| F24 | Agendar › "Vincular a" (Nenhum, Oportunidade, Tarefa aberta) | (L396) | todos | O agendamento pelo CRM liga a tarefa ou oportunidade (`server/crm/mensagens-agendadas.ts`; quadro, linha 3718); o do Inbox não liga | **PARCIAL** | UI | |
| F25 | Agendar › "Salvar rascunho" | Leva o texto para o compositor (L401, L946) | todos | Não existe no diálogo. O compositor guarda rascunho por conversa (`Compositor.tsx:38-44`) | **FALTA** | UI | |
| F26 | Nova tarefa (`list-todo`) no rodapé | `openTask('new')` (L427) | todos | (ver C16) | — | — | Repete C16. |
| F27 | Campo de texto: Enter envia, Shift+Enter quebra linha, altura automática | (L428, L883, L1104) | todos | `Compositor.tsx:159-161, 267-278` | **EXISTE** | — | O ERP ainda cola arquivo e guarda rascunho. |
| F28 | Enviar (avião) | `send`: cria mensagem ou nota (L429, L913-914) | todos | `Compositor.tsx:288-290` | **EXISTE** | — | Com o campo vazio, o ERP troca o botão pelo microfone. |

## 6. Ações por mensagem

O protótipo **não tem** menu nem ação em mensagens: nada de responder, encaminhar, editar, apagar, reagir ou copiar, nenhum handler em L273-282. Esses itens estão no doc 03 e o ERP já os tem. Ficam fora dos números do inventário.

| # | Ação | Protótipo | ERP hoje (arquivo:linha) | Status | Observação |
|---|---|---|---|---|---|
| M1 | Menu "Opções da mensagem" | Não há | `BalaoMensagem.tsx:62-70, 88` | N/A | |
| M2 | Copiar | Não há | `ConversaAberta.tsx:156` | N/A | |
| M3 | Reagir | Não há | `AcoesMensagem.tsx:30, 204` (`reagirMensagemWhatsApp`), com motor | N/A | |
| M4 | Encaminhar | Não há | `AcoesMensagem.tsx:148` (`encaminharMensagemWhatsApp`, mesmo número e escopo de envio) | N/A | |
| M5 | Editar (só a própria, texto, 15 min) | Não há | `AcoesMensagem.tsx:182`; regra em `ConversaAberta.tsx:63-74` | N/A | |
| M6 | Apagar para todos (com `ConfirmarAcao`) | Não há | `AcoesMensagem.tsx:47` | N/A | |
| M7 | Responder citando | Não há | Item existe no balão (`BalaoMensagem.tsx:63`), mas está **fora** de `COMANDOS_MENSAGEM_LIGADOS` (`ConversaAberta.tsx:54`) | N/A (desligado) | Recurso do motor `responderCitando` (`components/conversa/recursos-canal.ts:7`). |
| M8 | Favoritar | Não há | Item no balão (`BalaoMensagem.tsx:67`) e `alternarFavorita` (`preferencias.ts:64`), mas desligado (`ConversaAberta.tsx:54`) | N/A (desligado) | É função do doc 03 e não está ligada. |

## 7. Painel lateral

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje (arquivo:linha) | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| P1 | Voltar (celular) | `mBackChat` (L474) | todos | Fechar do Drawer (`InboxNovo.tsx:249`) | **EXISTE** | — | |
| P2 | Cabeçalho: avatar grande, nome e subtítulo ("Pessoa física · …" ou "Falando com X · papel") | (L476-480, L1138) | todos | Nome, telefone e "número · setor" em texto (`InboxNovo.tsx:191-196`) | **PARCIAL** | UI | |
| P3 | Lápis "Editar contato" (vira ✓ Salvar; os campos viram inputs) | `toggleEdit` (L475, L1141). O salvar é só local (`pfEd`) | todos | "Editar nome" (só o nome salvo) (`AcoesContato.tsx:80, 95-133`) | **PARCIAL** | UI | Back-end para os outros campos: `definirCampoDaFicha` (`server/crm/contatos-acoes.ts:31`), `editarLead` (`server/comercial/acoes.ts:321`). |
| P4 | Contato sem nome: campo "Nome do contato" e Salvar no topo | (L479, L1119) | todos | Precisa abrir "Editar nome" (`AcoesContato.tsx:80`) | **PARCIAL** | UI | Sem o aviso proativo. |
| P5 | Chips de tags (com selo IA) | (L483-485) | todos | Não existe no Inbox | **FALTA** | UI | Back-end: `PessoaTag`, `tagsAtivas` (`server/crm/ficha-dados.ts:40`). |
| P6 | "+ tag" | Só o visual, **sem handler** (L486) | todos | Não existe | **FALTA** | UI | `atribuirTagDaFicha` e `removerTagDaFicha` (`server/crm/contatos-acoes.ts:23-27`). |
| P7 | Cartão "X já é cliente e voltou a escrever. Novo interesse?" com "Criar nova oportunidade" e "Vincular a <anterior>" | (L489, L875, L1124-1125) | todos | "Criar oportunidade" (`AcoesContato.tsx:79`) **reaproveita** a existente (`criarLeadDaConversa`, `server/whatsapp/acoes.ts:389`; mensagem em `AcoesContato.tsx:62`) e "Vincular" com busca (`AcoesContato.tsx:81, 138-196`) | **DIVERGE** | back-end + UI | O ERP não pergunta e vincula à oportunidade que já existe. Pergunta 13. |
| P8 | Abas Detalhes, Oportunidades, Insights e Atividade (com contador) | (L490-494, L1114) | todos | Painel único em rolagem (`InboxNovo.tsx:190-211`) | **FALTA** | UI | |
| P9 | Cartão "Oportunidade atual" (título · valor/mês · etapa) que abre a aba | (L497) | todos | `PainelSetor` COMERCIAL: link para `/funil`, etapa e valor (`PainelSetor.tsx:18-21`); "Abrir oportunidade" (`AcoesContato.tsx:74`) | **PARCIAL** | UI | Leva para fora, não abre uma aba. |
| P10 | B2B: empresa, "Ver empresa" e "Contatos nesta oportunidade" com "Falar com" | `onSwitch` só mostra toast (L498-502, L1121) | todos | Não existe | **FALTA** | back-end + UI | `ParticipanteOportunidade` existe no schema. "Falar com" exigiria abrir uma conversa com outra pessoa. |
| P11 | "Modo de edição" B2C/B2B | (L504-511, L1136) | todos | Não existe | **FALTA** | UI + back-end | |
| P12 | Campos WhatsApp, E-mail, Cidade/Segmento e Origem | Visualizar e editar (L512-522, L1139) | todos | Só o telefone (`InboxNovo.tsx:194`) | **FALTA** | UI | `Pessoa.email`, `cidade` e `origemCanal` existem no schema. |
| P13 | Perfil/Empresa (CPF, Idade, Preferências / Empresa, Cargo, CNPJ, Segmento, Tamanho, Site, Decisor) e campos personalizados com selo IA | (L525-538, L1129-1131) | todos | Não existe | **FALTA** | UI | `camposDaPessoa` (`server/crm/ficha-dados.ts:21`). |
| P14 | Aba Oportunidades: título, "Funil Matrículas", valor e nota | (L543-544) | todos | Etapa e valor no `PainelSetor` (`PainelSetor.tsx:18-21`) | **PARCIAL** | UI | |
| P15 | Barra de etapas clicável e select de etapa | `setStage` registra "Você moveu para…" (L545-552, L888-891, L1149-1150) | todos | Não existe no Inbox | **FALTA** | UI | `moverEtapa` (`server/comercial/acoes.ts:446`). |
| P16 | Cartão "Aula experimental" (quando, professor, status, resultado) com "Editar" | Link para o Funil (L553) | todos | Não existe no Inbox | **FALTA** | UI | `agendarExperimental` e `checkinExperimental` (`comercial/acoes.ts:489, 677`). |
| P17 | Responsável, Temperatura · score, Probabilidade · previsão e Produto | (L555-557, L1140) | todos | Não existe | **FALTA** | UI (+back-end) | `temperatura` existe na oportunidade; não conferi probabilidade e score. |
| P18 | Lista de tarefas com checkbox Concluir/Reabrir | `taskOp('toggle')` (L561-567, L930) | todos | Não existe | **FALTA** | UI | `concluirTarefa` e `reabrirTarefa` (`tarefas-acoes.ts:26-31`). |
| P19 | Tarefa › Reagendar para amanhã 09:00 | (L569, L931) | todos | Não existe | **FALTA** | UI | `reagendarTarefa` (`tarefas-acoes.ts:32`). |
| P20 | Tarefa › Editar | Abre o modal (L570, L918) | todos | Não existe | **FALTA** | UI | `editarTarefa` (`tarefas-acoes.ts:23`). |
| P21 | Tarefa › Excluir (lixeira) | Exclui sem motivo (L572, L932) | todos | Não existe. O ERP **cancela com motivo** (`cancelarTarefa`, `tarefas-acoes.ts:35`) | **DIVERGE** | regra | Pergunta 12. |
| P22 | "+ Nova tarefa" | (L560) | todos | (ver C16) | — | — | |
| P23 | "Outras oportunidades deste contato" e "Ver no contato" | (L577-580) | todos | Não existe | **FALTA** | UI | |
| P24 | "+ Nova oportunidade" | Abre `Funil?novo=` (L581, L1123) | todos | "Criar oportunidade" só quando não há oportunidade (`AcoesContato.tsx:79`) | **PARCIAL** | UI | |
| P25 | Ações rápidas: "Criar tarefa", "Adicionar nota", "Assumir conversa" | (L586-588) | todos | (ver C16, F2 e C9) | — | — | Repetem outros itens. |
| P26 | "Marcar como perdido" | Botão **sem handler** (L589) | todos | Não existe no Inbox | **FALTA** | UI | `marcarPerdido` (`server/comercial/acoes.ts:572`). |
| P27 | Aba Atividade › "Mensagens agendadas" (Editar, Enviar agora, Cancelar) | (L593-610) | todos | (ver T7-T10) | — | — | Repete os itens da thread. |
| P28 | Aba Atividade › "Atividade recente" (última interação, nº de conversas, tarefas abertas) e as duas últimas notas | (L611-621, L1133, L1143) | todos | Não existe | **FALTA** | UI + back-end | `notasDoAtendimento` (`acoes-conversa.ts:48`) existe e não é usada. |
| P29 | "Aria neste contato": última ação, barra de **confiança** e regras "Automático em <etapa>" e "Com aprovação" | (L623-631, L745-751, L1145) | todos | Não existe no Inbox | **FALTA** | Aria | A matriz existe na configuração (`server/aria/matriz.ts`); não conferi a confiança por contato. |
| P30 | "Alterações da IA" com **Desfazer** e o cadeado "por que não dá para desfazer" | `undo` (L633-649, L903-910, L1154) | todos | Não existe no Inbox. `desfazerAcaoAria` (`server/aria/historico.ts:163`) só na tela `/aria` (`app/(app)/aria/_componentes/Historico.tsx:57-58`), para quem tem `decidirHistorico` | **FALTA** | UI | O back-end já trata `reversivel` e `motivoIrreversivel`. Pergunta 4. |
| P31 | Aba **Insights**: temperatura, chance, sentimento, melhor horário, intenção, sinais, objeções, "próximo melhor passo" e "Usar como rascunho" / "Assumir e usar como rascunho" | (L651-677, L823-832, L1165-1166) | todos | Não existe | **FALTA** | Aria + back-end | A Fase 3 jogou para a Fase 5 (pendência 12), mas o plano da Fase 5 não tem Insights. Pergunta 15. |
| P32 | Painel por setor (Financeiro, Secretaria, Pedagógico), opt-out, cobrança e vínculo | Não há | `PainelSetor.tsx:22-33`, `OptOutContato.tsx:47-52`, `AcoesContato.tsx:254-327` | N/A | Só no ERP (seção 10). |

## 8. Modal de tarefa (aberto por C16, P20 e A5)

| # | Controle | Protótipo (o que faz, linha) | Papéis | ERP hoje | Status | Gap | Observação |
|---|---|---|---|---|---|---|---|
| R1 | Título e chips de tipo (WhatsApp, Ligação, E-mail, Reunião, Outro) | (L693-697) | todos | Não existe no Inbox. `TarefaInput.titulo` e `tipo` existem (`server/crm/tarefas.ts:15-31`) | **FALTA** | UI | |
| R2 | Quando: chips, data e hora | (L698-705) | todos | `dataCivil` e `hora` existem no back-end | **FALTA** | UI | |
| R3 | Responsável e Lembrete | (L707-710) | todos | `responsavelId` e `lembreteAntecedenciaMin` (0/10/30/60) existem | **FALTA** | UI | O protótipo oferece "1 dia antes", que o ERP não tem. |
| R4 | Descrição e "Vincular à oportunidade" | (L712-714) | todos | `descricao` e `leadId` existem | **FALTA** | UI | |
| R5 | "Enviar mensagem nesta data" com texto | Cria uma agendada (L715-720, L926-927) | todos | Back-end separado (agendamento pelo CRM ligado à tarefa) | **FALTA** | UI | |
| R6 | Mais opções: Prioridade | (L724) | todos | `prioridade` existe | **FALTA** | UI | |
| R7 | Mais opções: Repetir e "Notificar também" | (L725-727) | todos | Não existe no `TarefaInput` | **FALTA** | back-end | |
| R8 | "Já foi feita" (só ao criar) e "Excluir" (só ao editar) | (L732-733) | todos | Concluir e cancelar existem (ver P18 e P21) | **FALTA** | UI | |

## 9. Atalhos de teclado e celular

| # | Controle | Protótipo | ERP hoje | Status | Gap | Observação |
|---|---|---|---|---|---|---|
| K1 | Enter envia, Shift+Enter quebra linha | L1104 | `Compositor.tsx:159-161` | **EXISTE** | — | |
| K2 | ⌘K (busca global) | Só o rótulo (L111) | Não existe | (ver L16) | — | Repete L16. |
| K3 | ⌘F (buscar na conversa) | Só a dica no menu (L1185) | Não existe | (ver C3) | — | Repete C3. |
| K4 | Esc fecha o menu da mensagem | Não há | `BalaoMensagem.tsx` (listener de `Escape`) | N/A | — | Só no ERP. |
| K5 | Vistas no celular (lista, conversa e painel) e folhas de baixo para cima | `mobile.js`: `data-mview`, `[data-m=sheet]` | `InboxNovo.tsx` (`vista`; Drawer e Modal `folha`) | **EXISTE** | — | |
| K6 | Barra de abas do celular, aviso de push ("Ativar avisos") e gesto de deslizar | `mobile.js` (`crm-tabbar`, `askPush`, `data-swipe`) | Push e gesto não conferidos (a navegação é do app shell) | **FALTA** | UI | O protótipo não liga o deslizar no Inbox: nenhum `data-swipe` no HTML. |

---

## Números

Os números contam os itens das seções 1 a 5 e 7 a 9 com status. Ficam de fora as linhas "(ver X)", que repetem outro item, e as linhas N/A, que só existem no ERP.

| Status | Itens |
|---|---|
| EXISTE | 27 |
| PARCIAL | 27 |
| DIVERGE | 17 |
| FALTA | 78 |
| **Total** | **149** |

Os 78 itens FALTA se dividem assim:

- **39 são só de UI**, com o back-end já pronto e citado na linha;
- **29 precisam de back-end ou modelo**, quase sempre junto com UI;
- **10 dependem da Aria** (dado, turno ou configuração).

Quatro desses 78 foram excluídos de propósito na Fase 3 (pendência 12): seguir a conversa (C8), mesclar (C19), exportar PDF (C20) e recorrência (F23).

Quase nada depende do motor ainda por fazer: o ERP já tem as funções do motor para localização, contato, bloquear e responder citando, e só falta ligá-las (são PARCIAL, ou N/A na seção 6).

Contagem feita com `grep` na coluna de status destas tabelas.

---

## 10. Funcionalidades que o ERP tem e o protótipo não mostra

| Função | ERP (arquivo:linha) | Decidir se fica |
|---|---|---|
| Devolver para a fila | `AcoesAtendimento.tsx:96` | Fica: é fluxo de setor. |
| Atribuir (gerente do setor) | `AcoesAtendimento.tsx:97, 200-264` | Fica. Talvez vire o "Transferir para pessoa" (pergunta 7). |
| Transferir entre setores, com contexto do destino (matrícula ou aluno) | `AcoesAtendimento.tsx:146-198` | Fica (D10, transferência = encerrar e abrir outro). |
| Convidar participante (com prazo e "pode enviar") e revogar | `AcoesAtendimento.tsx:99, 102, 200-264, 328-396` | Fica (doc 02 E3.4). |
| Encerrar atendimento, com confirmação | `AcoesAtendimento.tsx:103, 117-129` | Fica (doc 03: substitui "arquivar"). |
| Filtros por Setor e Status; chip "Minhas" | `PainelFiltros.tsx:46, 62-73` | Fica (doc 02 E7). |
| Paginação ("Carregar mais", "Mensagens anteriores") e lista virtual | `ListaAtendimentos.tsx:52-71`; `ConversaAberta.tsx:146` | Fica. |
| Painel por setor: Financeiro (cobranças), Secretaria (documentos) e Pedagógico (turma, frequência) | `PainelSetor.tsx:22-33` | Fica. O protótipo só desenha o Comercial. |
| Cobrança no painel: registrar pagamento, promessa e retomar régua | `AcoesContato.tsx:254-327` | Fica. |
| Opt-out: registrar e remover com evidência (só admin) | `OptOutContato.tsx:47-52` | Fica (LGPD). |
| Vincular e desvincular contato a aluno, responsável ou oportunidade (com motivo) | `AcoesContato.tsx:81-82, 138-252` | Fica. |
| Editar nome salvo, mostrando o nome do perfil do WhatsApp | `AcoesContato.tsx:95-133` | Fica. |
| Triagem administrativa e revisão de envio incerto | `PainelTriagem.tsx:16-36` | Fica. |
| Menu da mensagem: copiar, reagir, encaminhar, editar e apagar | seção 6 | Fica (doc 03). |
| Emoji, GIF e figurinha | `Compositor.tsx:264-266`; `SeletorEmoji` | Fica (doc 03). |
| Gravar voz e colar arquivo | `Compositor.tsx:170-199, 276` | Fica (doc 03). |
| Enquete, cartão Pix e visualizador de mídia | `BalaoMensagem.tsx`; `EnqueteLeitura`, `CartaoPix`, `VisualizadorMidia` | Fica (doc 03). |
| Status de entrega (Enviando, Enviada, Entregue, Lida, Não enviada) e "Enviada pelo celular" | `BalaoMensagem.tsx:24-30`; `lib/labels.ts:157` | Fica (D9). |
| "Transferido de <setor>" | `ConversaAberta.tsx:122` | Fica. |
| Grupos (ícone, sem status) | `ListaAtendimentos.tsx:39-41` | Fica (D8). |
| Prazo da sugestão da Aria ("Expira às") | `PainelAria.tsx:44` | Fica. |
| Sino de notificações de SLA | `app/(app)/inbox/page.tsx:66` | Fica. |
| Rascunho por conversa | `Compositor.tsx:38-44` | Fica. |
| **No back-end e sem tela:** `marcarNaoLida`/`marcarLida`, `alternarFavorita`, `avisarDigitando`, `marcarConversaLida` (leitura no WhatsApp), `bloquearContatoWhatsApp`, `enviarConteudoInbox` (contato, localização, enquete), `notasDoAtendimento` | `server/whatsapp/preferencias.ts:45-64`; `motor/acoes-mensagem.ts:405, 445, 510`; `acoes.ts:330`; `acoes-conversa.ts:48` | Ligar. Quase todos são exigências do doc 03 ("digitando", leitura, favoritos, não lida). |

---

## 11. Regras de negócio implícitas no protótipo × ERP

### 11.1 Estados

| Protótipo (`state`, L752) | Significado | ERP |
|---|---|---|
| `ia` (IA atendendo) | A Aria conversa sozinha e o compositor fica travado | Sem campo próprio. Equivale a "Aria ligada (`AgenteIA.estado` ATIVA e sem pausa global) e atendimento sem `iaPausadaEm`". Hoje não aparece na lista nem no cabeçalho. |
| `aprovacao` (Aguardando aprovação) | Há sugestão pendente; a Aria "pausou" | `AcaoAgenteIA.status = SUGERIDA`, com expiração (`server/aria/expiracao.ts:49`). A Aria **não** pausa por sugestão no ERP. |
| `handoff` (Handoff pendente) | A Aria pediu humano | `iaPausaMotivo = HANDOFF`; vai para o dono da oportunidade ou para a fila (Fase 5, Task 21). |
| `humano` (Com você / Com X) | Pessoa responsável; a IA fica fora | `responsavelId` preenchido. A Aria só fica fora se alguém **respondeu** (pausa automática) ou depois de um handoff. |
| "Sem resposta · X min" (`WAIT`, `SLA_MIN = 15`) | Tempo de espera | `prazoRespostaEm` por setor (`server/whatsapp/status-atendimento.ts:30-42`), alerta por cron (`alertas-sla.ts`) e sino. |
| "Não atribuída / Na fila" (`QUEUE`) | Sem vendedor | `ABERTO_SEM_RESPONSAVEL` (`status-atendimento.ts:15`). |
| Status manual Aberta, Pendente, Resolvida, Arquivada (L865) | Escolhido pelo usuário | Máquina automática: `ABERTO_SEM_RESPONSAVEL`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE` e `ENCERRADO` (terminal) (`status-atendimento.ts:11-21`). |

O protótipo mistura dois eixos num estado só: quem fala (IA ou pessoa) e o status do atendimento. O ERP mantém os dois separados, pelo status do atendimento e pela pausa da Aria. A tela do ERP precisa compor os dois para mostrar o que o protótipo mostra.

### 11.2 Fluxo de aprovação da Aria

| Passo | Protótipo | ERP |
|---|---|---|
| Quem decide | Qualquer papel (L318-320) | Admin e Gerente Comercial (`decidirHistorico`, `server/aria/permissoes-tela.ts:22-30`). O gerente só decide na própria equipe (`server/aria/escopo-decisao.ts:35`). O vendedor nem vê a sugestão (`consultas-inbox.ts:280`). |
| Unidade | Uma sugestão com N ações (`acts`) | Uma `AcaoAgenteIA` por ação. |
| Editar antes | Sim: texto, agendamento e tarefa (L1021, L924, L950) | Não (`historico.ts:44`). |
| Depois de aprovar | Estado volta a `ia` (L901) | Executa (`aplicarAcao` / `efetivarRespostaSugerida`, `historico.ts:51`). |
| Rejeitar | Estado volta a `ia` (L902) | `REJEITADA`, com motivo opcional (`historico.ts:59-71`). |
| Assumir | Rejeita as pendentes (L911) e a transferência também (L961) | Assumir não toca nas sugestões. A pausa da Aria cancela só as **intenções** de mensagem da IA (`pausa.ts:20-31`), não as `AcaoAgenteIA` pendentes, que expiram sozinhas. |
| Desfazer | Qualquer papel, no painel (L644) | Admin e GC, na tela `/aria` (`historico.ts:163-175`). |

### 11.3 Transferência entre pessoa e setor

| Aspecto | Protótipo | ERP |
|---|---|---|
| Para pessoa | Qualquer atendente, com presença e carga (L192-198) | Só o gerente do setor, via "Atribuir" (`permissoes.ts:60-61`). |
| Para fila ou equipe | Filas dentro do Comercial (B2C, Corporativo) e Pedagógico | Setores do número (`setoresParaTransferir`, `AcoesAtendimento.tsx:65-67`). A transferência encerra e abre outro atendimento (doc 02 E3.3). |
| Quem transfere | Todos | Responsável ou gerente do setor (`permissoes.ts:58-59`). |
| Contexto | Opcional, mais resumo da Aria como nota | Obrigatório, com no mínimo 12 caracteres. |
| Para a IA | "Devolver para Aria" | `devolverParaAria`, só com escopo de envio (`pausa.ts:75-78`). |

### 11.4 Matriz de permissões (`server/inbox/permissoes.ts:41-73`) × protótipo

| Ação | ERP | Protótipo |
|---|---|---|
| Enviar, nota, agendar, encaminhar, preferência pessoal | Todos (`:47-48`). O envio real depende do escopo de envio. | Enviar e agendar só depois de assumir (L997, L940). |
| Assumir | Só da fila; não vale para professor; regra própria na linha comercial (`:51-57`) | Qualquer um, a partir da IA (L175). |
| Devolver, transferir, convidar | Responsável ou gerente do setor (`:58-59`) | Transferir: todos. |
| Atribuir | Gerente do setor (`:60-61`) | Embutido em "Transferir" para todos. |
| Encerrar | Admin ou papel do setor (`:29-34, 62-63`) | "Resolvida" e "Arquivada" para todos. |
| Bloquear | Gerente ou admin, com motivo (doc 03) (`:66-67`) | Todos, sem motivo. |
| Pausar a Aria (global) | Admin e GC, com motivo | Todos, num toque. |

---

## 12. Conflitos e perguntas ao dono

1. **Status e "Arquivar".** O protótipo tem status manual (Aberta, Pendente, Resolvida, Arquivada) e "Arquivar contato" (L865, L1178, L1188). O doc 03 e a visão geral, decisão 5, dizem "Arquivar = encerrar atendimento", e o ERP tem status automático (`status-atendimento.ts:11-21`). Mantemos o modelo do ERP e tiramos o segmentado do menu? Ou "Pendente" e "Resolvida" devem existir como marcação manual além do status automático?
2. **Não lida: pessoal ou equipe?** O protótipo diz "Marcada como não lida **para a equipe**" (L1180). O doc 03 diz pessoal, e o back-end é pessoal (`preferencias.ts:45`). Confirma pessoal?
3. **Bloquear contato.** O protótipo deixa qualquer papel bloquear, sem motivo nem confirmação (L1189). O doc 03 exige Admin ou gerentes e motivo obrigatório. O ERP segue o doc 03, mas o botão está sempre desabilitado. Confirma o doc 03? Ligamos o botão quando o motor estiver conectado?
4. **Quem aprova, rejeita e desfaz ações da Aria.** No protótipo, o vendedor aprova e desfaz (shot do vendedor). No ERP, só Admin e Gerente Comercial (DF5-13, `permissoes-tela.ts:22-30`). O vendedor dono da oportunidade deve aprovar as sugestões das próprias conversas?
5. **Interruptor "Aria ativa" no Inbox.** No protótipo, todos os papéis veem e usam, sem motivo. No ERP, só Admin e GC, com motivo obrigatório (`estado.ts:72-96`). O interruptor vai para o Inbox? Para quais papéis? Com motivo?
6. **Compositor travado enquanto a IA atende.** O protótipo exige "Assumir para responder" (L408-415). No ERP, quem tem escopo de envio responde direto e a Aria pausa sozinha (Fase 5, Task 14, DF5-6). Qual regra vale?
7. **Assumir de uma conversa da IA.** No protótipo, "Assumir" tira a Aria, faz da pessoa a responsável e rejeita as sugestões pendentes, mesmo se já houver responsável. No ERP, "Assumir" só pega da fila e não pausa a Aria; o motivo `MANUAL` existe e ninguém usa. "Assumir" deve pausar a Aria (`MANUAL`) e decidir as pendentes?
8. **Transferir para pessoa.** No protótipo, qualquer atendente passa para qualquer colega, vendo presença e carga. No ERP, só o gerente atribui (pendência 8 da Fase 3, ainda aberta). Abrimos a transferência entre colegas? A presença (online, ausente, offline) é desejada? Ela exige back-end novo.
9. **Subfilas dentro do setor.** O protótipo tem "Fila Vendas B2C (rodízio)" e "Fila Corporativo (B2B acima de 5 vagas)" (L834). O ERP só tem filas por setor, com `RegraDistribuicao` RODIZIO, MENOR_CARGA e MANUAL. Precisamos de subfilas no Comercial?
10. **Contexto da transferência.** É opcional no protótipo e obrigatório, com no mínimo 12 caracteres, no ERP. Qual vale? O "resumo da Aria como nota" entra?
11. **Itens excluídos na Fase 3** (pendência 12): seguir a conversa, mesclar contato, exportar PDF e recorrência do agendamento. O protótipo aprovado tem os quatro. Continuam fora?
12. **Excluir × cancelar tarefa.** O protótipo exclui sem motivo (L932); o ERP cancela com motivo (`tarefas-acoes.ts:35`). Confirma cancelar com motivo?
13. **Cliente que volta a escrever.** O protótipo pergunta "novo interesse?" e oferece criar uma nova oportunidade ou vincular à anterior. O ERP reaproveita a oportunidade que já existe (`criarLeadDaConversa`). Qual comportamento?
14. **Agendar exige ter assumido?** No protótipo, sim (L940). No ERP, qualquer um com acesso agenda (`permissoes.ts:47`).
15. **Aba Insights.** A Fase 3 diz que fica para a Fase 5, mas o plano da Fase 5 não tem Insights. Entra? Quando? Com quais dados (temperatura, chance, sentimento, melhor horário)?
16. **Sugestão agrupada.** O protótipo aprova "enviar + mover etapa + criar tarefa" num clique. O ERP tem uma `AcaoAgenteIA` por ação. Agrupamos por turno na tela, aprovando todas juntas, ou mantemos uma por uma?
17. **Editar a sugestão antes de aprovar.** Se o texto for editado por uma pessoa, a mensagem sai como autoria da Aria (`IA`) ou do humano (`HUMANO`)? A edição pausa a Aria?
18. **Nova conversa por número livre.** O protótipo cria o contato e a oportunidade em "Novo lead" a partir de um número digitado. O ERP só abre atendimento para destinatários já no escopo. Liberamos? Para quais papéis? A regra "primeira mensagem = modelo aprovado" (L937) ainda vale com o motor?
19. **@menção em nota interna.** Deve notificar a pessoa mencionada pelo sino?
20. **Seletor de número.** No protótipo, aparece só para admin (e gerente com flag). No ERP, o filtro "Número" aparece para todos os papéis do Inbox. Restringimos?

---

## 13. Tempo real: contadores, não lidas, "sem resposta" e SSE

| Comportamento | Protótipo | ERP | Avaliação |
|---|---|---|---|
| Atualização da lista | Estado local, sem servidor | SSE `GET /api/inbox/eventos`. Cada aviso recarrega a primeira página e mescla (`InboxNovo.tsx:152-157`; `useEventosInbox.ts:5, 31, 46`). `resync` a cada reconexão. Avisos filtrados por escopo com cache de 10 s (`server/inbox/eventos-sse.ts:6, 27`) | O ERP está à frente. |
| Thread | Local | Reconcilia a cada aviso (`components/conversa/useConversa.ts:18-22`) | OK. |
| Fontes dos avisos | — | Só triggers em `MensagemWhatsApp` (INSERT/UPDATE) e `AtendimentoWhatsApp` (UPDATE) (`prisma/migrations/20261017100000_inbox_tempo_real/migration.sql:35, 38`) | **Lacuna:** criar sugestão da Aria (`AcaoAgenteIA`), nota (`Evento`), tarefa, agendada (`IntencaoMensagem`) e preferência pessoal não avisam. Uma sugestão nova só aparece se o mesmo turno também gravar mensagem ou alterar o atendimento. |
| Contadores dos chips e da faixa da Aria | Recalculados a cada render (L983, L1026) | Não existem | FALTA (L18 e L26). |
| Não lidas no item | Zera ao abrir (L996) | Selo pessoal (`preferencias-consulta.ts:13-42`), mas **nunca zera ao abrir** (ninguém chama `marcarLida`) | Bug (L28). |
| Selo de não lidas no menu lateral | — | `contarNaoLidas` soma o contador **compartilhado** (`server/whatsapp/consultas-inbox.ts:78-81`), lido só no render do layout (`app/(app)/layout.tsx:12`), sem SSE | Diverge do contador pessoal da lista e não se atualiza em tempo real. |
| "Sem resposta · X min" | Valor fixo `WAIT` (L872); amarelo a partir de 15 min, vermelho a partir de 30 | Selo binário "Prazo estourado" com `agora` congelado (`ListaAtendimentos.tsx:31`); alerta por cron e sino (`alertas-sla.ts`; `page.tsx:66`) | Falta um relógio (tique periódico) e os minutos de espera. |
| Agendada sai no horário | `setInterval` de 10 s (L881) | Despachante por `agendadaPara` (`despachante.ts:190-192`); a mensagem chega à tela pelo trigger de `MensagemWhatsApp` | OK. |
| "Digitando…" e leitura no WhatsApp (doc 03) | — | `avisarDigitando` e `marcarConversaLida` existem e não são chamados | FALTA ligar. |

---

## 14. Esforço por bloco e ordem sugerida

| Ordem | Bloco | Itens | Esforço | Depende de |
|---|---|---|---|---|
| 1 | **Correções de base** | L28 (`marcarLida` e `marcarConversaLida` ao abrir), L35 (tique do prazo), T4 e P28 (exibir notas na thread e no painel), F2 (aba Nota no compositor), L38 (ícones de pino e silenciado), C13 (marcar não lida), M8 (favoritar), F9 e F10 (`onClick` de contato e localização) | **P** | Nada. São bugs ou ligações de back-end que já existe. |
| 2 | **Estado da Aria na lista e no cabeçalho** | L20-L22, L26, L31-L33, C2, faixa L18 (consulta com estado composto e contadores) | **M** | Pergunta 6 (o que conta como "IA atendendo"). |
| 3 | **Tempo real complementar** | Trigger ou aviso para `AcaoAgenteIA`, nota e agendada; selo do menu pessoal e com SSE | **P/M** | Bloco 2. |
| 4 | **Aria inline** | A1-A7, C23-C24 (faixa e modal de handoff com a nota já gravada), C9 (assumir com pausa `MANUAL`), F1 (compositor travado, se aprovado) | **G** | Perguntas 4, 6, 7, 16 e 17. |
| 5 | **Painel CRM em abas** | P2-P6, P8-P26, P30 (desfazer no Inbox), modal de tarefa R1-R8, T6, C16 | **G** (quase só UI) | Pergunta 12. O back-end está pronto, menos R7. |
| 6 | **Lista e filtros completos** | L3-L7, L9-L12, L15, L23, L34, L36 | **M** | — |
| 7 | **Agendamento rico** | T7-T11, F16-F18, F21-F22, F24-F25 | **M** | Perguntas 11 e 14. "Enviar agora" e "perguntar se respondeu" exigem back-end. |
| 8 | **Cabeçalho e menu ⋮** | Reorganizar C12-C22 num menu, C3 (busca na conversa, com back-end), C11 (esconder painel), C22 (bloquear com motivo) | **M** | Perguntas 1 e 3. |
| 9 | **Transferência para pessoa e equipe** | C4-C8 | **M/G** | Perguntas 8, 9 e 10. Presença exige modelo novo. |
| 10 | **Nova conversa por número** | L13-L14, P7 | **M** | Perguntas 13 e 18. |
| 11 | **Insights e "Aria neste contato"** | P29, P31, F15 | **G** | Pergunta 15 (fora de todos os planos hoje). |

A recomendação é começar pelo bloco 1, que é pequeno e corrige comportamento quebrado. Os blocos 2 e 3 vêm em seguida, porque destravam a leitura do estado da Aria, que é a espinha do protótipo. Os blocos 4, 8, 9, 10 e 11 devem esperar as respostas às perguntas da seção 12.
