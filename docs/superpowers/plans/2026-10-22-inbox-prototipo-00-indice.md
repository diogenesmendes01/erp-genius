# Inbox no patamar do protótipo: índice dos planos

> **For agentic workers:** este arquivo é o contrato comum dos planos `01` a `05`. Leia-o antes de qualquer task. Nomes de arquivos, componentes, props, tokens e faixas de migration definidos aqui valem para todas as etapas; um plano de etapa não os redefine.

**Goal:** levar o Inbox (`/inbox`) ao visual e às funções do protótipo aprovado `Inbox.dc.html`, sem perder o que o ERP já faz e o protótipo não mostra.

**Spec:**
- Protótipo (fonte da verdade visual e de interação): `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`, mais `role.js`, `mobile.js` e `support.js`.
- Análise que estes planos implementam:
  - `docs/planejamento/inbox-prototipo/analise-parte1-design.md` (design gráfico);
  - `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md` (controles e regras);
  - `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md` (telas, abas e atalhos).
- Capturas de referência: `docs/planejamento/inbox-prototipo/telas/`.
- Requisitos anteriores que continuam valendo: `docs/planejamento/` (funções do Inbox, doc 03; modelo de atendimento, doc 02), `docs/18-design-system.md` e `AGENTS.md`.

**Escopo:** só a página `/inbox` e o que ela abre. Barra lateral global, demais telas e tema do app ficam fora, exceto os links "Abrir conversa" de outras telas para o Inbox (Etapa 2).

## Planos

| Plano | Etapa | Entrega | Depende de |
|---|---|---|---|
| `2026-10-22-inbox-prototipo-01-correcoes.md` | 0 | Defeitos do Inbox atual: marcar como lida, notas visíveis, prazo vivo, anexos sem ação, cores inexistentes, rolagem dupla, chevron do balão | — |
| `2026-10-22-inbox-prototipo-02-design.md` | 1 | Tokens e travas, casca em tela cheia, coluna Conversas, item da lista, thread, cabeçalho de 68 px e menu ⋮, rodapé e compositor, painel com abas (casca), estados, harness de comparação visual | Etapa 0 |
| `2026-10-22-inbox-prototipo-03-painel-crm.md` | 2 | Abas Detalhes, Oportunidades e Atividade; tags; tarefas e notas no Inbox; atalhos de entrada e saída | Etapa 1; D8, D10, D13, D14 |
| `2026-10-22-inbox-prototipo-04-aria.md` | 3 | Estado da Aria na lista, nos filtros e no cabeçalho; cartão "Aria sugere"; handoff; "Aria ativa"; assumir com pausa | Etapa 1; D1–D4 |
| `2026-10-22-inbox-prototipo-05-fluxos.md` | 4 | Transferir unificado, nova conversa por número, agendamento completo, Insights, anexos extras | Etapas 1–3; D5, D6, D9, D11, D12 |

## Decisões do dono

Enquanto uma decisão estiver aberta, vale a **regra atual do ERP** (coluna "Padrão"). Task que depende de uma decisão aberta cita o ID no título da issue e recebe a label `bloqueado-por-decisao`. Quando a resposta vier, o executor atualiza esta tabela no mesmo PR da task.

