# Inbox do ERP Genius: protótipo × implementação (Parte 1: design gráfico)

Base: protótipo `prototipo/Inbox.dc.html` (+ `mobile.js`, `role.js`, `support.js`) e ERP `/home/claude/erp-genius` no main `7e4810e5`. Linhas citadas como `HTML:n` são do `Inbox.dc.html`. Arquivos do ERP são relativos a `src/`, e os do inbox ficam em `app/(app)/inbox/`.

## Resumo executivo

- **Distância geral: grande.** Os **tokens de cor são quase os mesmos**: o protótipo é o DS WDS que o ERP já adotou na Fase 0, e até o `oklch` da IA converte exatamente para os hex do DS. A **composição da tela, porém, não foi portada**. O Inbox atual é uma página comum do ERP: título "Inbox", formulário "Abrir atendimento" acima, caixa de 3 colunas com borda, linha de metadados em texto corrido e 10 a 13 botões-pílula no cabeçalho. O protótipo é uma tela de app em altura total, com cartão "Aria ativa", chips com ponto e contagem, badges de status, balões por autor (IA roxa, nota tracejada), cartão de sugestão da Aria dentro da thread e painel do contato com avatar grande, abas e lista de campos com ícone.
- **Principal causa:** a Fase 3 (Tasks 29 a 32) portou **comportamento e permissões**, não a anatomia visual. O plano só exigia "tokens e primitivos do DS" (`ItemLista`, `Avatar`, `Chip`, `Botao`), e esses primitivos são genéricos do ERP: `Avatar` verde único, `ItemLista` de 2 linhas e `Botao` em pílula com texto verde. Não há componente com o desenho do protótipo, nem tokens para IA em balão, cor de avatar, fundo pontilhado ou fonte mono.
- **Defeitos visuais objetivos no atual (independem do protótipo):**
  - contador de não lidas invisível, porque `bg-brand` não existe no Tailwind;
  - ✓✓ de "Lida" sem verde (`text-brand` também não existe);
  - `text-muted-foreground` inexistente no `PainelSetor`;
  - chevron do menu da mensagem sobreposto ao texto do balão;
  - página com rolagem dupla (1044 px de altura a 900 px de viewport);
  - notas internas nunca exibidas na thread.
- **Travas de teste:** O `oklch` não é bloqueio real, porque basta converter para hex ou `rgba`. O que muda de fato:
  - `design-system.test.ts` (tokens novos e a lista de sombras);
  - `paleta.test.ts` (sombra só em camada flutuante, mas o protótipo põe sombra em cartões da thread);
  - `contraste` (cores de avatar com branco entre 4,01 e 4,53:1; `--faint` e `--warn` claros abaixo de 4,5:1);
  - `tipografia.test.ts` (peso 700 em contadores, e a JetBrains Mono, que exige outro arquivo de fonte).
- **Esforço total estimado: G** (cerca de 8 áreas M/G). Ordem sugerida: casca e layout → lista → balões e thread → cabeçalho e rodapé → painel → cartão da Aria → estados.

---

## 0. Ressalvas de leitura do protótipo (conferidas no navegador)

| Item | O que foi conferido |
|---|---|
| Fonte | O CSS declara `"Interface Sans","Segoe UI",Roboto,system-ui` (HTML:17) e carrega Roboto 400–700 e JetBrains Mono 400/500 do Google Fonts (HTML:12). "Interface Sans" é o apelido da **mesma Roboto variável** do DS (`docs/planejamento/design-system-referencia.md` §3). **Não há Onest no protótipo nem no ERP** (grep sem ocorrências). As screenshots do protótipo usam fonte de reserva (Inter e DejaVu Sans Mono), porque o Google Fonts está bloqueado neste ambiente: `document.fonts` só carregou `lucide`. |
| Geometria do `mobile.js` (linhas 12–15) | O código quer botões de texto em pílula (999px), botões quadrados em círculo e busca e compositor com 22px. No render, o React grava o estilo como `padding: 0px 12px` (com espaço), então **só a regra de botão quadrado casa**. Raios medidos: "Transferir" e "Assumir conversa" = **9px**; busca = **10px**; botões de ícone (painel, mais, filtros, enviar) = **50%**. Este relatório trata o render (screenshots aprovadas) como verdade. Se a intenção era pílula, isso já coincide com o `Botao` do ERP. |
| Breakpoints | `mobile.js:3`: celular < 700, tablet 700–1099, desktop ≥ 1100. Painel aberto por padrão só com `innerWidth ≥ 1200` (HTML:879, `wide`). |
| Larguras medidas (1440 px) | rail 64, lista 372, conversa 656, painel 348. |

## 1. Tokens

### 1.1 Cores (protótipo HTML:15–16 × `app/globals.css:10–143`)

Status: IGUAL = mesmo valor; ≈ = equivalente após conversão ou composição; DIVERGE; FALTA = sem token no DS.