| ID | Pergunta | Padrão enquanto aberta | Bloqueia |
|---|---|---|---|
| D1 | Vendedor dono da conversa pode aprovar, rejeitar e desfazer sugestões da Aria? | Só Admin e Gerente Comercial (`consultas-inbox.ts:280`) | E3 |
| D2 | Sugestão aprovada em pacote (mensagem, etapa e tarefa) e com edição? Texto editado sai como Aria ou humano? | Uma sugestão por vez, sem edição | E3 |
| D3 | Compositor travado enquanto a IA atende? "Assumir" pausa a Aria (motivo `MANUAL`)? | Compositor livre; Aria pausa ao primeiro envio humano | E3 |
| D4 | Interruptor "Aria ativa" no Inbox? Papéis? Motivo obrigatório? | Fora do Inbox | E3 |
| D5 | Transferir unificado (pessoa, equipe, fila, devolver à Aria)? Vendedor → vendedor muda a carteira? Contexto opcional? | Fluxos separados atuais; contexto obrigatório (≥ 12 caracteres) | E4 |
| D6 | Presença e carga por pessoa? "Equipes" = setores ou novo cadastro? | Sem presença; equipes = setores | E4 |
| D7 | Status manual (Aberta, Pendente, Resolvida, Arquivada) ou automático do ERP? | Automático do ERP; sem status manual | E1 (menu ⋮) |
| D8 | Barra de etapas do Inbox segue as regras do Funil (10 etapas, um passo por vez)? | Segue o Funil (`destinoDoArraste`) | E2 |
| D9 | Nova conversa por número: quem, em quais números, qual template? | Fluxo atual de "Abrir atendimento" | E4 |
| D10 | Tarefa no Inbox: prioridade baixa, lembretes, recorrência, "notificar também"; excluir ou cancelar com motivo? | Campos atuais de `criarTarefa`; cancelar com motivo | E2 |
| D11 | Agendamento: "perguntar se o contato responder", anexo, vínculo, editar, enviar agora? Exige ter assumido? | Campos atuais; não exige ter assumido | E4 |
| D12 | Insights entram? Quando? Quais campos? | Fora | E4 |
| D13 | Painel mostra telefone, e-mail e CPF em todos os setores? Criar CPF e idade na Pessoa? Abas em conversa não comercial? | Regra 5 (sem telefone no pedagógico); sem CPF/idade na Pessoa; abas comerciais só na finalidade comercial | E2 |
| D14 | Oportunidade, contato e tarefa abrem em gaveta dentro do Inbox ou navegam para fora? | Gaveta dentro do Inbox para edição rápida; "Abrir ficha completa" navega | E2 |
| D15 | Bloquear contato: Admin e gerentes, com motivo (doc 03)? | Doc 03 | E1 |
| D16 | "Marcar como não lida" pessoal ou da equipe? | Pessoal (back-end atual) | E1 |
| D17 | Filtro de número só para Admin e gerente com permissão? | Todos os papéis do Inbox (regra atual) | E1 |
| D18 | Cliente que volta: perguntar "novo interesse?" ou reaproveitar a oportunidade? | Reaproveitar | E2 |
| D19 | Seguir conversa, mesclar contato, exportar PDF e recorrência continuam fora? "Buscar na conversa" entra quando? | Fora; busca na conversa entra na E1 (doc 03 linha 17) | E1 |
| D20 | "+ tag" e marca de tag criada pela Aria; @menção em nota avisa no sino? | Tag criada sem autor = marca ✦; @menção sem aviso | E2 |
| D21 | Funil, Tarefas, Contatos e Agente ganham "Abrir conversa" e "Agendar mensagem"? | Sim, só como link (`/inbox?c=`, `?agendar=1`) | E2 |

## Contrato de componentes

Arquivos novos e responsabilidades. Um plano de etapa cria o arquivo na etapa indicada; as seguintes só estendem. Caminhos relativos a `src/app/(app)/inbox/`, salvo indicação.

| Arquivo | Etapa | Responsabilidade | Interface pública |
|---|---|---|---|
| `page.tsx` | E1 (muda) | Sessão, filtros da URL e dados iniciais; renderiza só `<InboxNovo>` em tela cheia (sem `h1`, sem formulário) | — |
| `InboxNovo.tsx` | E1 (muda) | Grade 372 / flex / 348; vistas no celular; painel alternável (`painelAberto`) | mantém `PropsInboxNovo`; acrescenta `abrirPainelPadrao?: boolean` |
| `ColunaConversas.tsx` | E1 | Cabeçalho da coluna (título, seletor de número, filtro, nova conversa), busca ⌘K, slot `faixaAria`, `ChipsFiltro`, `ListaAtendimentos` | `ColunaConversas(props: { filtros; opcoesFiltro?; itens; proximo; selecionado; aoSelecionar(id: string): void; aoCarregarMais(): void; faixaAria?: React.ReactNode; aoNovaConversa(): void })` |
| `ChipsFiltro.tsx` | E1 | Chips com ponto colorido e contagem; escreve na URL | `ChipsFiltro(props: { chips: ChipFiltroInbox[]; ativo: string })`; `type ChipFiltroInbox = { id: string; rotulo: string; tom: TomEstado; total: number }` |
| `ItemConversa.tsx` | E1 | Item da lista: avatar colorido, selo IA, nome, prévia, hora mono, contador, pino, badges | `ItemConversa(props: { item: ItemListaInbox; selecionado: boolean; agora: Date; aoSelecionar(): void })` |
| `BadgeEstado.tsx` | E1 | Badge com ponto e tom (IA, aprovação, handoff, humano, sem resposta, fila) | `BadgeEstado(props: { tom: TomEstado; children: React.ReactNode })`; `type TomEstado = "ia" \| "aprovacao" \| "handoff" \| "humano" \| "sem-resposta" \| "neutro"` em `estado-visual.ts` |
| `estado-visual.ts` | E1 | Mapeia `ItemListaInbox` → badges, prévia e tom; função pura testável | `estadoVisualItem(item: ItemListaInbox, agora: Date): { badges: { tom: TomEstado; texto: string }[]; previa: string; avatarTom: number }` |
| `CabecalhoConversa.tsx` | E1 | Cabeçalho de 68 px: avatar, nome, status, subtítulo, busca, Transferir, Assumir, alternar painel, `MenuConversa` | `CabecalhoConversa(props: { atendimento: AtendimentoAberto; acoes: AcoesCabecalho; painelAberto: boolean; aoAlternarPainel(): void; aoBuscar(): void })` |
| `MenuConversa.tsx` | E1 | Menu ⋮ com as ações que saem do cabeçalho atual (atribuir, convidar, encerrar, fixar, silenciar, não lida, bloquear, opt-out, agendar, convites) | `MenuConversa(props: { itens: ItemMenuConversa[] })` usando `@/components/Menu` |
| `RodapeConversa.tsx` | E1 | Barra travada ("Aria pausou…", Nota interna, Assumir para responder) ou compositor com abas Responder/Nota | `RodapeConversa(props: { modo: "travado" \| "compositor"; abaInicial?: "responder" \| "nota"; ... })` |
| `PainelContato.tsx` | E1 (casca) / E2 (abas) | Cabeçalho do painel (avatar 132 px, nome, subtítulo, tags) e `AbasPainel` | `PainelContato(props: { contato: ContatoPainel; abas: AbaPainel[]; abaAtiva: IdAbaPainel; aoTrocarAba(id: IdAbaPainel): void })`; `type IdAbaPainel = "detalhes" \| "oportunidades" \| "insights" \| "atividade"` |
| `abas/AbaDetalhes.tsx`, `abas/AbaOportunidades.tsx`, `abas/AbaAtividade.tsx` | E2 | Conteúdo de cada aba | — |
| `abas/AbaInsights.tsx` | E4 (D12) | Conteúdo de Insights | — |
| `aria/CartaoSugestaoAria.tsx`, `aria/FaixaHandoff.tsx`, `aria/FaixaAriaAtiva.tsx` | E3 | Cartão na thread, faixa de handoff, faixa da coluna | — |
| `src/components/conversa/BalaoMensagem.tsx` | E1 (muda) | Variantes por autor: `cliente`, `humano`, `aria`, `nota` | acrescenta `autor: AutorBalao` |
| `src/components/conversa/EventoSistema.tsx`, `SeparadorDia.tsx` | E1 | Pílula de evento e separador de dia | — |
| `src/components/Avatar.tsx` | E1 (muda) | Cor por hash do id (8 tons) e selo opcional | acrescenta `tom?: number` e `selo?: "ia"` |

Componentes atuais que somem ou viram conteúdo de aba, sem perder função: `PainelSetor` (vira conteúdo de `AbaDetalhes` em finalidade não comercial), `PainelAria` (E3), `PainelFiltros` (vira o filtro da coluna), `NovoAtendimento` (vira o popover de nova conversa), `AcoesAtendimento` e `AcoesContato` (botões vão para `CabecalhoConversa` e `MenuConversa`).

## Tokens

Novos tokens em `src/app/globals.css` (`:root` e `.dark`), sempre em hex ou `rgba()` (trava atual):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--avatar-1` … `--avatar-8` | da tabela §1.1 da análise parte 1 | idem | fundo do avatar por hash |
| `--bubble-ia` | `#EFEBFA` | `#2B2A37` | balão da Aria |
| `--bubble-note` | `#FFF7E5` | `#3A3020` | nota interna (borda tracejada `--warn`) |
| `--chat-dot` | `rgba(0,0,0,.035)` | `rgba(255,255,255,.035)` | pontos do fundo da thread |
| `--font-mono` | — | — | JetBrains Mono via `next/font`, para horas e contagens |