| Papel (protótipo) | Protótipo escuro | Protótipo claro | Atual escuro (token) | Atual claro (token) | Status |
|---|---|---|---|---|---|
| `--chat` fundo da conversa | #161717 | #F7F5F3 | #161717 `--bg-page` | #F7F5F3 `--bg-page` | IGUAL |
| `--surface` colunas, cabeçalho, rodapé | #161717 | #FFFFFF | #161717 `--surface` | #FFFFFF `--surface` | IGUAL |
| `--rail` / `--elev` (busca, chip de etapa, cartão) | #1D1F1F | #F7F5F3 | #1D1F1F `--surface-muted`/`--surface-raised` | #F7F5F3 `--surface-muted` | IGUAL |
| `--elev2` (item selecionado, chip ativo) | #242626 | rgba(0,0,0,.07) | #2A2C2C `--neutral-muted` (#242626 só existe como `--entry`) | #EDEDED `--neutral-muted` (= .07 sobre branco) | DIVERGE escuro / ≈ claro |
| `--line` bordas | rgba(255,255,255,.1) | rgba(0,0,0,.1) | `--border` | `--border` | IGUAL |
| `--ink` | #FAFAFA | #0A0A0A | `--text-primary` | `--text-primary` | IGUAL |
| `--mute` | rgba(255,255,255,.6) | rgba(0,0,0,.6) | `--text-secondary` | `--text-secondary` | IGUAL |
| `--faint` (hora, ícones, ⌘K) | #757778 | #959393 | `--text-terciary` #8F9192 | `--text-terciary` #6D6C64 | DIVERGE: #959393 dá 3,06:1 sobre branco e 2,81:1 sobre #F7F5F3; o DS adaptou de propósito |
| `--accent` (botão primário, contador, aba, link) | #21C063 | #1B8755 | `--brand-solid` #21C063 | `--brand-solid` #1B8755 | IGUAL como fundo. Como **texto** no claro o protótipo usa #1B8755 (4,16:1 sobre #F7F5F3), e o DS usa `--brand-text` #15603E → DIVERGE |
| `--accent-ink` | #0A0A0A | #FFFFFF | `--on-brand-solid` | `--on-brand-solid` | IGUAL |
| `--accent-soft` | #103529 | #D9FDD3 | `--brand-bg` | `--brand-bg` | IGUAL |
| `--ai` | oklch(0.75 0.13 290) = **#AD9FFA** | oklch(0.52 0.16 290) = **#6A53BD** | `--ai-text` #AD9FFA | `--ai-text` #6A53BD | ≈ IGUAL (conversão exata) |
| `--ai-soft` | oklch(.75 .13 290 / .14) = #2B2A37 sobre #161717 | oklch(.52 .16 290 / .09) = #F2EFF9 sobre branco | `--ai-bg` #2B2A37 | `--ai-bg` #F2F0F9 | ≈ (translúcido no protótipo, opaco no DS) |
| `--ai` como fundo com texto `--surface` (ícone do cartão Aria, botão Insights HTML:115, 674) | #161717 sobre #AD9FFA | #FFFFFF sobre #6A53BD | `--ai-solid` #6A53BD + branco nos dois temas | idem | DIVERGE escuro (o protótipo usa o lilás claro com texto escuro, 7,80:1) |
| `--warn` | #FFD279 | #B97A00 | `--warning-text` #FFD279 | `--warning-text` #7A4F00 | IGUAL escuro / DIVERGE claro (#B97A00 = 3,59:1 sobre branco, 3,37:1 sobre #FFF7E5) |
| `--warn-soft` / `--b-note` | #362C1F | #FFF7E5 | `--warning-bg` | `--warning-bg` | IGUAL |
| `--danger` | #FB5061 | #EA0038 | `--danger-text` #FB5061 / `--danger-solid` #C4002F | `--danger-solid` #EA0038 / `--danger-text` #B3002B | Texto: IGUAL escuro / DIVERGE claro (3,93:1 sobre #FDE8EB). Sólido: DIVERGE escuro (branco sobre #FB5061 = 3,27:1, HTML:260) |
| `--danger-soft` | #321622 | #FDE8EB | `--danger-bg` | `--danger-bg` | IGUAL |
| `--b-in` balão recebido | #242626 | #FFFFFF | `--entry` | `--entry` | IGUAL |
| `--b-me` balão enviado | #144D37 | #D9FDD3 | `--entry-accent` | `--entry-accent` | IGUAL |
| `--b-ia` balão da IA | #2A2438 | #EFEBFA | — (o atual usa `--entry-accent`) | — | FALTA (vizinho de `--ai-bg`, mas não igual) |
| `--dot` fundo pontilhado | rgba(255,255,255,.03) | rgba(0,0,0,.035) | — | — | FALTA |
| Avatares `oklch(0.58 0.11 h)`, 8 matizes (HTML:753, 992) | #0089A7, #B25E59, #258E6A, #7A6EB7, #A07020, #A55F8F, #728431, #008D94 | idem | `Avatar` único `bg-brand-bg text-brand-800` (`components/Avatar.tsx:16`) | idem | FALTA. Branco sobre eles = 4,01–4,53:1 (5 de 8 abaixo de 4,5 para iniciais de 14 px/600) |
| Status "Frio" `oklch(0.7 0.1 230)` (HTML:1156) | — | — | `--cold-text` | `--cold-text` | ≈ (há token) |
| Cores do menu Anexar `oklch(0.7 0.13 h)` e `/ .15` (HTML:1190) | 9 matizes | idem | — | — | FALTA (só se o menu de anexos for portado) |
| `--shadow` | 0 6px 24px #0006 | 0 5px 20px #0002 | `--shadow-popover` | `--shadow-popover` | IGUAL no valor; DIVERGE no uso (ver §1.5) |

**Onde o claro do protótipo coincide com o DS:** fundos (`#F7F5F3`/`#FFFFFF`), linha, texto primário e secundário, verde sólido `#1B8755` com texto branco, `#D9FDD3`, balões, `warning-bg`, `danger-bg`, sombra, e o roxo da IA (`#6A53BD`).

**Onde diverge:** terciário (`#959393` × `#6D6C64`), verde como texto (`#1B8755` × `#15603E`), aviso como texto (`#B97A00` × `#7A4F00`), perigo como texto (`#EA0038` × `#B3002B`), `--elev2` translúcido × `#EDEDED`, e balão da IA e avatares, que não existem no DS. Todas as divergências do claro são exatamente as adaptações "A" que o DS fez para passar em contraste (`docs/18-design-system.md` §Tokens). **Recomendação:** manter os tokens do DS e não importar os valores crus do protótipo.

### 1.2 Tipografia

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Família de UI | Roboto ("Interface Sans") HTML:17 | Roboto variável local `app/layout.tsx:6–10` | IGUAL | — |
| Família mono (horas, contagens, ⌘K, número do WhatsApp) | JetBrains Mono 400/500, 10.5–11.5px (HTML:88, 111, 125, 145, 270, 279, 301, 454, 492, 642) | não existe; horas em Roboto `text-xs` (`components/conversa/BalaoMensagem.tsx:82`, `ListaAtendimentos.tsx:42`) | FALTA | Decidir: (a) adotar JetBrains Mono como 2º arquivo local, o que exige mudar `tipografia.test.ts`; ou (b) usar `font-variant-numeric: tabular-nums` na Roboto. Recomendo (b). |
| Base | 14px (HTML:24) | `body` 16px; textos do inbox em `text-sm` 14 / `text-xs` 12 | DIVERGE | Ok usar 14 dentro do inbox. |
| Título da coluna "Conversas" | 20px/600, tracking −.01em (HTML:41) | não há; o título é o `h1` "Inbox" 24px/500 da página (`page.tsx:65`) | DIVERGE | Título dentro da coluna. |
| Nome no item | 14px/600 (HTML:143) | `font-medium` 16px (`components/ItemLista.tsx:31`) | DIVERGE | |
| Prévia | 13px `--mute` (HTML:148) | `text-sm` 14 `text-gray-600` (ItemLista:32) | DIVERGE | |
| Badges e chips | 11px/600 e 12.5px/500 (HTML:124, 152) | `text-sm` (Chip) / `text-xs` (metadados) | DIVERGE | |
| Nome no cabeçalho | 15px/600 (HTML:167) | `font-medium` 16px (`ConversaAberta.tsx:266`) | DIVERGE | |
| Texto do balão | 14px, line-height 1.45 (HTML:278) | `text-sm` 14 (line-height 20px = 1.43) | ≈ | |
| Autor do balão | 12px/600 colorido por autor, com ícone (HTML:276) | `text-xs font-semibold text-gray-600` (BalaoMensagem:76) | DIVERGE (sem cor nem ícone) | |
| Nome no painel | 20px/500 (HTML:478) | `font-medium` 14 (`InboxNovo.tsx:287`) | DIVERGE | |
| Pesos | 400/500/600 **e 700** (contador, badge do filtro, avatar do rail, HTML:44, 149, 501, 687) | 400/500/600 (trava) | DIVERGE | Levar os 700 do protótipo a 600 (regra da Fase 0: 650 vira 600). |
| Caixa alta | rótulos de seção em `text-transform:uppercase`, 11px/.06em (HTML:68, 86, 239, 448 …) | o DS proíbe ("Sentence case sempre", docs/18 §Princípios); não há trava de teste | DIVERGE (regra de produto) | Manter sentence case ou mudar o docs/18. |

### 1.3 Raios

| Uso | Protótipo (render) | Atual | Status |
|---|---|---|---|
| Botão de texto | 9px (HTML:174, 176, 412–413); 10px no modal (HTML:463–464) | `rounded-full` (`components/Botao.tsx:21`) | DIVERGE (o DS manda pílula) |
| Botão de ícone 34–44px | 50% (`mobile.js:13`) | `rounded-full` | IGUAL |
| Busca | 10px, h 38 (HTML:108) | `rounded-md` 8px, h 34 (`PainelFiltros.tsx:103`) | DIVERGE |
| Chip de filtro | 20px, h 28 (HTML:124) | `rounded-full`, h ≥ 32 (`components/Chip.tsx:4`) | ≈ |
| Item da lista | 12px (HTML:137) | `rounded-item` 10px | DIVERGE |
| Badge de status/etapa | 6px, h 20 (HTML:152–153) | não existe (texto corrido) | FALTA |
| Balão | 12px, com canto de 4px no lado do autor e 12px em sequência (HTML:1012) | `rounded-lg` 12px simétrico (BalaoMensagem:75) | DIVERGE (sem "cauda") |
| Cartões (sugestão, handoff, painéis) | 12–14px | `rounded-md` 8px (`PainelAria.tsx:75`) | DIVERGE |
| Popover/menu | 14px (HTML:49, 187, 238) | 9px (`components/Menu.tsx:6`) / modal 14px | DIVERGE |
| Avatar B2B | 12px (lista), 11px (cabeçalho), 34px (painel 132px) (HTML:992, 1097) | `rounded-md` 8px via `quadrado`, **não usado no inbox** | FALTA |

### 1.4 Bordas e espaçamentos

| Elemento | Protótipo | Atual | Status |
|---|---|---|---|
| Divisória de coluna | 1px `--line` (HTML:38, 472) | `border-r`/`border-l` (cor padrão = `--border`) | IGUAL |
| Padding da coluna lista | 18px laterais (HTML:39, 107, 122) | 8px (`p-2`, PainelFiltros:127) | DIVERGE |
| Item | padding 11×10, gap 12 (HTML:137) | `p-3` gap 12, `min-h-[76px]` + linha extra de metadados | DIVERGE |
| Mensagens | padding 18px 7% 10px, gap 6 (HTML:264) | `p-3` (ConversaAberta:295) | DIVERGE |
| Rodapé | padding 10 16 14, `border-top` (HTML:351) | `px-3 py-2 border-t` (`components/conversa/Compositor.tsx:319`) | ≈ |
| Painel | padding 16 18 24, gap 20 (HTML:495); topo 36 24 26 (HTML:473) | `p-4` blocos separados por `border-t` | DIVERGE |

### 1.5 Sombras

| Uso no protótipo | Linha | Permitido pelo DS atual? |
|---|---|---|
| Popovers (filtros, nova conversa, transferir, mais, anexos, agendar) | HTML:49, 81, 187, 238, 353, 363 | Sim (`shadow-popover`) |
| Modal de handoff, modal de tarefa | HTML:437, 683 | Sim, mas o DS usa `shadow-dialog`, mais forte; o protótipo usa `--shadow` |
| **Cartão de sugestão da Aria na thread** | HTML:299 | **Não** (`paleta.test.ts`: sombra só em camada flutuante) |
| **Faixa de handoff** | HTML:254 | **Não** |
| Balão `0 1px 1px rgba(0,0,0,.08)` | HTML:275 | **Não** (e é cor arbitrária) |
| Toast | HTML:185 | Sim (camada flutuante) |
| Drawer do painel no tablet `-16px 0 40px rgba(0,0,0,.35)` | `mobile.js:47` | ≈ (`shadow-dialog`) |

### 1.6 Ícones

| | Protótipo | Atual | Status |
|---|---|---|---|
| Biblioteca | Lucide (fonte `lucide-static@0.460`, HTML:13) | Tabler outline (`@tabler/icons-react`, docs/18 §Ícones) | DIVERGE (manter Tabler e mapear) |
| Tamanhos | 11–13px em badges/meta; 15–17px em botões; 18–20px em campos do painel e rail; 17–19px no compositor | 16px padrão (`size={16}`), 20px em botões do compositor e cabeçalho | DIVERGE (o protótipo é mais variado) |
| Mapeamento necessário (Lucide → Tabler) | sparkles→IconSparkles, hand→IconHandStop, arrow-right-left→IconArrowsExchange, panel-right→IconLayoutSidebarRight, ellipsis-vertical→IconDotsVertical, check-check→IconChecks, clock-alert→IconClockExclamation, user-round-x→IconUserX, life-buoy→IconLifebuoy, sticky-note→IconNote, lock→IconLock, list-filter→IconFilter, square-pen→IconEdit, smartphone→IconDeviceMobile, briefcase→IconBriefcase, list-todo→IconListCheck, send-horizontal→IconSend, paperclip→IconPaperclip | | — |

## 2. Layout da página do Inbox (sem a barra lateral global)