Os valores exatos e os demais tokens vêm da análise parte 1, §1; o plano 02 os copia literalmente.

## Migrations

O integrador reserva estes IDs; nenhuma migration fora da faixa da etapa.

| Etapa | Faixa |
|---|---|
| E0 | nenhuma (se precisar, `20261023010000`–`20261023090000`) |
| E1 | nenhuma |
| E2 | `20261023100000`–`20261023190000` |
| E3 | `20261023200000`–`20261023290000` |
| E4 | `20261023300000`–`20261023390000` |

Função SQL redefinida exige `diff -w` contra a definição vigente no main, no corpo do PR. Índice em tabela grande: `CREATE INDEX CONCURRENTLY`, sozinho na migration.

## Global Constraints (valem para todas as tasks de todos os planos)

- Textos em pt-BR, sentence case, sem Title Case nem caixa alta.
- Tokens só nos blocos `:root` e `.dark` de `globals.css`. Cor em componente só por classe de token. Nenhuma classe de cor que não exista no CSS compilado (a trava `paleta.test.ts` é ampliada na E0).
- Ícones: `@tabler/icons-react` (equivalente visual do lucide do protótipo). Nenhum asset do WhatsApp.
- Fonte do texto: a Roboto atual. Números, horas e contadores: `--font-mono` com `tabular-nums`.
- Pesos 400, 500 e 600. O 700 do protótipo vira 600, exceto onde a análise parte 1 §5 diz o contrário.
- Agentes não rodam `npm install`/`npm ci`/`npx` de instalação nem mudam `package.json`/lockfile sem coordenação do integrador (`AGENTS.md`). Use `node_modules/.bin/*`.
- Antes de cada PR, com saída 0: `node_modules/.bin/tsc --noEmit`, `npm test`, `npm run lint` (`--max-warnings 40`). Integração tocada: `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivos>` com o perfil de banco descartável.
- Toda ação nova com efeito colateral segue o padrão de idempotência do #166 (chave por envio, `repeticaoIdempotente`, marca no Evento).
- Datas e horas exibidas seguem o fuso pessoal com fallback na escola (`formatarInstanteExibicao`, Q176); campo de entrada usa `CampoDataHoraLocal`.
- Permissões: toda ação nova passa pela matriz do Inbox (`PAPEIS_INBOX` e a matriz do doc 03). Nenhuma regra nova de papel sem decisão registrada.
- Tempo real: nada de polling (`sem-polling.test.ts`); mudanças novas publicam `AvisoInbox`.
- Funções do ERP que o protótipo não mostra continuam acessíveis (lista na análise parte 3 §1, item 7).
- Registrar cada entrega em `docs/planejamento/quadro-entregas.md`.
- Commits terminam com o trailer de co-autoria do projeto.

## Aceite visual (todas as tasks com UI)

1. Rodar o app com `scripts/visual/demo-inbox.ts` (criado na E1, Task "Harness") e capturar com `scripts/visual/capturar-inbox.mjs` nos estados da task, em 1440×900, 1024×768 e 390×844, nos dois temas.
2. Comparar com a captura do protótipo do mesmo estado (`docs/planejamento/inbox-prototipo/telas/` ou renderizada pelo mesmo script a partir do HTML).
3. Anexar as duas imagens no PR. O revisor reprova diferença visível de layout, tamanho, cor ou texto não justificada na análise.

## Formato das issues

- **Título:** `[Inbox E<etapa>.<task>] <título da task>`, com `(D<n>)` ao final quando depende de decisão.
- **Labels:** `inbox`, `etapa-<n>`, um tipo (`ui`, `back-end`, `aria`, `motor`), `bloqueado-por-decisao` quando aplicável.
- **Corpo:** objetivo em 1–2 frases; link para a task no plano (`docs/superpowers/plans/<arquivo>.md#task-<n>`); arquivos; critérios de aceite (os testes da task e o aceite visual); dependências (outras issues e decisões).
- Cada plano termina com a seção **Issues**: um bloco por task, já no formato acima, e um arquivo irmão `<plano>.issues.json` com a lista `[{ "title", "labels", "body" }]` para criação em lote.