| Elemento | Protótipo | Atual (arquivo:linha) | Status | O que fazer |
|---|---|---|---|---|
| Altura e encaixe | Tela cheia `100vh`, `overflow:hidden`, sem título de página (HTML:24) | Página com `h1` "Inbox" + `SinoNotificacoes` + `NovoAtendimento` (form com 2 selects e aviso) acima da caixa (`page.tsx:63–75`); caixa `h-[calc(100dvh-8rem)]` (`InboxNovo.tsx:308`). Medido: caixa começa em y=240 e a página tem 1044px a 900 de viewport → **rolagem dupla** | DIVERGE | Inbox ocupando toda a área de conteúdo; "Nova conversa" vira botão na coluna (HTML:45) com popover; sino no app shell. |
| Moldura | Colunas encostadas, sem borda externa | `rounded-item border` em volta das 3 colunas (`InboxNovo.tsx:308`) | DIVERGE | Remover a moldura. |
| Grade (≥ 1100) | lista 372 / conversa flex / painel 348 (HTML:38, 162, 472) | lista 360 / conversa flex / detalhes 320 (`InboxNovo.tsx:189, 341`); medido 360/470/320 | DIVERGE (−12/−28) | Ajustar para 372/348. |
| Painel no desktop | Aberto por padrão só ≥ 1200; botão "Painel do contato" alterna (HTML:881, 1113) | Sempre visível ≥ 1100; o botão de alternar só existe < 1100 (`ConversaAberta.tsx:277`) | DIVERGE | Botão de alternar sempre visível; estado do painel. |
| Tablet 700–1099 | Lista 300 + conversa; painel em sobreposição fixa à direita, sem véu, com sombra (`mobile.js:46–47`); lista ≤ 44vw (`mobile.js:38`) | Lista 320 + conversa; painel em `Drawer` com véu `bg-black/60`, largura `md:w-[45%]` (`InboxNovo.tsx:189, 343`; `components/Drawer.tsx:22`) | ≈ (drawer existe) / DIVERGE (largura, véu, cabeçalho "Detalhes da conversa") | Drawer de 348px sem título; o conteúdo do painel já traz avatar e nome. |
| Celular < 700 | Uma vista por vez (`data-mview` list/chat/panel, `mobile.js:34–36`), sem rail, tabbar fixa de 58px, mensagens com padding 12 10 (`mobile.js:42`), popovers viram bottom sheet de 18px (`mobile.js:43–45`), o painel ocupa a tela com "voltar" (HTML:474) | Uma vista por vez (`data-vista`, `InboxNovo.tsx:309, 314`), mas abaixo do título e do formulário "Abrir atendimento": a lista só começa em y≈490 (`atual-claro-admin-celular-lista.png`); o painel é um Drawer de 100% com título; os 3 selects de filtro ficam empilhados | DIVERGE | Vista em tela cheia; remover título e formulário da vista do celular; voltar com chevron. |
| Cabeçalhos | 68px fixos com fundo `--surface` e `border-bottom` (HTML:163) | `header` com `p-3` e ações que quebram em 3–4 linhas: **207px** medidos (`ConversaAberta.tsx:261–294`) | DIVERGE | Cabeçalho de 68px; ações no menu ⋮ (ver §3.3). |
| Rolagem | Só a lista e as mensagens rolam (HTML:135, 264) | Lista, thread e painel rolam (ok), mas a página também rola | DIVERGE | Ver a primeira linha da tabela. |
| Fundo da conversa | `--chat` com pontos radiais 1px a cada 18px (HTML:162) | Fundo da página, liso | FALTA | Token `--dot` + `background-image` (sem cor arbitrária em classe: usar classe utilitária própria no globals). |

## 3. Componentes visuais

### 3.1 Coluna Conversas

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Título | "Conversas" 20/600 (HTML:41) | não há (o `h1` "Inbox" é da página) | FALTA | Adicionar. |
| Seletor de número | Botão texto 12.5px `--mute` "Todos os WhatsApp · 4 conectados" com ícone de celular e chevron; popover com ponto colorido, número em mono, "Instável" e contagem (HTML:42, 99–106); só admin (e gerente com flag) (HTML:871) | `<select>` "Todos os números" (`PainelFiltros.tsx:140`) | DIVERGE | Botão + popover; status de sessão vem de `NumeroWhatsApp.sessao`. |
| Botões Filtros / Nova conversa | Ícones 34px, contador verde no filtro (HTML:44–45) | não há: filtros em selects; "Abrir atendimento" é o formulário do topo | FALTA | Popovers (HTML:48–98) com chips por grupo. |
| Busca | h 38, raio 10, `--elev`, ícone lupa, placeholder "Buscar conversas, contatos, tags", selo ⌘K em mono 11px com borda (HTML:108–111) | `input type=search` com borda de controle, h 34, raio 8, placeholder "Buscar", sem ícone (`PainelFiltros.tsx:129`) | DIVERGE | |
| Cartão "Aria ativa" | `--ai-soft`, raio 10, ícone 28px `--ai`, título 13/600, "2 em atendimento · 4 aguardando você" 12px, interruptor 36×20 roxo (HTML:114–121) | não existe | FALTA | Depende de dado global (`AgenteIA.estado`) e contagens. |
| Chips de filtro | h 28, raio 20, borda `--line`, ponto 7px colorido por estado, contagem mono 11px; ativo = `--elev2` sem borda (HTML:122–127, 984–985) | `Chip` em pílula h 32, sem ponto e sem contagem; ativo = `bg-brand-bg` verde (`components/Chip.tsx`); rótulos Todas/Minhas/Fila/Não lidas/Prazo estourado (`PainelFiltros.tsx:118–124`) | DIVERGE | O `Chip` já aceita `contagem`; falta o ponto e a variante neutra de seleção. Os rótulos diferem (funcional, Parte 2). |
| Chips de filtros aplicados | `--accent-soft`, raio 6, com × (HTML:129–134) | não há | FALTA | |

### 3.2 Item da lista

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Contêiner | flex, gap 12, padding 11×10, raio 12; selecionado `--elev2` (cinza) (HTML:137, 995) | `ItemLista` `min-h-76 rounded-item p-3`; selecionado `bg-brand-bg text-brand-800` (verde, nome em verde) (`components/ItemLista.tsx:5–6`) | DIVERGE | Seleção neutra (o protótipo não pinta de verde). |
| Avatar | 44px, iniciais 14/600 brancas sobre cor por matiz; círculo (B2C) ou raio 12 (B2B); "#" para contato sem nome (HTML:138, 754, 992) | `Avatar` 40px verde-claro com texto verde (`components/Avatar.tsx:16`); sem nome → primeiro caractere "+" (`+5511…`, ver `atual-*-desktop.png`); grupo: ícone de grupo em círculo verde (`ListaAtendimentos.tsx:40`) | DIVERGE | Avatar com cor determinística, tokens de avatar e "#" para telefone. |
| Selo da IA | 19px roxo com ✦, borda de 2px `--surface`, canto inferior direito, quando a IA conduz (HTML:139) | não existe | FALTA | |
| Linha 1 | nome 14/600 com elipse; ícones de silenciada/fixada 12px `--faint`; hora mono 11.5px, verde se houver não lidas (HTML:142–146) | nome 16/500; hora `text-xs` cinza à direita, alinhada ao topo (`ListaAtendimentos.tsx:42`); fixada/silenciada não aparecem | DIVERGE / FALTA | |
| Linha 2 | prévia 13px `--mute` com "Aria: …"/"Você: …" (HTML:148, 987) | prévia 14px (só o corpo, sem autor) | DIVERGE | |
| Não lidas | pílula 20px `--accent` com texto `--accent-ink` 11/700 (HTML:149) | `<span className="rounded-full bg-brand px-1.5 text-on-brand">` (`ListaAtendimentos.tsx:42`): **`bg-brand` não é gerado** (o `brand` não tem DEFAULT em `tailwind.config.ts:46–57`; conferido no CSS compilado) → número sem fundo, quase invisível nos dois temas | **DEFEITO** | Trocar para `bg-brand-solid text-on-brand`; a trava de paleta não pega classe sem shade (ver §5). |
| Badges | estado (ponto + rótulo 11/600 sobre `*-soft`: IA atendendo, Aguardando aprovação, Handoff pendente, Com você); etapa (`--elev`); "Sem resposta · 22 min" com ícone de relógio (warn < 30 min, danger ≥ 30) e chips tracejados "Sem nome" e "Na fila" (HTML:151–153, 994) | linha de texto `text-xs text-gray-600` com setor, número, status, responsável e "Prazo estourado" em vermelho (`ListaAtendimentos.tsx:61–67`) | DIVERGE | Componente `Badge` com tons (warning, danger, ai, brand, neutro). O atual mostra setor e número, que o protótipo não tem: decisão de conteúdo na Parte 2. |
| Tags | não aparecem no item (só na busca e no filtro) | — | IGUAL (ausentes) | — |

### 3.3 Cabeçalho da conversa

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Altura e fundo | 68px, `--surface`, `border-bottom` (HTML:163) | auto (207px medidos), sem fundo próprio | DIVERGE | |
| Voltar (celular) | chevron 36px (HTML:164) | `IconArrowLeft` 20 sem área de 44px (`ConversaAberta.tsx:263`) | DIVERGE | |
| Avatar | 40px colorido (oculto no celular) (HTML:165) | `Avatar` 32px verde (`ConversaAberta.tsx:264`) | DIVERGE | |
| Nome + status | nome 15/600 + selo "Aberta" (h 18, raio 5, `--elev`, 10.5/600) (HTML:167) | nome 16/500; o status vai na linha de baixo como texto | DIVERGE | |
| Subtítulo | ponto 7px + "Aria aguarda sua aprovação" 12.5/600 na cor do estado · subtítulo do contato (HTML:168–171, 998) | "Comercial · Central da escola · Em atendimento · Responsável: …" `text-xs` cinza (`ConversaAberta.tsx:268–274`) | DIVERGE | |
| Ações | Busca (ícone), Transferir (contorno 9px, ícone + texto ≥ 1200), **Assumir conversa** (verde 9px, ícone de mão) ou **Devolver para Aria** (`--ai-soft`/`--ai`), Painel (ícone, `--elev2` quando ativo), ⋮ (HTML:173–182) | Até 13 botões `Botao sm` em pílula, em várias linhas: Assumir, Devolver para a fila, Atribuir, Transferir, Convidar, Nota interna, Agendar mensagem, Convites e agendamentos, Encerrar (vermelho), Bloquear (desabilitado), Fixar, Silenciar + "Fixar e silenciar valem só para você." (`AcoesAtendimento.tsx:94–108`) | DIVERGE | Reduzir a 2 primários visíveis + menu ⋮ (o protótipo põe status, não lida, fixar, silenciar, tarefa, agendar, buscar, mesclar, exportar, arquivar e bloquear no menu, HTML:237–251). A escolha das ações é da Parte 2. |
| Menu ⋮ | 290px, raio 14, segmentado "Status da conversa" de 4 colunas + itens 38px com ícone 16 e dica à direita, divisórias, "Bloquear" vermelho (HTML:238–250) | não existe (o `Menu` do DS existe: `components/Menu.tsx`) | FALTA | Usar `Menu` com ícones. |
| Faixa de handoff | cartão com borda `--danger`, ícone de boia 32px, "Aria pediu ajuda há 4 min", motivo e botão "Ver resumo e assumir" `--danger` (HTML:253–262) | não existe; pausa só como texto "Aria pausada · Transferido para humano" no painel (`PainelAria.tsx:66`) | FALTA | Usar `--danger-solid` (o protótipo dá 3,27:1 no escuro). |

### 3.4 Balões, eventos e separadores

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Recebido | `--b-in`, raio "4 12 12 12" (12 em sequência), max `min(560px,72%)`, padding 8 11 6, sombra de 1px (HTML:275, 1010–1012) | `bg-entry rounded-lg px-3 py-2`, max 80% (`BalaoMensagem.tsx:75`) | ≈ cor / DIVERGE forma | Cauda e largura máxima. |
| Enviado (humano) | `--b-me`, autor "Você" 12/600 verde com ícone de usuário, só no 1º da sequência (HTML:276, 1013) | `bg-entry-accent`, autor = nome do usuário `text-gray-600` sempre (BalaoMensagem:76) | DIVERGE | |
| IA | **`--b-ia` roxo**, autor "Aria · IA" com ✦ em `--ai` (HTML:1010, 1013) | mesmo verde do humano, autor "Aria" cinza (`atual-*-desktop.png`) | FALTA (distinção visual da IA) | Token de balão da IA (`--ai-bg` já serve, ver §1.1). |
| Nota interna | `--b-note` + **borda tracejada `--warn`**, autor "Nota interna · só equipe" com cadeado (HTML:1011, 1013) | **não aparece na thread**: `listarMensagensPagina` devolve `notas` (`server/inbox/consultas-pagina.ts:183`), mas `useConversa` não as usa; só há o diálogo "Nota interna" | FALTA | |
| Horário e ✓✓ | mono 10.5px `--mute`; ✓✓ 13px `--accent` (HTML:279) | `text-xs` Roboto; ✓/✓✓ 16px; "Lida" usa `text-brand` (`BalaoMensagem.tsx:28`), **que não é gerado** → ✓✓ cinza | DIVERGE + **DEFEITO** | `text-brand-700` (ou `text-brand-solid`), 13–14px. |
| Menu da mensagem | não há chevron visível no protótipo | chevron 16px **sempre visível** em `absolute right-1 top-1`, por cima do texto (ex.: "Perfeito. Quanto fica?" em `atual-*-desktop.png`); o menu abre por posição fixa `top-7`, sem `posicaoPopover`, e em `atual-claro-admin-desktop-menu-mensagem.png` fica fora da área visível | **DEFEITO** | Mostrar no hover/foco, reservar espaço, usar `posicaoPopover`. |
| Evento de sistema | pílula raio 20, 12px, ícone 13 + texto + hora mono; IA em `--ai-soft`/`--ai`, humano em `--surface`/`--mute` (HTML:266–271, 1008) | não existe (não há eventos na thread) | FALTA | |
| Separador de dia | pílula `--surface` raio 8, 12/500 `--mute` "Hoje" (HTML:266) | não existe | FALTA | |
| Cartão de tarefa na thread | 34px colorido + título + meta + Concluir (HTML:283–297) | não existe | FALTA | |
| Cartão de mensagem agendada | borda tracejada de 1.5px `--accent`, faixa `--accent-soft`, pergunta em `--warn-soft` com "Cancelar envio" `--warn` (HTML:328–347) | só a lista no diálogo "Convites e agendamentos" (`AcoesAtendimento.tsx:328–396`) | FALTA | |
| Fundo pontilhado | ver §2 | — | FALTA | |

### 3.5 Cartão "Aria sugere · aguardando aprovação" (HTML:298–326)

| Elemento | Protótipo | Atual (`PainelAria.tsx`) | Status | O que fazer |
|---|---|---|---|---|
| Posição | Na thread, alinhado à direita, `width:min(520px,80%)` | No painel lateral, bloco "Aria" (`InboxNovo.tsx:294`) | DIVERGE | Levar para a thread. |
| Moldura | raio 14, `--surface`, borda **`--warn`** pendente / `--line` decidido, sombra `--shadow` | `rounded-md border border-border-soft p-2` (l.75) | DIVERGE | Sem sombra (DS) ou exceção na trava. |
| Faixa do topo | `--ai-soft`, ✦ + "Aria sugere · aguardando aprovação" 12/600 `--ai` + hora mono | só o título da ação ("Responder", "Mover de etapa") `font-medium` | DIVERGE | |
| Corpo | título 14.5/600; motivo 12.5 `--mute`; mensagem proposta em caixa `--b-ia` raio 10; lista de ações com ícone 13 ("Enviar a mensagem acima", "Mover para Proposta", "Criar tarefa … Editar tarefa") | `resumo` (texto do payload ou justificativa) + "Expira às 21:00"; **uma sugestão por ação** (2 cartões para a mesma intenção em `atual-*-desktop.png`) | DIVERGE | Agrupar as ações do mesmo turno (`TurnoAgenteIA`). |
| Aviso | ⚠ 12px `--warn` "Isso será enviado agora no WhatsApp e não poderá ser desfeito." | não há | FALTA | |
| Botões | "✓ Aprovar e enviar" verde flex-1 h 36 raio 9; "Editar" contorno; "× Rejeitar" contorno com texto `--danger` | `Botao sm` "Aprovar" verde + "Rejeitar" **sólido vermelho** (`variante="perigo"`, l.80–81) | DIVERGE | Rejeitar como secundário com texto de perigo; Editar. |
| Decidido | linha "✓ Aprovado por você · 10:42" verde ou "Rejeitado" cinza | o cartão some; o feedback é texto | DIVERGE | |

### 3.6 Rodapé e compositor

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Rodapé travado (IA conduz) | barra `--ai-soft` raio 12 min-h 48: ✦ + "Aria pausou e aguarda sua aprovação acima." + "Nota interna" (contorno, `--surface`) + "Assumir para responder" (verde) (HTML:408–415) | compositor normal (quem tem envio digita mesmo com a IA conduzindo); sem envio: faixa de texto "Você não pode enviar nesta conversa." (`Compositor.tsx:215–220`) | FALTA | A regra de travar é da Parte 2; o desenho, desta. |
| Abas Responder / Nota | pílulas 26px: Responder `--accent-soft`/`--accent`; Nota `--warn-soft`/`--warn` com cadeado; dica "/ respostas rápidas · @ mencionar" `--faint` (HTML:418–423) | não há abas: `ConversaAberta` passa sempre `modo="responder"` (`ConversaAberta.tsx:316`); nota só pelo diálogo | FALTA | |
| Botões à esquerda | Anexar, Agendar, Nova tarefa: 40×44 raio 10 (círculo no render), ícones 18–19 `--mute` (HTML:425–427) | Anexar e Emoji `rounded-full p-2` ícone 20 (`Compositor.tsx:353, 374`) | DIVERGE | |
| Campo | textarea 44px → 140px, raio 12, borda `--line`, fundo `--elev`; em nota: borda e fundo `--warn`/`--warn-soft` (HTML:428, 1108–1109) | `CampoTexto` min-h 40, raio 9, `bg-surface` (`Compositor.tsx:387`); o plano da Fase 0 pedia `bg-composer rounded-[28px] min-h-[52px]` (00-fase-design-system.md §O que muda) | DIVERGE (de ambos) | |
| Enviar | 44×44 círculo `--accent` com avião (nota: `--warn`) (HTML:429) | microfone com o campo vazio; `Botao` pílula "Enviar" com ícone e texto (`Compositor.tsx:389–401`) | DIVERGE | |
| Fundo do rodapé | `--surface` + `border-top` | `bg-composer` (#242626 no escuro) + `border-t` | DIVERGE escuro | |

### 3.7 Painel do contato

| Elemento | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Cabeçalho | Avatar **132px** (44px/500), nome 20/500, subtítulo 14 `--mute` "Pessoa física · Inglês Intensivo B1", lápis 34px no canto (HTML:473–481) | "Mariana Costa" 14/500, telefone E.164 cru "+5511984213307", "Central da escola · Comercial" (`InboxNovo.tsx:286–290`) | DIVERGE | |
| Tags | pílulas 26px raio 13 `--elev`, ✦ nas da IA, "+ tag" tracejado (HTML:482–487) | não existem | FALTA | |
| Abas | Detalhes / Oportunidades / Insights / Atividade, 38px, sublinhado 2px `--accent`, contagem mono em `--ai-soft` (HTML:490–494, 1114) | sem abas: blocos empilhados (PainelSetor, Aria, Cadastro, Cobrança, Opt-out) separados por `border-t` | FALTA | O plano adia Insights e Aria para a Fase 5 (03-fase-inbox.md Task 32). |
| Oportunidade atual | botão-cartão raio 10 `--elev` com borda, maleta verde, "Oportunidade atual" 11.5 + "Produto · R$/mês · Etapa" 13/500, chevron (HTML:497) | `dl` "Oportunidade / Etapa / Valor" em linhas `justify-between`, link sublinhado (`PainelSetor.tsx:18–21`) | DIVERGE | |
| Lista de campos | linhas min-h 52: ícone 18 `--mute` em coluna de 20, valor 14.5 em cima e rótulo 12.5 `--mute` embaixo, ✦ quando a IA preencheu (HTML:512–522) | `dt`/`dd` lado a lado; `dt` usa **`text-muted-foreground` (classe inexistente)** → rótulo na cor primária (`PainelSetor.tsx:10, 15, 21`) | DIVERGE + **DEFEITO** | `text-gray-600`. |
| Seção Perfil | título 12/500 `--accent` "Perfil"/"Empresa" + mesma lista (HTML:525–538) | não existe | FALTA | |
| Ações do painel | lista de botões de texto 44px com ícone (Criar tarefa, Adicionar nota, Assumir, "Marcar como perdido" vermelho) (HTML:585–590) | botões-pílula `sm` secundários (Editar nome, Vincular, Desvincular, Registrar opt-out, Retomar régua…) (`AcoesContato.tsx:78–83`, `OptOutContato.tsx:298`) | DIVERGE | |
| B2B (contatos da oportunidade) | cartões com borda verde para quem está na conversa e "Falar com" (HTML:498–502) | não existe | FALTA | |

### 3.8 Estados vazios, carregando e erro

| Estado | Protótipo | Atual | Status | O que fazer |
|---|---|---|---|---|
| Lista vazia | texto centralizado 13px `--mute`, padding 40 20, "Nenhuma conversa neste filtro." (HTML:158) | `EstadoVazio bloco` tracejado com o mesmo texto (`ListaAtendimentos.tsx:51`; `atual-*-lista-vazia.png`) | ≈ (texto igual; moldura tracejada a mais) | Opcional. |
| Sem conversa selecionada | não previsto (o protótipo sempre abre `c1`) | "Escolha uma conversa / As mensagens aparecem aqui." + "Escolha uma conversa para ver os detalhes." (`InboxNovo.tsx:318–321, 305`) | — | Desenhar (ícone + texto no fundo pontilhado). |
| Painel vazio de abas | "Nenhuma tarefa…", "Nenhuma nota interna ainda.", "Aria ainda não alterou nada…" `--faint` 12.5 (HTML:575, 620, 648) | "Sem detalhes para este atendimento." (`PainelSetor.tsx:15`) | DIVERGE | |
| Carregando | não previsto | `EsqueletoConversas`: título + bloco de 24 + caixa com lista 320px e blocos (`components/Esqueleto.tsx:117–140`), compatível com a página atual (título + form), não com o layout do protótipo; painel "Carregando detalhes…" e compositor "Carregando…" em texto | — | Reescrever o esqueleto junto com a casca nova. |
| Erro | não previsto | `ErroArea` "Não foi possível carregar a inbox" + Aviso + "Tentar de novo" (`error.tsx`; `atual-*-desktop-erro.png`) | — | Ok (padrão do ERP). Achado lateral: um atendimento em conversa de grupo derruba a página inteira (`resumirConversa` → `comContatoIndividual` lança `ErroRegra`), embora `ListaAtendimentos` tenha um ramo de grupo. Só foi possível criar esse caso desligando a trigger `impedir_atendimento_em_grupo` (dado de demonstração). |

## 4. Diferenças visuais por papel

| Papel | Protótipo (`role.js`, HTML:866–871, 1027) | Atual (`atual-escuro-{vendedor,gerente}-desktop.png`) |
|---|---|---|
| Admin | Seletor de número visível + link "Gerenciar números em Configurações" (HTML:104); selo "ADMIN" no rail | Formulário "Abrir atendimento" com aviso "Nenhum lead na sua carteira…"; todas as conversas |
| Gerente | Seletor de número só com a flag `crm-ger-wa`; selo "GERENTE" (`prototipo-escuro-gerente-desktop.png`: sem a linha do seletor, coluna mais curta) | Mesma tela do admin, menos itens do menu global; vê o setor (4 itens) |
| Vendedor | Sem seletor de número; lista filtrada (sem as conversas de outros donos: "Todas 8"); sem "Agente de IA" no rail; selo "VEND." | Só "Lucas Andrade" (carteira e linha própria); botão "Abrir atendimento" habilitado; o resto igual |

No protótipo, papel muda **conteúdo e contagens, não o desenho**. No atual, o mesmo vale: nenhum componente muda de estilo por papel.

## 5. Travas de teste que precisam mudar

| Trava | Hoje | Por que muda |
|---|---|---|
| `src/app/design-system.test.ts` (`ESPERADO`, l.14–99) | Lista fechada de tokens e valores | Entrar com os tokens novos: `--ai-entry` (balão IA: `#EFEBFA`/`#2A2438` ou reaproveitar `--ai-bg`), `--chat-dot` (`rgba(0,0,0,.035)`/`rgba(255,255,255,.03)`), `--avatar-1..8` (hex dos 8 matizes); e, se o balão neutro escuro do protótipo for adotado, `--neutral-muted` escuro `#242626`. O teste "raios, sombras e fonte" (l.144–149) fixa `boxShadow` só com popover/dialog e `fontFamily` só com `sans`: muda se entrar `mono`. |
| `oklch` (contraste-nucleo `temasDoCss`/`razao`, falha fechada; plano 00 §Global Constraints) | Só hex e `rgb[a]` | **Não precisa mudar**: `--ai` e `--ai-soft` convertem para `#AD9FFA`/`#6A53BD` e `#2B2A37`/`#F2EFF9` (tabela §1.1). Os avatares `oklch(0.58 0.11 h)` também viram hex. Só mudaria se a decisão fosse manter `oklch` literal (aí é preciso ensinar `razao` a ler `oklch` e a regra do plano 00). |
| `src/app/contraste.test.ts` / `contraste-nucleo.ts` / `contraste-mapa.ts` | `TEXTO_SOBRE_SOLIDO` com 4 sólidos; textos ≥ 4,5 | Avatares com iniciais brancas: 5 de 8 matizes < 4,5:1. É preciso entrar `--avatar-*` como sólidos com par de texto e escurecer a luminosidade (≈ L 0,52) até passar. Se o protótipo for seguido à risca, também reprovam: `--faint` claro #959393 (2,81–3,06), `--warn` claro #B97A00 (3,37–3,59), verde #1B8755 como texto sobre #F7F5F3 (4,16) e branco sobre `--danger` escuro #FB5061 (3,27). Recomendação: **não mexer na trava**, usar os tokens A do DS. |
| `src/app/paleta.test.ts` | Sombra só `shadow-popover`/`shadow-dialog`; sem cor arbitrária | O cartão de sugestão (HTML:299), a faixa de handoff (HTML:254) e o balão (HTML:275) têm sombra: ou o desenho perde a sombra, ou a trava ganha uma `shadow-card` permitida. Além disso, **a trava não pega `bg-brand`/`text-brand`/`text-muted-foreground`** (o regex exige shade, l.16): ampliar para rejeitar nome de cor sem shade que não tenha DEFAULT no config. Esse é o furo que deixou passar os 3 defeitos. |
| `src/app/tipografia.test.ts` | Só `roboto-variable.woff2` em `src/app/fonts` (l.310–312); pesos ≤ 600 | JetBrains Mono exige outro arquivo de fonte e a licença: muda a lista fechada. O peso 700 do protótipo (contadores e badges) é barrado: levar a 600. |
| Regra de sentence case (docs/18 §Princípios, sem teste) | Proíbe `uppercase` | Os rótulos de seção do protótipo são `uppercase`: mudar o doc ou o desenho. |
| `src/app/fundo-sobre-pagina.test.ts` | `bg-surface-muted` sem borda sobre a página é proibido | A busca, os chips de etapa e o cartão da oportunidade usam `--elev` (= surface-muted) sem borda sobre `--surface`: no claro, o fundo `#F7F5F3` sobre branco é visível, mas a trava conta o uso. Entram na lista `DENTRO_DE_SUPERFICIE` ou usam `bg-gray-100`. |
| `src/app/botoes.test.ts` (inbox está em `AREAS_MIGRADAS`) | Botão só via `botaoClasses`/`<Botao>`; variante e tamanho travados em `botoes-mapa.ts` | Os botões de 9px, os ícones circulares de 36px e a pílula "Responder/Nota" do protótipo exigem variantes novas no `Botao` (ex.: `icone`, `ia`, `perigoContorno`) e a atualização do `botoes-mapa.ts`. |
| Testes do inbox (`InboxNovo.test.ts`, `ListaAtendimentos.test.ts`, `AcoesAtendimento.test.ts`) | Travam textos ("Escolha uma conversa", "Prazo estourado", "Na fila", setor/número na linha, "Fixar e silenciar valem só para você") | Mudam junto com o conteúdo (decisão da Parte 2); não travam classes. |

## 6. Esforço e ordem sugerida

| # | Área | Esforço | Depende de |
|---|---|---|---|
| 0 | Correções rápidas (contador `bg-brand-solid`, ✓✓ `text-brand-700`, `text-muted-foreground` → `text-gray-600`, chevron do balão, ampliar `paleta.test.ts`) | P | — |
| 1 | Tokens novos (avatar, balão IA, pontos, mono/tabular) + travas (§5) | M | — |
| 2 | Casca: tela cheia sem título nem form, grade 372/flex/348, painel alternável, drawer 348 no tablet, vistas no celular, esqueleto | M | 1 |
| 3 | Lista: cabeçalho da coluna, busca, seletor de número, chips com ponto e contagem, cartão Aria ativa, item novo (avatar colorido, selo IA, badges, sem resposta) | G | 1, 2 |
| 4 | Thread: balões por autor (cauda, IA, nota tracejada), hora mono, separador de dia, eventos em pílula, fundo pontilhado, notas na thread | G | 1 |
| 5 | Cabeçalho (68px, 2 ações + ⋮ com `Menu`) e rodapé (barra travada, abas Responder/Nota, compositor 44px, enviar circular) | M | 2 |
| 6 | Cartão "Aria sugere" na thread (agrupar por turno, aviso, Aprovar/Editar/Rejeitar) + faixa de handoff | M | 4 |
| 7 | Painel: cabeçalho com avatar 132, tags, abas, cartão de oportunidade, lista de campos com ícone, seção Perfil | G | 1, 2 |
| 8 | Estados (vazio sem seleção, carregando, painel vazio) e conferência visual nos 2 temas × 3 tamanhos | P | 2–7 |

**Ordem:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. O passo 0 pode ir sozinho num PR pequeno.

## 7. Screenshots

Pasta: `docs/planejamento/inbox-prototipo/telas/` (seleção; o conjunto completo ficou fora do repositório)

**Protótipo (recebidas):** `prototipo-{escuro,claro}-admin-{desktop,tablet,celular}.png`, `prototipo-escuro-{vendedor,gerente}-desktop.png`.

**Protótipo (geradas nesta análise, `pw/proto-estados.mjs`), nos dois temas `{escuro,claro}`:**
- `prototipo-{tema}-admin-desktop-humano-compositor.png` (Beatriz: nota tracejada, agendada, compositor aberto);
- `-compositor-nota`;
- `-handoff-b2b` (faixa de handoff, avatar B2B quadrado, contatos B2B);
- `-modal-handoff`;
- `-menu-mais`;
- `-transferir`;
- `-filtros`;
- `-aba-oportunidades`, `-aba-insights`, `-aba-atividade`;
- `prototipo-{tema}-admin-tablet-painel.png`;
- `prototipo-{tema}-admin-celular-{lista,conversa,painel}.png`.

**Atual (geradas, `pw/atual-inbox.mjs` e `pw/atual-erro.mjs`; dados de demonstração em `inbox-analise/demo-inbox.mjs` e `demo-inbox-2.mjs`, no banco `erp_genius_run`), nos dois temas `{escuro,claro}`:**
- `atual-{tema}-admin-{desktop,tablet,celular}.png`;
- `atual-{tema}-admin-desktop-pagina-inteira.png`;
- `-desktop-handoff-b2b`, `-desktop-humano-compositor`, `-desktop-sem-selecao`, `-desktop-lista-vazia`, `-desktop-menu-mensagem`, `-desktop-transferir`, `-desktop-erro`;
- `atual-{tema}-admin-tablet-painel.png`;
- `atual-{tema}-admin-celular-{conversa,painel,lista}.png`;
- `atual-escuro-{vendedor,gerente}-desktop.png`.

Observação sobre as capturas do atual: o selo "N · Issues" no canto inferior esquerdo é o indicador do `next dev`, não faz parte da UI.
