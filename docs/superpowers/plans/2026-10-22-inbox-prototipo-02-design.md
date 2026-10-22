# Inbox E1: design da tela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** levar a página `/inbox` à anatomia visual do protótipo `Inbox.dc.html` (tela cheia, grade 372/flex/348, coluna Conversas, item, thread, cabeçalho de 68 px, rodapé, painel com abas, estados), reaproveitando a lógica, as ações e as consultas atuais e deixando os slots que a E2, a E3 e a E4 preenchem.

**Architecture:** tokens novos em `globals.css` e `tailwind.config.ts`, com as travas atualizadas no mesmo PR. A casca (`page.tsx` + `InboxNovo`) vira tela cheia com um único `<aside>` de painel cujas classes mudam por largura, como o `mobile.js` faz. A coluna, a thread, o cabeçalho, o rodapé e o painel viram componentes do contrato do índice, alimentados pelas mesmas consultas de hoje. As únicas consultas novas são de leitura: contagens dos chips, saúde dos números, tags da pessoa no painel e não lidas pessoais para o selo do menu lateral. Um harness Playwright compara app e protótipo nos 3 tamanhos e 2 temas.

**Tech Stack:** Next 16 (App Router, server actions), React 18, Prisma/PostgreSQL, Tailwind 3.4 (tokens CSS), `next/font/local`, `@tabler/icons-react`, Vitest 4 (unitário com `renderToStaticMarkup` e `src/test/tela-sem-dom.ts`; integração `*.int.test.ts`), `playwright-core` (só no harness).

**Spec:**
- Contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md` (nomes, tokens, decisões D1–D21, constraints, aceite visual, issues).
- Base desta etapa: `docs/planejamento/inbox-prototipo/analise-parte1-design.md` inteira (tokens §1, layout §2, componentes §3, travas §5, ordem §6).
- Controles e telas que cada área acomoda: `analise-parte2-botoes-funcionalidades.md` (§1 lista, §2 cabeçalho e ⋮, §3 thread, §5 rodapé, §7 painel, §10 funções que ficam) e `analise-parte3-telas-atalhos.md` (§2 T02, T03, T06, T19, T28, T29; §4 abas).
- Protótipo: `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html` (linhas citadas como `HTML:n`) e `mobile.js`.
- Plano anterior, cujos produtos esta etapa consome: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md` (E0).

## Acréscimos ao contrato

Nomes que o índice não tem e que esta etapa cria. Nada do índice é renomeado. Caminhos relativos a `src/app/(app)/inbox/`, salvo indicação.

| Onde | Acréscimo | Por quê |
|---|---|---|
| `estado-visual.ts` | `TomEstado` ganha `"atraso"` (fundo e texto de perigo) | "Prazo estourado" com 30 min ou mais fica vermelho (HTML:994, `slaColor`); `handoff` é outro significado |
| `estado-visual.ts` | `estadoVisualItem(item, agora, usuarioId?)`; o retorno ganha `seloIa: boolean` (sempre `false` na E1, a E3 liga); cada badge vira `BadgeVisual = { tom; texto; ponto?: boolean; tracejado?: boolean; icone?: "relogio" \| "sem-nome" }` | "Com você" depende do usuário; slot do selo da IA |
| `estado-visual.ts` | `estadoVisualCabecalho(item, usuarioId): { status: string; estado: { tom: TomEstado; texto: string }; subtitulo: string }`, `CLASSES_TOM`, `PONTO_TOM`, `TEXTO_TOM`, `tempoDeEspera(min: number): string` | Subtítulo do cabeçalho e cores por tom num lugar só |
| `BadgeEstado.tsx` | props `ponto?: boolean` (padrão `true`), `tracejado?: boolean`, `icone?: ReactNode` | Etapa/setor sem ponto; "Na fila" e "Sem nome" tracejados (HTML:153) |
| `src/components/Avatar.tsx` | `tamanho` aceita `44` e `132`; `tomDoAvatar(chave: string): number` (FNV-1a, 1–8); `iniciais` devolve `""` sem letra | Lista 44, painel 132; "#" para número |
| `ItemConversa.tsx` | props `usuarioId?: string`, `fuso: string \| null` | Estado "Com você" e hora no fuso pessoal |
| `ListaAtendimentos.tsx` | prop `usuarioId?: string` | Repassa ao item |
| `ColunaConversas.tsx` | props `contagens?: ContagensChipsInbox`, `fuso: string \| null`, `usuarioId: string`, `podeGerenciarNumeros: boolean`, `sino?: ReactNode`, `novaConversa?: ReactNode` | Chips com total, link de Configurações (só admin), sino que sai do título da página, conteúdo do popover de nova conversa |
| `ChipsFiltro.tsx` | prop `filtros: FiltrosInbox`; `chipsDaColuna(c?: ContagensChipsInbox): ChipFiltroInbox[]` | O chip escreve na URL mantendo os outros filtros |
| `filtros-url.ts` (novo) | `paramsDaUrl(f)` (movido de `PainelFiltros.tsx:91-101`), `filtrosDoChip(id, f)`, `chipAtivo(f)`, `hrefDosFiltros(caminho, f)` | `PainelFiltros` some |
| `src/server/inbox/filtros.ts` | `type IdChipInbox = "todas" \| "minhas" \| "naoLidas" \| "prazo" \| "fila"`, `type ContagensChipsInbox = Record<IdChipInbox, number>` | Contrato servidor ↔ chips |
| `src/server/inbox/consultas-pagina.ts` | `contarChipsInbox(u, f): Promise<ContagensChipsInbox>` | Contagem dos chips |
| `src/server/inbox/nao-lidas.ts` (novo) | `condicaoNaoLidaPessoal(usuarioId)` (movida de `consultas-pagina.ts:40-53`), `contarConversasNaoLidas(u): Promise<number>` | Selo do menu e chip "Não lidas" com a mesma regra |
| `GET /api/inbox/atendimentos` | `?contagens=1` devolve também `contagens` | Recontagem a cada aviso do SSE |
| `GET /api/inbox/nao-lidas` (novo) | `{ total: number }` | Selo do menu lateral |
| `InboxNovo.tsx` | `paramsDosFiltros(f, cursor?, o?: { contagens?: boolean })`; props `contagens?`, `opcoesNovaConversa?: OpcoesAtendimento`, `sino?: ReactNode`, `abrirPainelPadrao?` (já no índice); `classesDoPainel(aberto, vista)`, `proximoEstadoPainel(aberto, largura)` | Casca e painel alternável |
| `src/server/inbox/opcoes-filtro.ts` | `numeros[]` ganha `saude: SaudeNumero`; `type SaudeNumero = "conectado" \| "instavel" \| "desconectado"`; `saudeDoNumero(n)` | Ponto colorido e "Instável" no seletor (HTML:103) |
| `SeletorNumero.tsx`, `PopoverFiltros.tsx`, `PopoverColuna.tsx` (novos) | ver Task 8 | Popovers da coluna (HTML:48-106) |
| `src/components/BotaoIcone.tsx` (novo) | `BotaoIcone(props: { rotulo: string; ativo?: boolean; tamanho?: 34 \| 36 \| 44 } & ButtonHTMLAttributes)` | Botões só de ícone, círculo (`mobile.js:13`) |
| `src/components/Botao.tsx` | variante `"neutro"` | "Transferir" com texto `--ink` e borda `--line` (HTML:174) |
| `src/components/Menu.tsx` | `ItemMenu.dica?: string`, `ItemMenu.divisorDepois?: boolean`; props `densidade?: "padrao" \| "compacta"`, `classeGatilho?: string`, `abertoInicial?: boolean`, `folhaNoCelular?: boolean` | Menu ⋮ de 290 px com dica e divisórias (HTML:238-250) |
| `CabecalhoConversa.tsx` | `type AtendimentoAberto`; props `usuarioId: string`, `painelAuto: boolean`, `buscaAberta: boolean`, `aoVoltar(): void` | Estado automático do painel (≥ 1200) e busca |
| `AcoesAtendimento.tsx` | `useAcoesAtendimento(p): AcoesCabecalho`, `itensDoMenuConversa(...)`, tipos `AcoesCabecalho`, `AcaoConversa`, `ItemMenuConversa` | As ações atuais redistribuídas |
| `busca-conversa.ts`, `BuscaConversa.tsx` (novos) | `normalizarBusca`, `encontrarMensagens`, `BuscaConversa(props)` | D19: busca na conversa |
| `src/components/conversa/itens-thread.ts` (E0) | `ItemThreadVisual`, `decorarThread(itens, o)`, `autorDoItem(i)`, `rotuloDia(iso, fuso, agora)`, `notaComoMensagem(n)` | Separador de dia, sequência e eventos sobre o `itensDaThread` da E0 |
| `src/components/conversa/BalaoMensagem.tsx` | `type AutorBalao` (exportado); props `emSequencia?: boolean`, `destacada?: boolean`, `nota?: NotaInternaThread` | Cauda, busca, rótulo da nota (E0) |
| `src/components/conversa/Compositor.tsx` | prop `aoAgendar?: () => void` | Botão de relógio do rodapé (HTML:426) |
| `RodapeConversa.tsx` | props completas na Task 12 | O índice só fixou `modo` e `abaInicial` |
| `PainelContato.tsx` | `ContatoPainel`, `TagPainel`, `AbaPainel`, `AbasPainel`, `ABAS_ENTREGUES`, `abasDoPainel(finalidade)`; props `children`, `aoFechar?` | Casca do painel |
| `LinhaCampo.tsx` (novo) | `LinhaCampo(props: { icone: ReactNode; valor: ReactNode; rotulo: string; ia?: boolean })` | Linha de campo com ícone (HTML:512-522); a E2 reusa |
| `src/server/inbox/paineis.ts` | `PainelSetor.tags?: TagPainel[]`; `tagsDaPessoa(pessoaId)` | Tags só leitura no painel |
| `src/components/Esqueleto.tsx` | `EsqueletoThread`, `EsqueletoPainel`; `EsqueletoConversas` reescrito | Estados de carregando |
| `src/components/SeloNaoLidasInbox.tsx` (novo), `src/lib/eventos-inbox.ts` (novo) | `useNaoLidasInbox(inicial)`, `recontarNaoLidasInbox()`; `assinarEventosCompartilhados(aoAviso, aoConectado, criar?)` | Selo pessoal e uma conexão SSE só por aba |
| `globals.css` | classe `.fundo-conversa` | Fundo pontilhado (HTML:162) |
| `scripts/visual/` | `demo-inbox.ts` (`exigirBancoDescartavel`, `criarDemoInbox`), `nucleo-captura.mjs` + `.d.mts`, `capturar-inbox.mjs` | Harness |

## Global Constraints

Valem todas as Global Constraints do índice. Além delas, só para a E1:

- **Migration:** nenhuma (índice, faixa E1).
- **Tokens** (valores literais; o escuro herda do claro o que não redefine):

| Token | Claro | Escuro | Origem |
|---|---|---|---|
| `--avatar-1` … `--avatar-8` | `#007c9b`, `#a5524d`, `#0f825e`, `#6e62aa`, `#93640c`, `#985383`, `#677823`, `#008188` | iguais | `oklch(0.54 0.11 h)` com h = 220, 25, 165, 290, 75, 340, 120, 200 (HTML:753). L 0,58 do protótipo reprova 5 de 8 com branco (parte 1 §5); com L 0,54 o pior é 4,67:1 |
| `--bubble-ia` | `#efebfa` | `#2b2a37` | índice |
| `--bubble-note` | `#fff7e5` | `#3a3020` | índice |
| `--chat-dot` | `rgba(0, 0, 0, 0.035)` | `rgba(255, 255, 255, 0.035)` | índice |
| `--font-mono` | JetBrains Mono 400–500 por `next/font/local` | — | índice |

- **Cores do protótipo → classes do DS** (parte 1 §1.1, "manter os tokens do DS"): `--surface` → `bg-surface`; `--chat` → `fundo-conversa`; `--elev` → `bg-surface-muted`; `--elev2` → `bg-gray-100`; `--line` → `border-gray-200`; `--mute` → `text-gray-600`; `--faint` → `text-gray-400`; `--accent` fundo → `bg-brand-solid text-on-brand`, texto → `text-brand-700`; `--accent-soft` → `bg-brand-bg`; `--ai` texto → `text-ai-700`, fundo de selo → `bg-ai-solid text-white`; `--ai-soft` → `bg-ai-50`; `--warn` texto → `text-amber-700`, borda → `border-amber-600`; `--warn-soft` → `bg-amber-50`; `--danger` texto → `text-red-700`, sólido → `bg-danger text-white`; `--danger-soft` → `bg-red-50`; `--b-in` → `bg-entry`; `--b-me` → `bg-entry-accent`; `--b-ia` → `bg-bubble-ia`; `--b-note` → `bg-bubble-note`.
- **Raios:** botão de texto em pílula (`<Botao>`, DS; o protótipo renderiza 9 px, mas o `mobile.js:12` pede pílula e o DS manda pílula, parte 1 §0 e §1.3); botão de ícone em círculo; busca `rounded-item` (10 px); item da lista, balão e campo do compositor `rounded-lg` (12 px); popover e menu ⋮ `rounded-dialog` (14 px); badge `rounded-[6px]`; folha do celular `rounded-t-[18px]`.
- **Pesos:** 700 do protótipo vira 600 (contador, selo de filtro). Rótulos de seção em sentence case, nunca `uppercase` (docs/18).
- **Sombras:** só `shadow-popover` e `shadow-dialog`. Balão sem sombra (HTML:275 fica de fora); painel no tablet usa `shadow-dialog` (`mobile.js:47`).
- **Mono:** horas, contagens, ⌘K e números de telefone em `font-mono tabular-nums`.
- **Textos fixos desta etapa** (copiar literalmente): `Conversas`; `Buscar conversas e contatos`; `Todos os números`; `Gerenciar números em Configurações`; `Filtrar conversas`; `Nova conversa`; `Nenhuma conversa neste filtro.`; `Prazo estourado`; `Com você`; `Na fila`; `Sem nome`; `Você está atendendo`; `Sem responsável`; `Atendimento encerrado`; `Conversa em grupo`; `Hoje`; `Ontem`; `Você`; `Aria · IA`; `Nota interna · só equipe` e `Nota da oportunidade · só equipe` (E0); `Responder`; `Nota interna`; `/ respostas rápidas`; `Escreva uma mensagem`; `Painel do contato`; `Mais ações da conversa`; `Buscar na conversa`; `Detalhes`; `Escolha uma conversa`; `As mensagens aparecem aqui.`; `Não foi possível carregar os detalhes.`; `Não foi possível carregar as mensagens.`.
- **Decisões aplicadas pelo padrão do índice:** D3 (compositor livre; a variante travada fica pronta e desligada), D7 (status automático, sem segmentado no ⋮), D13 (abas comerciais só na finalidade comercial; regra 5 do telefone), D15 (Bloquear segue o doc 03: desabilitado até o motor), D16 (não lida pessoal), D17 (seletor de número para todos os papéis do Inbox), D19 (busca na conversa entra; mesclar, exportar e seguir ficam fora), D20 (tag sem autor = ✦).
- **Exceção autorizada ao escopo:** a Task 6 mexe no selo do item Inbox do menu lateral (pedido do coordenador, a partir do item "Fora da E0" do plano 01). Nada mais do menu lateral muda.
- **Quadro:** a primeira task executada cria em `docs/planejamento/quadro-entregas.md` a seção `### Inbox E1: design da tela — <data>`; cada task acrescenta ali arquivos, testes e resultado dos comandos.
- **Commits:** onde aparece `<trailer de co-autoria do projeto>`, vai o trailer que o índice exige.

## Review Focus

1. **Nome sem letra ou com emoji** (`+55 11 98765-4321`, `😀`, `Ana 😀 Costa`): o avatar mostra `#` ou as iniciais das palavras com letra, nunca meio par de surrogate, e o item ganha "Sem nome" só quando não há letra. Teste: `iniciais ignora emoji e número` (Task 4) e `sem nome só quando não há letra` (Task 4).
2. **Conversa em grupo** em todas as áreas novas: sem badge de estado, sem "Prazo estourado", ícone de grupo no avatar, cabeçalho "Conversa em grupo" sem Assumir nem Transferir, painel sem opt-out. Testes: `grupo não tem badge` (Task 4), `grupo: sem ações de atendimento no cabeçalho` (Task 10), `grupo: painel sem opt-out` (Task 13).
3. **Virada do dia no fuso pessoal:** mensagem às 02:30Z é "ontem" em São Paulo e pode ser "hoje" em UTC. O separador usa o fuso de exibição. Teste: `rotuloDia usa o fuso de exibição` (Task 9).
4. **Contagens com filtros combinados:** com setor, número, status ou busca na URL, cada chip conta dentro deles; com `resp=<id de pessoa>`, nenhum chip fica ativo e "Todas" ignora o `resp`. Testes: `contagens respeitam setor e busca e ignoram o próprio chip` (Task 5) e `chipAtivo com responsável de outra pessoa é nulo` (Task 8).
5. **Busca na conversa com acento e caixa** (`matricula` acha `Matrícula`) e mensagem apagada ou sem corpo (não casa, não quebra). Teste: `encontrarMensagens ignora acento, caixa e apagadas` (Task 11).

---

## Mapa de arquivos

| Arquivo | Task | Responsabilidade |
|---|---|---|
| `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/fonts/` | 1 | Tokens, `fundo-conversa`, fonte mono |
| `src/app/design-system.test.ts`, `contraste-mapa.ts`, `contraste.test.ts`, `tipografia.test.ts` | 1 | Travas |
| `scripts/visual/*`, `src/test/visual-inbox.test.ts` | 2 | Harness |
| `page.tsx`, `InboxNovo.tsx`, `ConversaAberta.tsx` | 3 | Casca, grade, painel alternável, vistas |
| `src/components/Avatar.tsx`, `BadgeEstado.tsx`, `estado-visual.ts` | 4 | Primitivos do item |
| `src/server/inbox/consultas-pagina.ts`, `filtros.ts`, `opcoes-filtro.ts`, `src/app/api/inbox/atendimentos/route.ts` | 5 | Contagens e saúde dos números |
| `src/server/inbox/nao-lidas.ts`, `src/app/api/inbox/nao-lidas/route.ts`, `src/lib/eventos-inbox.ts`, `src/components/SeloNaoLidasInbox.tsx`, `src/components/Sidebar.tsx`, `BarraMobile.tsx`, `src/app/(app)/layout.tsx` | 6 | Selo de não lidas do menu |
| `ItemConversa.tsx`, `ListaAtendimentos.tsx` | 7 | Item da lista |
| `ColunaConversas.tsx`, `ChipsFiltro.tsx`, `SeletorNumero.tsx`, `PopoverFiltros.tsx`, `PopoverColuna.tsx`, `filtros-url.ts` | 8 | Coluna |
| `src/components/conversa/BalaoMensagem.tsx`, `EventoSistema.tsx`, `SeparadorDia.tsx`, `itens-thread.ts` | 9 | Thread |
| `CabecalhoConversa.tsx`, `MenuConversa.tsx`, `AcoesAtendimento.tsx`, `src/components/Menu.tsx`, `BotaoIcone.tsx`, `Botao.tsx` | 10 | Cabeçalho e ⋮ |
| `busca-conversa.ts`, `BuscaConversa.tsx` | 11 | Busca na conversa |
| `RodapeConversa.tsx`, `src/components/conversa/Compositor.tsx` | 12 | Rodapé |
| `PainelContato.tsx`, `LinhaCampo.tsx`, `src/server/inbox/paineis.ts` | 13 | Painel |
| `src/components/Esqueleto.tsx`, `loading.tsx`, `InboxNovo.tsx`, `ConversaAberta.tsx` | 14 | Estados |
| travas e componentes mortos | 15 | Fecho |

---

<a id="task-1"></a>
### Task 1: Tokens, fonte mono e travas

**Files:**
- Modify: `src/app/globals.css:10-89` (`:root`), `:91-143` (`.dark`), fim do arquivo (`@layer utilities`)
- Modify: `tailwind.config.ts:10-87` (cores), `:101-103` (fontes)
- Modify: `src/app/layout.tsx:6-10, 26`
- Create (pelo integrador, ver Step 0): `src/app/fonts/jetbrains-mono-latin-wght.woff2`, `src/app/fonts/LICENSE-JetBrainsMono.txt`
- Modify: `src/app/contraste-mapa.ts:112-117`
- Modify: `docs/18-design-system.md` (§Tokens e §Tipografia: os tokens e a fonte mono, com o motivo do L 0,54)
- Test: `src/app/design-system.test.ts:14-99, 110-112, 129-149`, `src/app/contraste.test.ts`, `src/app/tipografia.test.ts:23-25`

**Interfaces:**
- Consumes: —
- Produces: classes `bg-avatar-1` … `bg-avatar-8`, `bg-bubble-ia`, `bg-bubble-note`, `font-mono`, `fundo-conversa`. Todas as tasks seguintes usam só estas e as do DS.

- [ ] **Step 0: Integrador entrega a fonte**

Agentes não baixam pacotes. O integrador copia `jetbrains-mono-latin-wght-normal.woff2` de `@fontsource-variable/jetbrains-mono` (OFL 1.1) para `src/app/fonts/jetbrains-mono-latin-wght.woff2`, a licença para `src/app/fonts/LICENSE-JetBrainsMono.txt`, e informa o `sha256sum` do woff2. O executor cola o hash em `HASH_JETBRAINS` no Step 1.

- [ ] **Step 1: Escrever os testes que falham**

`design-system.test.ts`:
- em `ESPERADO.claro`, acrescentar `"--avatar-1": "#007c9b"`, `"--avatar-2": "#a5524d"`, `"--avatar-3": "#0f825e"`, `"--avatar-4": "#6e62aa"`, `"--avatar-5": "#93640c"`, `"--avatar-6": "#985383"`, `"--avatar-7": "#677823"`, `"--avatar-8": "#008188"`, `"--bubble-ia": "#efebfa"`, `"--bubble-note": "#fff7e5"`, `"--chat-dot": "rgba(0, 0, 0, 0.035)"`;
- em `ESPERADO.escuro`, os mesmos 8 avatares, `"--bubble-ia": "#2b2a37"`, `"--bubble-note": "#3a3020"`, `"--chat-dot": "rgba(255, 255, 255, 0.035)"`.

```ts
it("texto sobre cada sólido ≥ 4,5:1 com o par do mapa", () => {
  const avatares = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`--avatar-${n}`, "white"]));
  expect(TEXTO_SOBRE_SOLIDO).toEqual({ "--brand-solid": "--on-brand-solid", "--success-solid": "--on-brand-solid", "--danger-solid": "white", "--ai-solid": "white", ...avatares });
  expect(reprovadosSolidos()).toEqual([]);
});
it("autoteste: o tom de avatar do protótipo (L 0,58) reprova com branco", () => {
  const css = CSS.replace("--avatar-8: #008188", "--avatar-8: #008d94");
  expect(css).not.toBe(CSS);
  expect(reprovadosSolidos(css)).toEqual(expect.arrayContaining([expect.stringContaining("white/--avatar-8")]));
});
it("tailwind mapeia as cores novas", () => {
  const c = config.theme!.extend!.colors as Record<string, unknown>;
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(c[`avatar-${n}`]).toBe(`var(--avatar-${n})`);
  expect(c["bubble-ia"]).toBe("var(--bubble-ia)");
  expect(c["bubble-note"]).toBe("var(--bubble-note)");
  // + as asserções que já existem neste it
});
it("raios, sombras e fonte do design system", () => {
  const ext = config.theme!.extend!;
  expect(ext.fontFamily).toEqual({
    sans: ["var(--font-sans)", "Segoe UI", "Roboto", "system-ui", "sans-serif"],
    mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  });
  // borderRadius e boxShadow como hoje
});
it("fundo pontilhado da conversa: pontos de 1 px a cada 18 px sobre o fundo da página", () => {
  const corpo = CSS.match(/\.fundo-conversa\s*\{([^}]*)\}/)?.[1].replace(/\s+/g, " ") ?? "";
  expect(corpo).toContain("background-color: var(--bg-page)");
  expect(corpo).toContain("background-image: radial-gradient(var(--chat-dot) 1px, transparent 1px)");
  expect(corpo).toContain("background-size: 18px 18px");
});
```

`contraste.test.ts` (novo `it` no `describe` de tokens):

```ts
it("balões e autores da thread ≥ 4,5:1 nos dois temas", () => {
  expect(reprovados([
    ...paresTexto("--text-primary", ["--bubble-ia", "--bubble-note", "--entry", "--entry-accent"], 4.5),
    ...paresTexto("--text-secondary", ["--bubble-ia", "--bubble-note", "--entry", "--entry-accent"], 4.5),
    ...paresTexto("--ai-text", ["--bubble-ia"], 4.5),
    ...paresTexto("--warning-text", ["--bubble-note"], 4.5),
    ...paresTexto("--brand-strong", ["--entry-accent"], 4.5),
  ])).toEqual([]);
});
```

`--brand-text` sobre `--entry-accent` no escuro dá 4,09:1, por isso o autor "Você" usa `--brand-strong` (`text-brand-800`).

`tipografia.test.ts`:

```ts
const HASH_JETBRAINS = "<sha256 informado pelo integrador>";
it("src/app/fonts tem a Roboto, a JetBrains Mono e as licenças", () => {
  expect(readdirSync("src/app/fonts").sort()).toEqual(["LICENSE-JetBrainsMono.txt", "LICENSE-Roboto.txt", "jetbrains-mono-latin-wght.woff2", "roboto-variable.woff2"]);
});
it("layout registra JetBrains Mono 400–500 como --font-mono", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf-8");
  expect(layout).toMatch(/jetbrains-mono-latin-wght\.woff2/);
  expect(layout).toMatch(/weight:\s*"400 500"/);
  expect(layout).toMatch(/variable:\s*"--font-mono"/);
  expect(layout).toMatch(/className=\{`\$\{roboto\.variable\} \$\{mono\.variable\}`\}/);
});
it("hash da fonte mono confere", () => {
  expect(createHash("sha256").update(readFileSync("src/app/fonts/jetbrains-mono-latin-wght.woff2")).digest("hex")).toBe(HASH_JETBRAINS);
});
```

O teste antigo "src/app/fonts só tem a Roboto e a licença" é substituído pelo primeiro acima.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts`
Expected: FAIL (tokens ausentes, `mono` ausente, fonte não registrada).

- [ ] **Step 3: Implementar**

- `globals.css`: os tokens da tabela das Global Constraints em `:root` (avatares, `--bubble-*`, `--chat-dot`) e em `.dark` (só `--bubble-ia`, `--bubble-note`, `--chat-dot`), cada um com um comentário curto de origem, no formato dos vizinhos (`rgba(0, 0, 0, 0.035)`, com espaços). No fim, `@layer utilities { .fundo-conversa { background-color: var(--bg-page); background-image: radial-gradient(var(--chat-dot) 1px, transparent 1px); background-size: 18px 18px; } }`.
- `tailwind.config.ts`: chaves planas `"avatar-1": "var(--avatar-1)"` … `"avatar-8"`, `"bubble-ia"`, `"bubble-note"`; `fontFamily.mono` como no teste.
- `contraste-mapa.ts`: os 8 pares `"--avatar-n": "white"` em `TEXTO_SOBRE_SOLIDO`, com o comentário "iniciais brancas sobre a cor do avatar (parte 1 §5)".
- `layout.tsx`: `const mono = localFont({ src: [{ path: "./fonts/jetbrains-mono-latin-wght.woff2", weight: "400 500", style: "normal" }], variable: "--font-mono", display: "swap" })` e o `className` do `<html>` com as duas variáveis.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts src/app/paleta.test.ts src/app/contraste-elementos.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Sem tela nova. Conferir no DevTools, em `/inbox` nos dois temas, que `getComputedStyle(document.documentElement).getPropertyValue("--avatar-4")` é `#6e62aa` e que `document.fonts` tem a família da mono carregada. Anotar no PR.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/app/layout.tsx src/app/fonts src/app/contraste-mapa.ts src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts docs/18-design-system.md docs/planejamento/quadro-entregas.md
git commit -m "feat(design): tokens do inbox (avatar, balões, pontos) e fonte mono" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-2"></a>
### Task 2: Harness de comparação visual

Base: os scripts que funcionaram na análise (`demo-inbox.mjs`, `demo-inbox-2.mjs`, `pw/proto-inbox.mjs`, `pw/proto-estados.mjs`, `pw/atual-inbox.mjs`, no scratchpad da análise). O harness passa a viver no repositório, sem caminho absoluto e sem banco fora da lista fechada.

**Files:**
- Create: `scripts/visual/demo-inbox.ts`
- Create: `scripts/visual/nucleo-captura.mjs`, `scripts/visual/nucleo-captura.d.mts`
- Create: `scripts/visual/capturar-inbox.mjs`
- Create: `scripts/visual/README.md`
- Test: `src/test/visual-inbox.test.ts` (novo)
- `package.json` / `package-lock.json`: **só o integrador** (Step 0)

**Interfaces:**
- Consumes: `resolverBancoTeste()` (`scripts/test-profile.mjs:14`); o seed (`prisma/seed.ts`, usuários `admin@genius.com`, `joao@genius.com`, `mariana@genius.com`, senha `genius123`).
- Produces:
  - `exigirBancoDescartavel(url: string): void` e `criarDemoInbox(prisma: PrismaClient): Promise<IdsDemo>`, com `type IdsDemo = Record<"mariana" | "ventura" | "beatriz" | "lucas" | "thiago" | "semNome" | "fernanda", string>`; grava `tmp/visual/demo-ids.json`;
  - `TAMANHOS = { desktop: [1440, 900], tablet: [1024, 768], celular: [390, 844] }`, `TEMAS = ["escuro", "claro"]`, `ESTADOS: Record<string, { tamanhos: ("desktop" | "tablet" | "celular")[]; prototipo: boolean; referencia?: string }>`, `nomeDaCaptura(alvo, tema, tamanho, estado): string`, `caminhoNoNpm(url: string, nodeModules: string): string`, `tipoDoArquivo(caminho: string): string`, `combinacoes(o: { alvos: ("app" | "prototipo")[]; estados: string[] }): { alvo; tema; tamanho; estado }[]`;
  - CLI: `node scripts/visual/capturar-inbox.mjs --alvo app|prototipo|ambos --estado <nome>|todos [--base http://127.0.0.1:3017]`, saída em `tmp/visual/` (ignorado por `/tmp/` no `.gitignore`).
  - As tasks 3–15 acrescentam estados a `ESTADOS` e passos a `capturar-inbox.mjs`; a E2–E4 fazem o mesmo.

- [ ] **Step 0: Integrador acrescenta as devDependencies**

Versões exatas (a trava `src/test/dependencias.ts` compara manifesto, lock e instalado): `"playwright-core": "1.56.1"` (casa com o Chromium `chromium-1194` em `/opt/pw-browsers`), `"@babel/standalone": "7.29.0"` e `"lucide-static": "0.460.0"` (servem o `unpkg` do protótipo). `react` e `react-dom` 18.3.1, com `umd/`, já estão no `node_modules`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/test/visual-inbox.test.ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESTADOS, TAMANHOS, TEMAS, caminhoNoNpm, combinacoes, nomeDaCaptura, tipoDoArquivo } from "../../scripts/visual/nucleo-captura.mjs";
import { exigirBancoDescartavel } from "../../scripts/visual/demo-inbox";

describe("harness visual do Inbox", () => {
  it("tamanhos e temas do aceite visual do índice", () => {
    expect(TAMANHOS).toEqual({ desktop: [1440, 900], tablet: [1024, 768], celular: [390, 844] });
    expect(TEMAS).toEqual(["escuro", "claro"]);
  });
  it("nome da captura", () => {
    expect(nomeDaCaptura("app", "claro", "desktop", "menu-mais")).toBe("app-claro-desktop-menu-mais.png");
    expect(nomeDaCaptura("prototipo", "escuro", "celular", "conversa")).toBe("prototipo-escuro-celular-conversa.png");
  });
  it("unpkg vira caminho do node_modules sem a versão", () => {
    expect(caminhoNoNpm("https://unpkg.com/react@18.3.1/umd/react.production.min.js", "/r/node_modules")).toBe("/r/node_modules/react/umd/react.production.min.js");
    expect(caminhoNoNpm("https://unpkg.com/@babel/standalone@7.29.0/babel.min.js", "/r/node_modules")).toBe("/r/node_modules/@babel/standalone/babel.min.js");
    expect(caminhoNoNpm("https://unpkg.com/lucide-static@0.460.0/font/lucide.css", "/n")).toBe("/n/lucide-static/font/lucide.css");
  });
  it("tipo do arquivo servido", () => {
    expect(tipoDoArquivo("a.css")).toBe("text/css");
    expect(tipoDoArquivo("a.js")).toBe("application/javascript");
    expect(tipoDoArquivo("a.woff2")).toBe("font/woff2");
    expect(tipoDoArquivo("a.ttf")).toBe("font/ttf");
    expect(tipoDoArquivo("a.bin")).toBe("application/octet-stream");
  });
  it("combinações: 2 temas × tamanhos do estado; estado só do app não gera protótipo", () => {
    expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["conversa"] })).toHaveLength(12);
    expect(combinacoes({ alvos: ["app"], estados: ["celular-lista"] }).map((c) => c.tamanho)).toEqual(["celular", "celular"]);
    expect(combinacoes({ alvos: ["prototipo"], estados: ["sem-selecao"] })).toEqual([]);
  });
  it("estados da E1 com referência apontam para arquivos que existem", () => {
    for (const [nome, e] of Object.entries(ESTADOS)) if (e.referencia) expect(existsSync(e.referencia), nome).toBe(true);
  });
  it("a demo só roda no banco descartável", () => {
    expect(() => exigirBancoDescartavel("postgres://postgres:teste@localhost:54329/erp_genius_test")).not.toThrow();
    expect(() => exigirBancoDescartavel("postgres://postgres:teste@127.0.0.1:54329/erp_genius_test_tester")).not.toThrow();
    expect(() => exigirBancoDescartavel("postgres://u:p@db.prod:5432/erp")).toThrow("banco descartável");
    expect(() => exigirBancoDescartavel("postgres://postgres:teste@localhost:54329/outro")).toThrow("banco descartável");
  });
});
```

Estados iniciais de `ESTADOS` (as tasks seguintes completam os passos):

| Estado | Tamanhos | Protótipo | Referência |
|---|---|---|---|
| `conversa` | os 3 | sim (padrão `c1`) | `docs/planejamento/inbox-prototipo/telas/prototipo-escuro-admin-desktop.png` |
| `sem-selecao` | desktop | não | — |
| `humano-compositor` | desktop | sim (`?c=c4`) | `…/telas/prototipo-claro-admin-desktop-humano-compositor.png` |
| `celular-lista`, `celular-painel` | celular | sim | — |
| `celular-conversa` | celular | sim | `…/telas/prototipo-claro-admin-celular-conversa.png` |
| `tablet-painel` | tablet | sim | — |

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/test/visual-inbox.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

- `demo-inbox.ts`: `exigirBancoDescartavel` aceita só host `localhost` ou `127.0.0.1`, porta `54329` e banco que começa com `erp_genius_test`; senão lança `Error("A demo do Inbox só roda no banco descartável (localhost:54329/erp_genius_test*).")`. O `main` (só quando `import.meta.url === pathToFileURL(process.argv[1]).href`) usa `resolverBancoTeste().url`, chama a guarda, cria `new PrismaClient({ datasources: { db: { url } } })` e roda `criarDemoInbox`. A demo é idempotente (sai sem fazer nada se o número `+551140028922` existe) e porta os casos de `demo-inbox.mjs` 1–7, com estes acréscimos, para a E1 ter o que mostrar:
  - Beatriz Lima: uma mensagem de ontem (`em: 26 * 60`), uma nota do atendimento (`Evento NotaInterna` no agregado `AtendimentoWhatsApp`) e uma saída `FALHOU`;
  - Mariana Costa: `Pessoa` ligada ao lead, tags `Inglês` e `Adulto` com `criadoPorId` do admin e `Noite` sem autor (✦, D20); fixada pelo admin;
  - Thiago Moreira: silenciada pelo admin (`silenciadaAte` daqui a 8 h);
  - Lucas Andrade: transferido (`atendimentoOrigemId` de um atendimento SECRETARIA encerrado da mesma conversa).
  - O caso de grupo (`demo-inbox.mjs`, caso 8) fica fora: um atendimento de grupo derruba `/inbox` hoje (parte 1 §3.8, achado lateral).
- `nucleo-captura.mjs`: funções puras do teste; `caminhoNoNpm` tira a versão com `/^(@?[^/@]+(?:\/[^/@]+)?)@[^/]+/` (mesma regex de `pw/proto-inbox.mjs`).
- `capturar-inbox.mjs`: Chromium em `process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`, `--no-sandbox --allow-file-access-from-files`, `locale: "pt-BR"`, `timezoneId: "America/Sao_Paulo"`, `deviceScaleFactor: 1`.
  - **App:** login em `/login` com `admin@genius.com` / `genius123`; tema por `localStorage.tema` (`"dark"`/`"light"`), num `addInitScript`; ids de `tmp/visual/demo-ids.json`.
  - **Protótipo:** `file://…/prototipo/Inbox.dc.html`; `ctx.route(/^https:\/\/unpkg\.com\//)` serve de `node_modules` via `caminhoNoNpm`; Google Fonts responde CSS vazio; `localStorage` com `crm-theme` (`escuro`/`claro`), `crm-role=admin` e `crm-push-asked=1`; espera 4 s depois do `load`.
  - `PASSOS_APP[estado](page, ids)` e `PASSOS_PROTOTIPO[estado](page)`: objetos de funções. Os iniciais saem de `pw/proto-estados.mjs` e `pw/atual-inbox.mjs`.
- `README.md` do harness: como subir o app de captura, como em `scripts/validacao/README.md`: `npm run build` e `next start -p 3017` com `DATABASE_URL` do perfil do worktree, `AUTH_TRUST_HOST=true`, `NEXTAUTH_URL=http://127.0.0.1:3017`, segredo só de teste e `WHATSAPP_LIVE` vazio. Também a ordem `migrate deploy` → `tsx prisma/seed.ts` → `tsx scripts/visual/demo-inbox.ts` → `capturar-inbox.mjs`, e o aviso de que as integrações truncam o banco (rodar a demo de novo depois delas).

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/test/visual-inbox.test.ts src/test/dependencias.test.ts` e `npm run lint`
Expected: PASS; lint sem erro novo.

- [ ] **Step 5: Aceite visual**

Rodar `node scripts/visual/capturar-inbox.mjs --alvo ambos --estado conversa`. Expected: 12 PNGs em `tmp/visual/`. As do protótipo batem com `telas/prototipo-escuro-admin-desktop.png` (fonte de reserva à parte); as do app mostram o Inbox **atual** com os dados da demo. Anexar as duas de `desktop-escuro` ao PR.

- [ ] **Step 6: Commit**

```bash
git add scripts/visual src/test/visual-inbox.test.ts docs/planejamento/quadro-entregas.md
git commit -m "test(inbox): harness de comparação visual com o protótipo" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-3"></a>
### Task 3: Casca em tela cheia

Depois da E0 Task 7, a página é uma coluna com título, sino e `NovoAtendimento` acima do `InboxNovo` (`min-h-0 flex-1`). Agora a página renderiza só o `InboxNovo`, que ocupa a área de conteúdo inteira e anula o `p-4 md:p-8` do `main` (`src/app/(app)/layout.tsx:22`). A grade fica 372/flex/348 (HTML:38, 162, 472). O painel vira um `<aside>` só, como o `[data-m=panel]` do `mobile.js`: coluna a partir de 1100, sobreposição de 348 px com sombra entre 700 e 1099 (`mobile.js:46-47`) e vista própria abaixo de 700 (`mobile.js:32-36`).

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx:62-77` (render; `:9, :15` imports)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:27-40` (props), `:93-96` (classes de coluna), `:190-252` (painel e render)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:39, 85, 126` (`aoAbrirPainel` → `aoAlternarPainel`, botão sempre visível)
- Modify: `src/app/botoes.test.ts:81` (`"Detalhes da conversa"` → `"Painel do contato"`)
- Modify: `scripts/visual/capturar-inbox.mjs` (passos de `conversa`, `celular-*`, `tablet-painel`, `painel-fechado`)
- Test: `src/app/(app)/inbox/page.test.ts`, `src/app/(app)/inbox/InboxNovo.test.ts`, `src/app/(app)/inbox/InboxNovo.interacao.test.ts`

**Interfaces:**
- Consumes: produtos da E0 Task 7 (raiz `min-h-0 flex-1`) e Task 2 (marcação de leitura).
- Produces:
  - `PropsInboxNovo` + `abrirPainelPadrao?: boolean`, `contagens?: ContagensChipsInbox`, `opcoesNovaConversa?: OpcoesAtendimento`, `sino?: ReactNode`;
  - `classesDoPainel(aberto: boolean | null, vista: VistaInbox): string`;
  - `proximoEstadoPainel(aberto: boolean | null, largura: number): { aberto: boolean | null; vista?: VistaInbox }`;
  - `ConversaAberta` props: `aoAlternarPainel(): void`, `painelAberto: boolean`, `painelAuto: boolean` (no lugar de `aoAbrirPainel`).

O estado `painelAberto` tem três valores: `null` = automático (aberto a partir de 1200, pela CSS; HTML:879, `wide`), `true` e `false` = escolha do usuário. Cruzar 1200 px volta a `null` (HTML:881, `onR`). Com `null`, o SSR e a hidratação concordam, porque a largura decide só na CSS.

Tabela de `classesDoPainel` (o teste confere as classes-chave de cada célula):

| Largura | `aberto = null` | `true` | `false` |
|---|---|---|---|
| < 700 | `max-[699px]:flex` só com `vista === "painel"`; senão `max-[699px]:hidden` | idem | idem |
| 700–1099 | `min-[700px]:max-[1099px]:hidden` | `min-[700px]:max-[1099px]:absolute inset-y-0 right-0 z-30 shadow-dialog` | `min-[700px]:max-[1099px]:hidden` |
| 1100–1199 | `min-[1100px]:max-[1199px]:hidden` | `min-[1100px]:flex` | `min-[1100px]:hidden` |
| ≥ 1200 | `min-[1200px]:flex` | `min-[1200px]:flex` | `min-[1200px]:hidden` |

Comum: `w-full min-[700px]:w-[348px] shrink-0 min-h-0 flex-col border-gray-200 bg-surface min-[700px]:border-l`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// page.test.ts — o mock do InboxNovo passa a imprimir também `sino` (renderizado) e `nova:${opcoesNovaConversa ? "sim" : "nao"}`
it("tela cheia: sem h1 nem formulário; sino e nova conversa vão para o InboxNovo", async () => {
  mocks.preferencia.mockResolvedValue({ ok: false });
  sino.listar.mockResolvedValue([{ id: "n1", titulo: "Prazo" }]);
  const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(h).not.toContain("<h1"); expect(h).not.toContain("novo-atendimento");
  expect(h).toContain("Notificações:Prazo"); expect(h).toContain("nova:sim");
});
it("a página ocupa a área de conteúdo inteira: anula o padding do main e desconta só a barra do celular", async () => {
  mocks.preferencia.mockResolvedValue({ ok: false });
  const raiz = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) })).match(/^<div class="([^"]*)"/)![1].split(" ");
  expect(raiz).toEqual(expect.arrayContaining(["-m-4", "md:-m-8", "flex", "flex-col", "h-[calc(100dvh-3.5625rem)]", "sm:h-[calc(100dvh-3.3125rem)]", "md:h-dvh"]));
});

// InboxNovo.test.ts
it("grade 372 / flex / 348, lista de 300 (até 44vw) no tablet, sem moldura", () => {
  const h = html({ selecionado: "a1" });
  for (const c of ["min-[1100px]:w-[372px]", "min-[700px]:w-[300px]", "min-[700px]:max-w-[44vw]", "min-[700px]:w-[348px]"]) expect(h).toContain(c);
  expect(h).not.toContain("rounded-item border");
});
it("sem conversa selecionada não há painel", () => {
  expect(html({ selecionado: null })).not.toContain('aria-label="Painel do contato"');
});
it("abrirPainelPadrao=false começa fechado em qualquer largura", () => {
  expect(html({ selecionado: "a1", extra: { abrirPainelPadrao: false } })).toContain("min-[1200px]:hidden");
});

describe("classesDoPainel", () => {
  it("automático: aberto só a partir de 1200", () => {
    const c = classesDoPainel(null, "conversa");
    expect(c).toContain("min-[1200px]:flex"); expect(c).toContain("min-[1100px]:max-[1199px]:hidden");
    expect(c).toContain("min-[700px]:max-[1099px]:hidden"); expect(c).toContain("max-[699px]:hidden");
  });
  it("aberto: coluna a partir de 1100 e sobreposição com sombra no tablet", () => {
    const c = classesDoPainel(true, "conversa");
    for (const x of ["min-[1100px]:flex", "min-[700px]:max-[1099px]:absolute", "shadow-dialog"]) expect(c).toContain(x);
  });
  it("fechado esconde a partir de 700; a vista painel do celular sempre mostra", () => {
    expect(classesDoPainel(false, "conversa")).toContain("min-[1200px]:hidden");
    expect(classesDoPainel(false, "painel")).toContain("max-[699px]:flex");
  });
});
describe("proximoEstadoPainel", () => {
  it("alterna a partir do estado efetivo da largura; no celular abre a vista painel", () => {
    expect(proximoEstadoPainel(null, 1440)).toEqual({ aberto: false });
    expect(proximoEstadoPainel(null, 1150)).toEqual({ aberto: true });
    expect(proximoEstadoPainel(true, 900)).toEqual({ aberto: false });
    expect(proximoEstadoPainel(false, 1440)).toEqual({ aberto: true });
    expect(proximoEstadoPainel(null, 390)).toEqual({ aberto: null, vista: "painel" });
  });
});
```

Em `InboxNovo.interacao.test.ts`, acrescentar:

```ts
it("alternar painel pela conversa troca as classes do aside", () => {
  vi.stubGlobal("innerWidth", 1440);
  const t = tela();
  (elementos(t).find((n) => n.type === ConversaAberta)!.props as { aoAlternarPainel(): void }).aoAlternarPainel();
  expect(elementos(tela()).find((n) => n.props["aria-label"] === "Painel do contato")!.props.className).toContain("min-[1200px]:hidden");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.test.ts" "src/app/(app)/inbox/InboxNovo.interacao.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `page.tsx`: raiz `<div className="-m-4 md:-m-8 flex flex-col h-[calc(100dvh-3.5625rem)] sm:h-[calc(100dvh-3.3125rem)] md:h-dvh">`. A barra do celular tem 57 px abaixo de `sm` (`max-sm:min-h-11` + `py-1.5` + borda) e 53 px de `sm` a `md` (`min-h-10`), em `src/components/BarraMobile.tsx:32, 45`. Dentro, só `<InboxNovo … sino={<SinoNotificacoes …/>} opcoesNovaConversa={opcoes} />`. Sem `h1`, sem `NovoAtendimento` no topo.
- `InboxNovo.tsx`: raiz `relative flex min-h-0 flex-1 overflow-hidden`, mantendo `data-vista` e `data-conectado`.
  - Lista: `flex-col min-h-0 border-gray-200 bg-surface min-[700px]:border-r` + `${vista === "lista" ? "flex" : "hidden"} w-full` + `min-[700px]:flex min-[700px]:w-[300px] min-[700px]:max-w-[44vw] min-[700px]:shrink-0 min-[1100px]:w-[372px] min-[1100px]:max-w-none`.
  - Conversa: `fundo-conversa relative min-w-0 flex-col` + `min-[700px]:flex min-[700px]:flex-1` + vista.
  - Painel: `<aside aria-label="Painel do contato" className={classesDoPainel(painelAberto, vista)}>` só com conversa selecionada; o conteúdo continua o `painel` atual (`:190-211`) até a Task 13.
  - Some o `Drawer` (`:248-250`).
  - `alternarPainel()`: aplica `proximoEstadoPainel(painelAberto, window.innerWidth)`.
  - `useEffect` com `matchMedia("(min-width: 1200px)")` → `setPainelAberto(null)` no `change`.
  - Esc fecha a sobreposição (`aberto === true` e `innerWidth` < 1100).
  - Abaixo de 700, "voltar" do painel volta à vista `conversa`.
- `ConversaAberta.tsx:126`: botão `aria-label="Painel do contato"`, sempre visível, `aria-pressed={painelAberto}`. Com `painelAuto`, a classe `min-[1200px]:bg-gray-100`; com `painelAberto`, `bg-gray-100`. Ícone `IconLayoutSidebarRight`. A Task 10 troca o cabeçalho inteiro.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts src/app/paleta.test.ts src/app/responsivo.test.ts src/app/borda-rota.render.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `conversa` (os 3 tamanhos), `painel-fechado` (desktop; clique em "Painel do contato"), `tablet-painel`, `celular-lista`, `celular-conversa` e `celular-painel`, nos 2 temas, app e protótipo. Referências: `telas/prototipo-escuro-admin-desktop.png` e `telas/prototipo-claro-admin-celular-conversa.png`.

Conferir:
- larguras medidas por `getBoundingClientRect` em 1440: lista 372, painel 348;
- `document.documentElement.scrollHeight <= innerHeight`;
- no tablet, o painel sobre a conversa com sombra e sem véu;
- no celular, uma vista por vez.

O conteúdo interno ainda é o antigo; o revisor julga só a casca.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx" "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/InboxNovo.test.ts" "src/app/(app)/inbox/InboxNovo.interacao.test.ts" "src/app/(app)/inbox/ConversaAberta.tsx" src/app/botoes.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): casca em tela cheia com grade 372/348 e painel alternável" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-4"></a>
### Task 4: Avatar, BadgeEstado e estado visual

**Files:**
- Modify: `src/components/Avatar.tsx:1-21`
- Create: `src/app/(app)/inbox/BadgeEstado.tsx`, `src/app/(app)/inbox/estado-visual.ts`
- Test: `src/components/Avatar.test.ts`, `src/app/(app)/inbox/BadgeEstado.test.ts` (novo), `src/app/(app)/inbox/estado-visual.test.ts` (novo)

**Interfaces:**
- Consumes: `prazoEstourado(i, agora: number)` (E0 Task 5, `prazo-vivo.ts`); `SETOR_ATENDIMENTO_LABEL`, `STATUS_ATENDIMENTO_LABEL` (`src/lib/labels.ts:506-519`).
- Produces:
  - `Avatar(props: { nome: string | null; tamanho?: 32 | 40 | 44 | 48 | 132; quadrado?: boolean; tom?: number; selo?: "ia" })`, `iniciais(nome)`, `tomDoAvatar(chave: string): number`;
  - `type TomEstado = "ia" | "aprovacao" | "handoff" | "humano" | "sem-resposta" | "atraso" | "neutro"`;
  - `type BadgeVisual = { tom: TomEstado; texto: string; ponto?: boolean; tracejado?: boolean; icone?: "relogio" | "sem-nome" }`;
  - `estadoVisualItem(item: ItemListaInbox, agora: Date, usuarioId?: string): { badges: BadgeVisual[]; previa: string; avatarTom: number; seloIa: boolean }`;
  - `estadoVisualCabecalho(item: ItemListaInbox, usuarioId: string): { status: string; estado: { tom: TomEstado; texto: string }; subtitulo: string }`;
  - `CLASSES_TOM`, `PONTO_TOM`, `TEXTO_TOM: Record<TomEstado, string>`; `tempoDeEspera(min: number): string`;
  - `BadgeEstado(props: { tom: TomEstado; children: ReactNode; ponto?: boolean; tracejado?: boolean; icone?: ReactNode })`.

Valores do protótipo:
- avatar 44 com iniciais 14/600 brancas (HTML:138); 40 no cabeçalho (HTML:165); 132 com 44 px/500 e tracking −0,01em (HTML:476); B2B quadrado 12/11/34 px (HTML:992, 1097);
- selo 19 px, `--ai`, borda 2 px `--surface`, em −3/−3, ícone 10 (HTML:139);
- badge h 20, padding 0 7, raio 6, 11px/600, ponto 6 px, gap 5 (HTML:152); etapa sem ponto, 11px/400 (HTML:153); tracejado com borda `1px dashed --line` (HTML:153);
- `tempoDeEspera`: `waitTxt` (HTML:873); limiar de vermelho `SLA_MIN * 2 = 30` (HTML:994).

Mapas:

| Tom | `CLASSES_TOM` | `PONTO_TOM` | `TEXTO_TOM` |
|---|---|---|---|
| `ia` | `bg-ai-50 text-ai-700` | `bg-ai-700` | `text-ai-700` |
| `aprovacao`, `sem-resposta` | `bg-amber-50 text-amber-700` | `bg-amber-600` | `text-amber-700` |
| `handoff`, `atraso` | `bg-red-50 text-red-700` | `bg-red-600` | `text-red-700` |
| `humano` | `bg-brand-bg text-brand-700` | `bg-brand-solid` | `text-brand-700` |
| `neutro` | `bg-surface-muted text-gray-600` | `bg-gray-400` | `text-gray-600` |

- [ ] **Step 1: Escrever os testes que falham**

```ts
// Avatar.test.ts (o teste "cores de marca suave e tamanhos 32/40/48" continua: sem `tom` nada muda nas outras telas)
it("iniciais ignora emoji e número", () => {
  expect(iniciais("+55 11 98765-4321")).toBe("");
  expect(iniciais("😀")).toBe("");
  expect(iniciais("😀 Ana")).toBe("A");
  expect(iniciais("Ana 😀 Costa")).toBe("AC");
  expect(renderToStaticMarkup(createElement(Avatar, { nome: "+55 11 98765-4321" }))).toContain(">#<");
});
it("tom pinta com o token do avatar e iniciais brancas", () => {
  const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 3, tamanho: 44 }));
  for (const c of ["bg-avatar-3", "text-white", "h-11", "w-11", "font-semibold"]) expect(h).toContain(c);
  expect(h).not.toContain("bg-brand-bg");
});
it("132 px do painel: 44 px de texto, peso 500; quadrado com raio 34", () => {
  const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 1, tamanho: 132, quadrado: true }));
  for (const c of ["h-[132px]", "w-[132px]", "text-[44px]", "font-medium", "rounded-[34px]"]) expect(h).toContain(c);
  expect(renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tamanho: 44, quadrado: true }))).toContain("rounded-lg");
});
it("selo da IA: 19 px, sólido da IA, borda da superfície", () => {
  const h = renderToStaticMarkup(createElement(Avatar, { nome: "Ana", tom: 1, tamanho: 44, selo: "ia" }));
  for (const c of ["h-[19px]", "w-[19px]", "bg-ai-solid", "border-2", "border-surface", "-bottom-[3px]", "-right-[3px]"]) expect(h).toContain(c);
});
it("tomDoAvatar: FNV-1a estável, de 1 a 8", () => {
  expect(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"].map(tomDoAvatar)).toEqual([2, 1, 4, 3, 6, 5, 8, 7]);
  expect(tomDoAvatar("contato-a")).toBe(4);
});

// BadgeEstado.test.ts
const b = (p: object) => renderToStaticMarkup(createElement(BadgeEstado, { tom: "ia", children: "IA atendendo", ...p } as never));
it("tom, ponto e medidas do protótipo", () => {
  const h = b({});
  for (const c of ["bg-ai-50", "text-ai-700", "h-5", "px-[7px]", "rounded-[6px]", "text-[11px]", "font-semibold", "bg-current"]) expect(h).toContain(c);
});
it("sem ponto e tracejado", () => {
  expect(b({ ponto: false })).not.toContain("bg-current");
  const t = b({ tom: "neutro", tracejado: true, ponto: false });
  expect(t).toContain("border-dashed"); expect(t).toContain("border-gray-200"); expect(t).not.toContain("bg-surface-muted");
});

// estado-visual.test.ts
const agora = new Date("2026-10-22T13:00:00.000Z");
const menos = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const item = (o: Partial<ItemListaInbox> = {}): ItemListaInbox => ({ /* base de ListaAtendimentos.test.ts:108-115 */ ...o });
describe("estadoVisualItem", () => {
  it("com você, com outra pessoa (primeiro nome), na fila e encerrado", () => {
    expect(estadoVisualItem(item({ responsavelId: "u1", responsavelNome: "Ana Lima" }), agora, "u1").badges[0]).toEqual({ tom: "humano", texto: "Com você" });
    expect(estadoVisualItem(item({ responsavelId: "u2", responsavelNome: "Ana Lima" }), agora, "u1").badges[0]).toEqual({ tom: "humano", texto: "Com Ana" });
    const fila = estadoVisualItem(item({ status: "ABERTO_SEM_RESPONSAVEL", responsavelId: null }), agora, "u1").badges;
    expect(fila).toContainEqual({ tom: "neutro", texto: "Na fila", tracejado: true, ponto: false });
    expect(fila.some((x) => x.tom === "humano")).toBe(false);
    expect(estadoVisualItem(item({ status: "ENCERRADO" }), agora).badges[0]).toEqual({ tom: "neutro", texto: "Encerrado" });
  });
  it("setor no lugar da etapa (a E2 troca pela etapa no comercial)", () => {
    expect(estadoVisualItem(item({ finalidade: "FINANCEIRO" }), agora).badges).toContainEqual({ tom: "neutro", texto: "Financeiro", ponto: false });
  });
  it("prazo estourado: amarelo até 29 min, vermelho a partir de 30; texto com o tempo", () => {
    expect(estadoVisualItem(item({ prazoRespostaEm: menos(22) }), agora).badges).toContainEqual({ tom: "sem-resposta", texto: "Prazo estourado · 22 min", icone: "relogio", ponto: false });
    expect(estadoVisualItem(item({ prazoRespostaEm: menos(48) }), agora).badges).toContainEqual({ tom: "atraso", texto: "Prazo estourado · 48 min", icone: "relogio", ponto: false });
    expect(estadoVisualItem(item({ prazoRespostaEm: menos(125) }), agora).badges.at(-1)!.texto).toBe("Prazo estourado · 2 h 5 min");
    expect(estadoVisualItem(item({ prazoRespostaEm: menos(-5) }), agora).badges.some((x) => x.icone === "relogio")).toBe(false);
    expect(estadoVisualItem(item({ status: "ENCERRADO", prazoRespostaEm: menos(50) }), agora).badges.some((x) => x.icone === "relogio")).toBe(false);
  });
  it("sem nome só quando não há letra", () => {
    const sem = { tom: "neutro", texto: "Sem nome", tracejado: true, icone: "sem-nome", ponto: false };
    expect(estadoVisualItem(item({ contatoNome: "+55 11 98765-4321" }), agora).badges).toContainEqual(sem);
    expect(estadoVisualItem(item({ contatoNome: "😀" }), agora).badges).toContainEqual(sem);
    expect(estadoVisualItem(item({ contatoNome: "Ana" }), agora).badges).not.toContainEqual(sem);
  });
  it("grupo não tem badge", () => {
    expect(estadoVisualItem(item({ grupo: true, prazoRespostaEm: menos(50) }), agora).badges).toEqual([]);
  });
  it("prévia, tom do avatar pelo contato e selo desligado na E1", () => {
    const v = estadoVisualItem(item({ contatoId: "c3", preview: "Oi" }), agora);
    expect(v).toMatchObject({ previa: "Oi", avatarTom: 4, seloIa: false });
    expect(estadoVisualItem(item({ preview: null }), agora).previa).toBe("");
  });
});
describe("estadoVisualCabecalho", () => {
  it("quem atende, status e subtítulo", () => {
    expect(estadoVisualCabecalho(item({ responsavelId: "u1", status: "EM_ATENDIMENTO", finalidade: "COMERCIAL", numeroRotulo: "Central da escola" }), "u1"))
      .toEqual({ status: "Em atendimento", estado: { tom: "humano", texto: "Você está atendendo" }, subtitulo: "Comercial · Central da escola" });
    expect(estadoVisualCabecalho(item({ responsavelId: "u2", responsavelNome: "Rodrigo Alves" }), "u1").estado.texto).toBe("Rodrigo está atendendo");
    expect(estadoVisualCabecalho(item({ status: "ABERTO_SEM_RESPONSAVEL", responsavelId: null }), "u1").estado).toEqual({ tom: "neutro", texto: "Sem responsável" });
    expect(estadoVisualCabecalho(item({ status: "ENCERRADO" }), "u1").estado.texto).toBe("Atendimento encerrado");
    expect(estadoVisualCabecalho(item({ grupo: true }), "u1")).toMatchObject({ status: "Grupo", estado: { texto: "Conversa em grupo" } });
  });
});
it("tempoDeEspera", () => {
  expect([1, 59, 60, 125].map(tempoDeEspera)).toEqual(["1 min", "59 min", "1 h", "2 h 5 min"]);
  expect(tempoDeEspera(0)).toBe("1 min");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/Avatar.test.ts "src/app/(app)/inbox/BadgeEstado.test.ts" "src/app/(app)/inbox/estado-visual.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `iniciais`: palavras com ao menos uma letra (`/\p{L}/u`); de cada uma, a primeira letra (`.match(/\p{L}/u)`), da primeira e da última dessas palavras.
- `tomDoAvatar`:

```ts
let h = 0x811c9dc5;
for (let i = 0; i < chave.length; i++) { h ^= chave.charCodeAt(i); h = Math.imul(h, 0x01000193); }
return ((h >>> 0) % 8) + 1;
```

- Classes de fundo do avatar num array literal `["bg-avatar-1", …, "bg-avatar-8"]`, para o Tailwind gerar todas. Tamanhos: `44: "h-11 w-11 text-sm font-semibold"`, `132: "h-[132px] w-[132px] text-[44px] font-medium tracking-[-0.01em]"`. Raio quadrado: `44 → rounded-lg`, `132 → rounded-[34px]`, demais como hoje. Com `selo`, o `<span>` raiz ganha `relative`, e o selo é um `<span>` com `IconSparkles size={10}`.
- `estadoVisualItem`, nesta ordem de badges: estado (com ponto) → setor (`ponto: false`) → prazo → "Sem nome" → "Na fila". Grupo devolve `[]`. O prazo usa `prazoEstourado(item, agora.getTime())` e minutos `Math.max(1, floor((agora − prazo)/60000))`, com `atraso` a partir de 30.
- `BadgeEstado`: `inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[6px] px-[7px] text-[11px]`, `font-semibold` quando há ponto ou o tom não é `neutro`, e ponto `h-1.5 w-1.5 rounded-full bg-current`. Tracejado: `border border-dashed border-gray-200 text-gray-600` sem fundo.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/(app)/contatos`
Expected: PASS. Se a trava de fundo acusar `bg-surface-muted` sem borda em `estado-visual.ts`, registrar em `DENTRO_DE_SUPERFICIE` (`fundo-sobre-pagina.test.ts:22`) com `{ quantidade: 1, motivo: "badge neutro dentro da coluna bg-surface" }`.

- [ ] **Step 5: Aceite visual**

Sem tela própria; entra no aceite da Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/components/Avatar.tsx src/components/Avatar.test.ts "src/app/(app)/inbox/BadgeEstado.tsx" "src/app/(app)/inbox/BadgeEstado.test.ts" "src/app/(app)/inbox/estado-visual.ts" "src/app/(app)/inbox/estado-visual.test.ts" src/app/fundo-sobre-pagina.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): avatar por cor, badge de estado e estado visual do item" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-5"></a>
### Task 5: Contagens dos chips e saúde dos números

Os chips mostram contagem (HTML:125, L26), e o seletor mostra ponto e "Instável" (HTML:103). Duas leituras novas, sem migration.

**Files:**
- Modify: `src/server/inbox/filtros.ts` (tipos)
- Modify: `src/server/inbox/consultas-pagina.ts:55-68` (helpers), novo `contarChipsInbox` depois de `listarAtendimentosPagina` (`:86-110`)
- Modify: `src/app/api/inbox/atendimentos/route.ts:23-29`
- Modify: `src/server/inbox/opcoes-filtro.ts:7-20`
- Modify: `src/app/(app)/inbox/page.tsx` (Promise.all de `:42-52`) e `InboxNovo.tsx:43-61` (`paramsDosFiltros`, `buscarPagina`)
- Test: `src/server/inbox/consultas-pagina.int.test.ts`, `src/server/inbox/opcoes-filtro.int.test.ts`, `src/server/inbox/opcoes-filtro.test.ts` (novo), `src/app/(app)/inbox/InboxNovo.test.ts`, `src/app/(app)/inbox/page.test.ts`

**Interfaces:**
- Consumes: `escopoAtendimentos`, `condicoesDosFiltros` (`consultas-pagina.ts:56`), `condicaoNaoLidaPessoal` (`:40`; a Task 6 a move para `nao-lidas.ts`).
- Produces:
  - `type IdChipInbox = "todas" | "minhas" | "naoLidas" | "prazo" | "fila"`, `type ContagensChipsInbox = Record<IdChipInbox, number>`;
  - `contarChipsInbox(u: UsuarioSessao, f: FiltrosInbox): Promise<ContagensChipsInbox>`;
  - rota com `?contagens=1` → `{ itens, proximo, contagens }` (só sem cursor);
  - `paramsDosFiltros(f, cursor?, o?: { contagens?: boolean })`; `buscarPagina` pede `contagens=1` na primeira página, e `InboxNovo` guarda `contagens` em estado;
  - `OpcoesFiltroInbox.numeros: { id: string; rotulo: string; saude: SaudeNumero }[]`, `saudeDoNumero(n: { driver: DriverWhatsApp; sessao: SessaoNumero; ativo: boolean }): SaudeNumero`.

Regra das contagens: a base é escopo + filtros da URL **sem** `responsavel`, `naoLidas` e `prazoEstourado` (os que os chips trocam). Cada chip soma a sua condição: `todas` (nada), `minhas` (`responsavelId: u.id`), `fila` (`responsavelId: null, encerradoEm: null`), `naoLidas` (`condicaoNaoLidaPessoal`), `prazo` (a condição de `consultas-pagina.ts:64`). São 5 `count` em `Promise.all`.

Regra da saúde: `ativo = false` → `desconectado`. Driver `BAILEYS` ou `MOTOR`: `CONECTADO` → `conectado`, `AGUARDANDO_QR` ou `CAIU` → `instavel`, `DESCONECTADO` → `desconectado`. `META_CLOUD` e `SIMULADO` → `conectado` (a sessão só vale para BAILEYS, `schema.prisma:2413`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// consultas-pagina.int.test.ts
it("contagens respeitam setor e busca e ignoram o próprio chip", async () => {
  const a1 = await criarAtendimento(new Date());                                    // sem responsável
  const a2 = await criarAtendimento(new Date());
  await prisma.atendimentoWhatsApp.update({ where: { id: a2.id }, data: { responsavelId: admin.id, status: "EM_ATENDIMENTO", prazoRespostaEm: new Date(Date.now() - 60_000) } });
  await criarAtendimento(new Date(), { naoLidas: 2 });
  const c = await contarChipsInbox(sess(admin), { responsavel: "eu", naoLidas: true });
  expect(c).toEqual({ todas: 3, minhas: 1, fila: 2, naoLidas: 1, prazo: 1 });
  expect((await contarChipsInbox(sess(admin), { setor: "FINANCEIRO" })).todas).toBe(0);
  expect((await contarChipsInbox(sess(admin), { busca: "Contato 1" })).todas).toBeLessThan(3);
  void a1;
});
it("contagens não saem do escopo", async () => {
  await criarAtendimento(new Date());
  expect((await contarChipsInbox(sess(outro), {})).todas).toBe(0);
});

// opcoes-filtro.int.test.ts: o toEqual de numeros passa a esperar { id, rotulo: "Cobrança", saude: "desconectado" } (BAILEYS sem sessão)

// opcoes-filtro.test.ts
it("saudeDoNumero", () => {
  expect(saudeDoNumero({ driver: "META_CLOUD", sessao: "DESCONECTADO", ativo: true })).toBe("conectado");
  expect(saudeDoNumero({ driver: "BAILEYS", sessao: "CONECTADO", ativo: true })).toBe("conectado");
  expect(saudeDoNumero({ driver: "MOTOR", sessao: "CAIU", ativo: true })).toBe("instavel");
  expect(saudeDoNumero({ driver: "BAILEYS", sessao: "AGUARDANDO_QR", ativo: true })).toBe("instavel");
  expect(saudeDoNumero({ driver: "BAILEYS", sessao: "DESCONECTADO", ativo: true })).toBe("desconectado");
  expect(saudeDoNumero({ driver: "META_CLOUD", sessao: "CONECTADO", ativo: false })).toBe("desconectado");
});

// InboxNovo.test.ts
it("paramsDosFiltros pede contagens só quando pedido e sem cursor", () => {
  expect(paramsDosFiltros({ setor: "FINANCEIRO" }, null, { contagens: true })).toBe("setor=FINANCEIRO&contagens=1");
  expect(paramsDosFiltros({}, "cur", { contagens: true })).toBe("cursor=cur");
});

// page.test.ts: mock de consultas-pagina ganha contarChipsInbox: mocks.contagens; o mock do InboxNovo imprime `cont:${JSON.stringify(contagens)}`
it("contagens dos chips vão ao InboxNovo com os filtros da URL", async () => {
  mocks.preferencia.mockResolvedValue({ ok: false });
  mocks.contagens.mockResolvedValue({ todas: 3, minhas: 1, naoLidas: 0, prazo: 0, fila: 2 });
  const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ setor: "FINANCEIRO" }) }));
  expect(mocks.contagens).toHaveBeenCalledWith(expect.anything(), { setor: "FINANCEIRO" });
  expect(h).toContain('"todas":3');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/consultas-pagina.int.test.ts src/server/inbox/opcoes-filtro.int.test.ts` e `node_modules/.bin/vitest run src/server/inbox/opcoes-filtro.test.ts "src/app/(app)/inbox/InboxNovo.test.ts" "src/app/(app)/inbox/page.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Como na regra acima. `opcoesFiltroInbox` passa a selecionar `driver`, `sessao` e `ativo` e devolve `saude` (sem telefone, como hoje). A rota só chama `contarChipsInbox` com `contagens=1` e sem `cursor`. `InboxNovo` atualiza `contagens` em `recarregarLista` e `aoAviso` (`:144-156`) quando a resposta traz o campo.

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2. Expected: PASS.

- [ ] **Step 5: Aceite visual**

Sem tela própria; entra na Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox src/app/api/inbox/atendimentos/route.ts "src/app/(app)/inbox/page.tsx" "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/InboxNovo.test.ts" docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): contagens dos chips e saúde dos números" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-6"></a>
### Task 6: Selo de não lidas do menu lateral (exceção autorizada)

Hoje o selo soma o contador **compartilhado** (`contarNaoLidas`, `src/server/whatsapp/consultas-inbox.ts:78-81`). Ele é lido só no render do layout (`src/app/(app)/layout.tsx:12`) e não se atualiza em tempo real (parte 2 §13). A E0 Task 2 passou a gravar a leitura pessoal ao abrir (`marcarAtendimentoLido` → `marcarLida`). O selo usa a mesma regra pessoal da lista: `condicaoNaoLidaPessoal` (`consultas-pagina.ts:40-53`), sobre todo o escopo. O número mostrado passa a ser **conversas** não lidas, e não mensagens: é a contagem que a condição dá numa consulta só, e é a mesma do chip "Não lidas" sem filtros. Exceção ao "barra lateral fora do escopo", pedida pelo coordenador e registrada no item "Fora da E0" do plano 01.

**Files:**
- Create: `src/server/inbox/nao-lidas.ts` (recebe `condicaoNaoLidaPessoal` de `consultas-pagina.ts:32-53`, que passa a importá-la)
- Create: `src/app/api/inbox/nao-lidas/route.ts`
- Create: `src/lib/eventos-inbox.ts`
- Modify: `src/app/(app)/inbox/useEventosInbox.ts:44-55` (usa a assinatura compartilhada)
- Create: `src/components/SeloNaoLidasInbox.tsx`
- Modify: `src/components/Sidebar.tsx:105-110` (o selo vira `<SeloNaoLidasInbox>`), `src/components/BarraMobile.tsx:27, 49, 56`
- Modify: `src/app/(app)/layout.tsx:5, 12`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx` (depois de marcar como lida, `recontarNaoLidasInbox()`)
- Test: `src/server/inbox/nao-lidas.int.test.ts` (novo), `src/lib/eventos-inbox.test.ts` (novo), `src/components/SeloNaoLidasInbox.test.ts` (novo), `src/components/Sidebar.test.ts`, `src/components/BarraMobile.test.ts`, `src/app/(app)/inbox/useEventosInbox.test.ts`

**Interfaces:**
- Consumes: E0 Task 2 (`marcarAtendimentoLido`, `criarMarcadorDeLeitura`); `PAPEIS_INBOX`; `assinarEventosInbox` (`useEventosInbox.ts:22`).
- Produces:
  - `condicaoNaoLidaPessoal(usuarioId: string): Promise<Prisma.AtendimentoWhatsAppWhereInput>`;
  - `contarConversasNaoLidas(u: UsuarioSessao): Promise<number>`: 0 sem papel do Inbox, sem consulta;
  - `GET /api/inbox/nao-lidas` → `{ total }` (401/403 como `atendimentos/route.ts:15-21`, `no-store`);
  - `assinarEventosCompartilhados(aoAviso, aoConectado, criar?: () => FonteEventos): () => void`: um `EventSource` por aba, com contagem de assinantes;
  - `useNaoLidasInbox(inicial: number): number` e `recontarNaoLidasInbox(): void`. A loja é única no módulo (`useSyncExternalStore`) e recarrega ao receber `mensagem.nova`, `atendimento.atualizado` ou `resync`, com no máximo uma busca em voo e uma repetição pendente;
  - `SeloNaoLidasInbox(props: { inicial: number; variante: "pilula" | "ponto" })`;
  - `criarLojaNaoLidas(inicial: number, buscar: () => Promise<Response>): { valor(): number; aoAviso(a: AvisoInbox): void; recontar(): void; subscribe(f: () => void): () => void }` (exportada para o teste; a loja do módulo é uma instância dela).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// nao-lidas.int.test.ts (cenário como em consultas-pagina.int.test.ts:14-31)
it("conta conversas com não lida PESSOAL no escopo, igual ao chip Não lidas", async () => {
  const a = await criarAtendimento(new Date(), { naoLidas: 3 });
  await criarAtendimento(new Date(), { naoLidas: 1 });
  await criarAtendimento(new Date());
  expect(await contarConversasNaoLidas(sess(admin))).toBe(2);
  expect((await contarChipsInbox(sess(admin), {})).naoLidas).toBe(2);
  await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: a.conversaId, lidaAte: new Date() } });
  expect(await contarConversasNaoLidas(sess(admin))).toBe(1);     // leitura pessoal, contador compartilhado ainda 3
});
it("fora do escopo ou sem papel do Inbox: 0", async () => {
  await criarAtendimento(new Date(), { naoLidas: 1 });
  expect(await contarConversasNaoLidas(sess(outro))).toBe(0);
  expect(await contarConversasNaoLidas({ id: "x", nome: "x", papeis: ["ALUNO"] } as never)).toBe(0);
});

// eventos-inbox.test.ts (fonte falsa como em useEventosInbox.test.ts)
it("dois assinantes dividem uma conexão; ela fecha com o último", () => {
  const fontes: FonteFalsa[] = []; const criar = () => { const f = fonteFalsa(); fontes.push(f); return f; };
  const a = vi.fn(), b = vi.fn();
  const sairA = assinarEventosCompartilhados(a, () => {}, criar);
  const sairB = assinarEventosCompartilhados(b, () => {}, criar);
  expect(fontes).toHaveLength(1);
  fontes[0].emitir("mensagem.nova", { tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m", conversaId: "c" });
  expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
  sairA(); expect(fontes[0].fechada).toBe(false);
  sairB(); expect(fontes[0].fechada).toBe(true);
});

// SeloNaoLidasInbox.test.ts
it("pílula com 99+ e texto de leitor de tela; zero não renderiza", () => {
  expect(renderToStaticMarkup(createElement(SeloNaoLidasInbox, { inicial: 120, variante: "pilula" }))).toMatch(/99\+<span class="sr-only"> conversas não lidas<\/span>/);
  expect(renderToStaticMarkup(createElement(SeloNaoLidasInbox, { inicial: 0, variante: "pilula" }))).toBe("");
});
it("aviso relevante recarrega o total; mensagem.status não; uma busca em voo por vez", async () => {
  const total = vi.fn(async () => new Response(JSON.stringify({ total: 4 })));
  vi.stubGlobal("fetch", total);
  const loja = criarLojaNaoLidas(2, () => fetch("/api/inbox/nao-lidas"));
  loja.aoAviso({ tipo: "mensagem.status", atendimentoId: "a", mensagemId: "m", conversaId: "c" });
  expect(total).not.toHaveBeenCalled();
  loja.aoAviso({ tipo: "mensagem.nova", atendimentoId: "a", mensagemId: "m", conversaId: "c" });
  loja.aoAviso({ tipo: "atendimento.atualizado", atendimentoId: "a", mensagemId: null, conversaId: "c" });
  await vi.waitFor(() => expect(loja.valor()).toBe(4));
  expect(total).toHaveBeenCalledTimes(2);                          // uma em voo + uma repetição
});
```

`criarLojaNaoLidas(inicial, buscar)` é exportada de `SeloNaoLidasInbox.tsx` só para o teste. `Sidebar.test.ts` e `BarraMobile.test.ts` trocam "mensagens não lidas" por "conversas não lidas".

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/nao-lidas.int.test.ts` e `node_modules/.bin/vitest run src/lib/eventos-inbox.test.ts src/components "src/app/(app)/inbox/useEventosInbox.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `contarConversasNaoLidas` faz `count` com `{ AND: [escopo, await condicaoNaoLidaPessoal(u.id)] }`.
- `layout.tsx:12` troca `contarNaoLidas` por `contarConversasNaoLidas`; `contarNaoLidas` some se não restar uso (`grep`).
- `assinarEventosCompartilhados` guarda no módulo `{ fonte, ouvintes: Set, conectado }`; `useEventosInbox` passa a chamá-la, sem mudar a assinatura do hook.
- `InboxNovo` embrulha o `marcar` do marcador: `(id) => marcarAtendimentoLido(id).finally(recontarNaoLidasInbox)`. A leitura pessoal não gera aviso SSE quando o contador compartilhado já era 0.
- `SeloNaoLidasInbox` variante `pilula` mantém as classes atuais (`Sidebar.tsx:106`); variante `ponto` mantém `BarraMobile.tsx:56`. O `aria-label` do botão de menu (`rotuloBotaoMenu`) usa o total vivo.
- Sem `setInterval` (trava `sem-polling.test.ts`).

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2, mais `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts`. Expected: PASS.

- [ ] **Step 5: Aceite visual**

App em 1440×900 e 390×844 (gaveta aberta), nos 2 temas:
- entrar com Thiago e Ventura não lidas: o selo mostra `2`;
- abrir Thiago: o selo cai para `1` sem recarregar;
- numa segunda aba, enviar uma mensagem de entrada pela demo (`node_modules/.bin/tsx scripts/visual/demo-inbox.ts --entrada thiago`, opção que esta task acrescenta): o selo sobe na primeira aba.

Anexar as capturas de antes e depois.

- [ ] **Step 6: Commit**

```bash
git add src/server/inbox src/app/api/inbox/nao-lidas src/lib/eventos-inbox.ts src/lib/eventos-inbox.test.ts src/components/SeloNaoLidasInbox.tsx src/components/SeloNaoLidasInbox.test.ts src/components/Sidebar.tsx src/components/Sidebar.test.ts src/components/BarraMobile.tsx src/components/BarraMobile.test.ts "src/app/(app)/layout.tsx" "src/app/(app)/inbox/useEventosInbox.ts" "src/app/(app)/inbox/useEventosInbox.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" scripts/visual/demo-inbox.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): selo de não lidas pessoal e em tempo real no menu lateral" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-7"></a>
### Task 7: Item da lista

**Files:**
- Create: `src/app/(app)/inbox/ItemConversa.tsx`
- Modify: `src/app/(app)/inbox/ListaAtendimentos.tsx:13-20` (props), `:33-47` (linha), `:50-72` (render)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx` (passa `usuarioId`)
- Modify: `src/app/estados-vazios-mapa.ts:661-663` (se a linha do vazio mudar)
- Modify: `scripts/visual/capturar-inbox.mjs`
- Test: `src/app/(app)/inbox/ItemConversa.test.ts` (novo), `src/app/(app)/inbox/ListaAtendimentos.test.ts`, `src/app/(app)/inbox/InboxNovo.test.ts:41-44`

**Interfaces:**
- Consumes: `estadoVisualItem`, `BadgeEstado`, `Avatar`, `tomDoAvatar` (Task 4); `useAgoraDosPrazos` (E0 Task 5); `naoLidas` já zerado (E0 Task 2).
- Produces: `ItemConversa(props: { item: ItemListaInbox; selecionado: boolean; agora: Date; aoSelecionar(): void; usuarioId?: string; fuso: string | null })`; `ListaAtendimentos` + `usuarioId?: string`.

Anatomia (HTML:137-154):
- `<button type="button" aria-current>`: `flex w-full gap-3 rounded-lg px-2.5 py-[11px] text-left`; selecionado `bg-gray-100`; hover `hover:bg-surface-muted`;
- avatar 44 (`tom = avatarTom`, `selo` se `seloIa`); grupo: círculo 44 `bg-gray-100 text-gray-600` com `IconUsersGroup size={20}` e `data-testid="icone-grupo"`;
- corpo `flex min-w-0 flex-1 flex-col gap-[3px]`:
  - linha 1 `flex items-baseline gap-2`: nome `truncate text-sm font-semibold`; `IconBellOff` 12 `text-gray-400` se `silenciada` (`aria-label="Silenciada"`); `IconPin` 12 se `fixada` (`aria-label="Fixada"`); hora `font-mono text-[11.5px] tabular-nums`, `text-brand-700` com não lidas, senão `text-gray-400`;
  - linha 2 `flex items-center gap-2`: prévia `truncate text-[13px] text-gray-600`; contador `grid h-5 min-w-5 place-items-center rounded-full bg-brand-solid px-1.5 text-[11px] font-semibold text-on-brand`, `font-mono tabular-nums`;
  - linha 3 `mt-[3px] flex flex-wrap items-center gap-1.5`: os badges (`icone: "relogio"` → `IconClockExclamation size={11}`; `"sem-nome"` → `IconUserX size={11}`).
- A linha de metadados atual (`ListaAtendimentos.tsx:61-67`) some: setor e status entram como badges; o número sai do item (está no seletor e no cabeçalho).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// ItemConversa.test.ts
const agora = new Date("2026-10-22T13:00:00.000Z");
const h = (o: Partial<ItemListaInbox> = {}, p: object = {}) => renderToStaticMarkup(createElement(ItemConversa, {
  item: { ...base, ...o }, selecionado: false, agora, aoSelecionar: () => {}, usuarioId: "u1", fuso: "America/Sao_Paulo", ...p } as never));
it("anatomia: avatar 44 colorido, nome 14/600, hora mono, prévia 13", () => {
  const t = h({ contatoId: "c3", contatoNome: "Mariana Costa", preview: "Perfeito. Quanto fica?", ultimaMensagemEm: "2026-10-22T12:42:00.000Z" });
  for (const c of ["bg-avatar-4", "h-11", "font-semibold", "font-mono", "text-[11.5px]", "text-[13px]", ">MC<", ">09:42<", "Perfeito. Quanto fica?"]) expect(t).toContain(c);
});
it("selecionado é cinza neutro (não verde) e marca aria-current", () => {
  const t = h({}, { selecionado: true });
  expect(t).toContain('aria-current="true"'); expect(t).toContain("bg-gray-100"); expect(t).not.toContain("bg-brand-bg text-brand-800");
});
it("não lidas: hora verde e contador sólido da marca, mono, peso 600", () => {
  const t = h({ naoLidas: 2 });
  expect(t).toMatch(/text-brand-700[^"]*">[0-9:]+</);
  expect(t).toMatch(/<span class="[^"]*bg-brand-solid[^"]*text-on-brand[^"]*">2<\/span>/);
  expect(h({ naoLidas: 0 })).toMatch(/text-gray-400[^"]*">[0-9:]+</);
});
it("fixada e silenciada aparecem como ícone", () => {
  const t = h({ fixada: true, silenciada: true });
  expect(t).toContain('aria-label="Fixada"'); expect(t).toContain('aria-label="Silenciada"');
});
it("badges: com você, setor e prazo com relógio", () => {
  const t = h({ responsavelId: "u1", status: "EM_ATENDIMENTO", prazoRespostaEm: "2026-10-22T12:12:00.000Z" });
  expect(t).toContain("Com você"); expect(t).toContain("Financeiro"); expect(t).toContain("Prazo estourado · 48 min"); expect(t).toContain("bg-red-50");
});
it("grupo: ícone de grupo, sem badges", () => {
  const t = h({ grupo: true });
  expect(t).toContain('data-testid="icone-grupo"'); expect(t).not.toContain("Com você"); expect(t).not.toContain("rounded-[6px]");
});
```

`ListaAtendimentos.test.ts`:
- o teste "item mostra setor, número, status, responsável e prazo estourado" (`:124-128`) vira "item mostra setor, estado e prazo; número não aparece": `toContain("Financeiro")`, `toContain("Na fila")`, `toContain("Prazo estourado")`, `not.toContain("Cobrança")`;
- `responsavelNome: "Ana Lima"` com `usuarioId` diferente → `toContain("Com Ana")`;
- o de não lidas passa a usar o regex de `bg-brand-solid` acima.

`InboxNovo.test.ts:41-44`: "a lista é a ListaAtendimentos" passa a esperar `"Comercial"` e `"Na fila"` ou `"Com …"`, sem `"Escola"`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/ItemConversa.test.ts" "src/app/(app)/inbox/ListaAtendimentos.test.ts" "src/app/(app)/inbox/InboxNovo.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`ListaAtendimentos` mantém `VirtualList`, "Carregar mais" e `EstadoVazio bloco` (decisão: a moldura tracejada do DS fica; parte 1 §3.8, "Opcional"). Ela troca `ItemLista` por `ItemConversa` e passa `agora={new Date(useAgoraDosPrazos(itens))}`. Raiz `min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1` (HTML:135, `padding:4px 8px 12px`); `estimatedHeight={104}` continua.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts`
Expected: PASS. Em `botoes.test.ts`, `ItemConversa.tsx` entra em `CONTROLES_QUE_NAO_SAO_BOTAO` como `["(sem nome)"]` (item de lista, como `ItemLista.tsx`).

- [ ] **Step 5: Aceite visual**

Estados `conversa` (desktop e celular-lista) e `lista-vazia` (app `?busca=zzzz`; protótipo digitando `zzzz` na busca), nos 2 temas. Referência: coluna esquerda de `telas/prototipo-escuro-admin-desktop.png`.

Diferenças justificadas, para o PR:
- etapa → setor (E2);
- estado da Aria e selo IA (E3);
- prévia sem autor (E3, L31);
- avatar B2B quadrado (E2, precisa do tipo na consulta);
- "Sem resposta" → "Prazo estourado" (regra do ERP, L24);
- moldura do vazio (DS).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/ItemConversa.tsx" "src/app/(app)/inbox/ItemConversa.test.ts" "src/app/(app)/inbox/ListaAtendimentos.tsx" "src/app/(app)/inbox/ListaAtendimentos.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/InboxNovo.test.ts" src/app/botoes.test.ts src/app/estados-vazios-mapa.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): item da lista no desenho do protótipo" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-8"></a>
### Task 8: Coluna Conversas (D17)

**Files:**
- Create: `ColunaConversas.tsx`, `ChipsFiltro.tsx`, `SeletorNumero.tsx`, `PopoverFiltros.tsx`, `PopoverColuna.tsx`, `filtros-url.ts` (todos em `src/app/(app)/inbox/`)
- Create: `src/components/BotaoIcone.tsx`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:215-218` (a seção da lista vira `<ColunaConversas>`)
- Modify: `src/app/(app)/inbox/NovoAtendimento.tsx:25-26` (prop `compacto?: boolean`: sem a moldura do form quando dentro do popover)
- Modify: `src/app/botoes.test.ts` (listas de controles), `src/app/botoes-mapa.ts:1133-1135` (`NovoAtendimento`), `src/app/estados-vazios-mapa.ts`
- Modify: `scripts/visual/capturar-inbox.mjs` (`filtros`, `seletor-numero`, `nova-conversa`)
- Test: `ColunaConversas.test.ts`, `ChipsFiltro.test.ts`, `filtros-url.test.ts`, `SeletorNumero.test.ts`, `PopoverFiltros.test.ts` (novos), `src/components/BotaoIcone.test.ts` (novo), `src/app/(app)/inbox/InboxNovo.test.ts:45-50`

**Interfaces:**
- Consumes: `ContagensChipsInbox`, `OpcoesFiltroInbox` com `saude` (Task 5); `ListaAtendimentos` (Task 7); `NovoAtendimento`; `SinoNotificacoes`; `useDialogo` (`src/lib/dialogo.ts`).
- Produces:
  - `ColunaConversas(props: { filtros: FiltrosInbox; opcoesFiltro?: OpcoesFiltroInbox; itens: ItemListaInbox[]; proximo: string | null; selecionado: string | null; aoSelecionar(id: string): void; aoCarregarMais(): void; faixaAria?: ReactNode; aoNovaConversa(): void; contagens?: ContagensChipsInbox; fuso: string | null; usuarioId: string; podeGerenciarNumeros: boolean; sino?: ReactNode; novaConversa?: ReactNode })`; o popover "Nova conversa" abre por `aoNovaConversa`, e `InboxNovo` passa `novaConversa={<NovoAtendimento compacto opcoes={opcoesNovaConversa} />}` e controla a abertura;
  - `ChipsFiltro(props: { chips: ChipFiltroInbox[]; ativo: string; filtros: FiltrosInbox })`, `chipsDaColuna(c?: ContagensChipsInbox): ChipFiltroInbox[]`;
  - `filtros-url.ts`: `paramsDaUrl(f): URLSearchParams`, `filtrosDoChip(id: IdChipInbox, f: FiltrosInbox): FiltrosInbox`, `chipAtivo(f): IdChipInbox | null`, `hrefDosFiltros(caminho: string, f: FiltrosInbox): string`;
  - `SeletorNumero(props: { numeros: OpcoesFiltroInbox["numeros"]; selecionado: string | null; podeGerenciar: boolean; aoEscolher(id: string | null): void; abertoInicial?: boolean })` (`abertoInicial` só para teste de marcação, como `menuAberto` do balão);
  - `PopoverFiltros(props: { filtros: FiltrosInbox; setores: Setor[]; aoAplicar(f: FiltrosInbox): void; aoFechar(): void })`, `contarFiltrosAplicados(f): number` (setor e status);
  - `PopoverColuna(props: { titulo: string; aberto: boolean; aoFechar(): void; topo?: 56 | 72; rodape?: ReactNode; children: ReactNode })`;
  - `BotaoIcone(props: { rotulo: string; ativo?: boolean; tamanho?: 34 | 36 | 44; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>)`.

Anatomia e valores:
- **Cabeçalho** (HTML:39-46): `flex items-center gap-2 px-[18px] pb-2.5 pt-[18px]`; título `text-xl font-semibold tracking-[-0.01em]` "Conversas"; abaixo, `SeletorNumero` (gatilho h 24, 12.5px `text-gray-600`, `IconDeviceMobile` 13 + rótulo + `IconChevronDown` 13). O rótulo é `Todos os números · {n} conectados` ou `{rotulo do escolhido}`; `n` = números com `saude === "conectado"`. À direita, `BotaoIcone` 34: "Filtros" (`IconFilter` 17; contador `absolute right-[3px] top-[3px] h-[15px] min-w-[15px] rounded-full bg-brand-solid px-1 text-[9.5px] font-semibold text-on-brand font-mono`), "Nova conversa" (`IconEdit` 17) e o `sino`.
- **Seletor** (HTML:99-106): `PopoverColuna topo={72}` com título "Ver conversas de"; cada opção `min-h-12 rounded-lg px-2.5 py-1.5`, ponto 8 px (`bg-brand-solid` conectado, `bg-amber-600` instável, `bg-gray-400` desconectado), rótulo 13/500, "Instável" 11px `text-amber-700` e `IconCheck` 14 `text-brand-700` no escolhido. A primeira opção é "Todos os números". Rodapé só com `podeGerenciar`: link `/configuracao/whatsapp` "Gerenciar números em Configurações" 12.5/500 `text-brand-700`. Sem número de telefone e sem contagem por número (precisaria de agregação por número; fica registrado para a E4).
- **Busca** (HTML:107-112): bloco `px-[18px] pb-3`; caixa `flex h-[38px] items-center gap-2.5 rounded-item bg-surface-muted px-3 text-gray-600`; `IconSearch` 15; `<input type="search" aria-label="Buscar conversas" placeholder="Buscar conversas e contatos" class="flex-1 bg-transparent text-[13.5px] …">`; selo `⌘K` `rounded-[5px] border border-gray-200 px-[5px] py-px font-mono text-[11px] text-gray-400`, `aria-keyshortcuts="Meta+K Control+K"`. Enter aplica (como `PainelFiltros.tsx:128`); ⌘K ou Ctrl+K em qualquer lugar da página focam o campo (`ehAtalhoBusca(e)` exportada).
- **Slot `faixaAria`** (HTML:114-121): renderizado entre a busca e os chips, só se vier. Vazio na E1.
- **Chips** (HTML:122-127): `flex flex-wrap gap-1.5 px-[18px] pb-2.5`; chip `flex h-7 items-center gap-1.5 rounded-[20px] border px-2.5 text-[12.5px] font-medium whitespace-nowrap`; ativo `border-transparent bg-gray-100 text-gray-800`; inativo `border-gray-200 text-gray-600`; ponto 7 px `PONTO_TOM[tom]`; contagem `font-mono text-[11px] opacity-70`; `aria-pressed`. Chips da E1, nesta ordem (a E3 insere IA, Aprovação e Handoff depois de "Todas"):

| id | rótulo | tom | URL |
|---|---|---|---|
| `todas` | Todas | `neutro` | limpa `resp`, `naoLidas`, `prazo` |
| `minhas` | Minhas | `humano` | `resp=eu` |
| `naoLidas` | Não lidas | `neutro` | `naoLidas=1` |
| `prazo` | Prazo estourado | `sem-resposta` | `prazo=estourado` |
| `fila` | Não atribuídas | `neutro` | `resp=fila` |

- **Filtros aplicados** (HTML:129-134), só com setor ou status: chips `inline-flex h-6 items-center gap-1 rounded-[6px] bg-brand-bg pl-[9px] pr-1 text-xs font-medium text-brand-700` com × (`aria-label="Remover filtro {rótulo}"`), mais "Limpar" 12px `text-gray-600`.
- **Popover Filtros** (HTML:80-98): `PopoverColuna titulo="Filtrar conversas" topo={56}`; grupos "Setor" (`opcoesFiltro.setores`) e "Status" (4 rótulos de `STATUS_ATENDIMENTO_LABEL`), com título do grupo 11px/600 `text-gray-600` (sem `uppercase`). Opção `h-7 rounded-[15px] border px-2.5 text-[12.5px]`, `IconCheck` 12 na marcada; o rodapé tem `<Botao variante="secundario">Limpar</Botao>` e `<Botao className="flex-1">Mostrar conversas</Botao>`. Escolha única por grupo (o ERP filtra um setor e um status). Os grupos do protótipo Etapa, Tags, Responsável e Tipo ficam para a E4 (L4–L7).
- **PopoverColuna**: `absolute left-3 right-3 z-20 flex max-h-[calc(100%-70px)] min-h-0 flex-col rounded-dialog border border-gray-200 bg-surface shadow-popover` em `top-14` ou `top-[72px]`. Abaixo de 700: `max-[699px]:fixed max-[699px]:inset-x-0 max-[699px]:bottom-0 max-[699px]:top-auto max-[699px]:max-h-[85dvh] max-[699px]:rounded-b-none max-[699px]:rounded-t-[18px]` (`mobile.js:43, 45`). `role="dialog"` com `aria-label`, `useDialogo`, cabeçalho 14.5/600 com `BotaoIcone` "Fechar" 28.
- **Nova conversa** (HTML:48-79): `PopoverColuna titulo="Nova conversa" topo={56}` com o `NovoAtendimento compacto` (formulário atual; o fluxo do protótipo é da E4, D9).
- **Lista**: `ListaAtendimentos` (Task 7).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// filtros-url.test.ts
it("paramsDaUrl mantém o formato atual (movido de PainelFiltros)", () => {
  expect(Object.fromEntries(paramsDaUrl({ setor: "FINANCEIRO", numeroId: "n1", responsavel: "eu", status: "EM_ATENDIMENTO", naoLidas: true, prazoEstourado: true, busca: "ana" })))
    .toEqual({ setor: "FINANCEIRO", numero: "n1", resp: "eu", status: "EM_ATENDIMENTO", naoLidas: "1", prazo: "estourado", busca: "ana" });
});
it("filtrosDoChip troca só a dimensão dos chips", () => {
  const f = { setor: "FINANCEIRO" as const, busca: "ana", naoLidas: true };
  expect(filtrosDoChip("minhas", f)).toEqual({ setor: "FINANCEIRO", busca: "ana", responsavel: "eu" });
  expect(filtrosDoChip("todas", f)).toEqual({ setor: "FINANCEIRO", busca: "ana" });
  expect(filtrosDoChip("prazo", f)).toEqual({ setor: "FINANCEIRO", busca: "ana", prazoEstourado: true });
});
it("chipAtivo com responsável de outra pessoa é nulo", () => {
  expect(chipAtivo({})).toBe("todas"); expect(chipAtivo({ responsavel: "fila" })).toBe("fila");
  expect(chipAtivo({ responsavel: "u9" })).toBeNull();
});
it("hrefDosFiltros", () => {
  expect(hrefDosFiltros("/inbox", {})).toBe("/inbox");
  expect(hrefDosFiltros("/inbox", { naoLidas: true })).toBe("/inbox?naoLidas=1");
});

// ChipsFiltro.test.ts
it("chips da E1 com rótulo, tom e total", () => {
  expect(chipsDaColuna({ todas: 9, minhas: 3, naoLidas: 2, prazo: 3, fila: 2 })).toEqual([
    { id: "todas", rotulo: "Todas", tom: "neutro", total: 9 }, { id: "minhas", rotulo: "Minhas", tom: "humano", total: 3 },
    { id: "naoLidas", rotulo: "Não lidas", tom: "neutro", total: 2 }, { id: "prazo", rotulo: "Prazo estourado", tom: "sem-resposta", total: 3 },
    { id: "fila", rotulo: "Não atribuídas", tom: "neutro", total: 2 }]);
  expect(chipsDaColuna(undefined)[0].total).toBe(0);
});
it("marcação: ponto, contagem mono, ativo cinza com aria-pressed", () => {
  const h = renderToStaticMarkup(createElement(ChipsFiltro, { chips: chipsDaColuna({ todas: 9, minhas: 3, naoLidas: 2, prazo: 3, fila: 2 }), ativo: "todas", filtros: {} }));
  expect(h).toMatch(/aria-pressed="true"[^>]*class="[^"]*bg-gray-100[^"]*"[^>]*>.*Todas.*font-mono[^>]*>9</s);
  for (const c of ["h-7", "rounded-[20px]", "text-[12.5px]", "h-[7px]", "bg-amber-600", "bg-brand-solid"]) expect(h).toContain(c);
});

// SeletorNumero.test.ts (estado aberto via prop de teste `abertoInicial`)
it("rótulo conta só os conectados; opções com ponto e Instável; link só para quem gerencia", () => {
  const numeros = [{ id: "n1", rotulo: "Central", saude: "conectado" }, { id: "n2", rotulo: "Rodrigo", saude: "instavel" }] as const;
  const fechado = renderToStaticMarkup(createElement(SeletorNumero, { numeros, selecionado: null, podeGerenciar: false, aoEscolher: () => {} } as never));
  expect(fechado).toContain("Todos os números · 1 conectados");
  const aberto = renderToStaticMarkup(createElement(SeletorNumero, { numeros, selecionado: "n2", podeGerenciar: true, aoEscolher: () => {}, abertoInicial: true } as never));
  expect(aberto).toContain("Instável"); expect(aberto).toContain('href="/configuracao/whatsapp"'); expect(aberto).toContain("Gerenciar números em Configurações");
  expect(renderToStaticMarkup(createElement(SeletorNumero, { numeros, selecionado: null, podeGerenciar: false, aoEscolher: () => {}, abertoInicial: true } as never))).not.toContain("Gerenciar números");
});

// PopoverFiltros.test.ts
it("contarFiltrosAplicados conta setor e status", () => {
  expect(contarFiltrosAplicados({})).toBe(0); expect(contarFiltrosAplicados({ setor: "COMERCIAL", status: "ENCERRADO", naoLidas: true })).toBe(2);
});

// ColunaConversas.test.ts
it("cabeçalho, busca com ⌘K, chips e lista; sem faixaAria nada entre busca e chips", () => {
  const h = html({ contagens: { todas: 2, minhas: 0, naoLidas: 0, prazo: 0, fila: 1 } });
  for (const t of ["Conversas", 'placeholder="Buscar conversas e contatos"', "⌘K", 'aria-label="Filtros"', 'aria-label="Nova conversa"', "Não atribuídas", "Ana"]) expect(h).toContain(t);
  expect(h).toContain("text-xl font-semibold"); expect(h).toContain("h-[38px]"); expect(h).toContain("rounded-item");
  expect(h).not.toContain("data-faixa-aria");
  expect(html({ faixaAria: createElement("div", { "data-faixa-aria": "" }) })).toContain("data-faixa-aria");
});
it("filtro de setor aplicado vira chip removível e conta no selo do botão", () => {
  const h = html({ filtros: { setor: "FINANCEIRO" } });
  expect(h).toContain('aria-label="Remover filtro Financeiro"'); expect(h).toMatch(/aria-label="Filtros"[\s\S]*?>1</);
});
it("ehAtalhoBusca: ⌘K e Ctrl+K", () => {
  expect(ehAtalhoBusca({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
  expect(ehAtalhoBusca({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);
  expect(ehAtalhoBusca({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
});

// BotaoIcone.test.ts
it("círculo, rótulo acessível, ativo cinza", () => {
  const h = renderToStaticMarkup(createElement(BotaoIcone, { rotulo: "Filtros", ativo: true, tamanho: 34, children: "x" }));
  for (const c of ['aria-label="Filtros"', 'type="button"', "rounded-full", "h-[34px]", "w-[34px]", "bg-gray-100", "text-gray-600"]) expect(h).toContain(c);
});
```

`InboxNovo.test.ts:45-50`: o teste do `PainelFiltros` vira "com as opções do servidor mostra a coluna: busca, chips e seletor de número", com os textos `Todas`, `Minhas`, `Não lidas`, `Prazo estourado`, `Não atribuídas` e `Todos os números`. Sem `opcoesFiltro`, a coluna aparece sem o seletor (a busca e os chips continuam).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/components/BotaoIcone.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Conforme a anatomia. `ColunaConversas` usa `useRouter().replace(hrefDosFiltros(...))` para busca, chips, seletor e filtros, como `PainelFiltros.tsx:110-114`. `SeletorNumero` aparece para todos os papéis do Inbox (D17, padrão). `podeGerenciarNumeros` vem de `usuario.papeis.includes("ADMINISTRADOR")` no `InboxNovo`. `PainelFiltros.tsx` deixa de ser importado; o arquivo e os seus testes saem na Task 15.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/components src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/campos.test.ts`
Expected: PASS. Ajustes de trava:
- `CONTROLES_QUE_NAO_SAO_BOTAO`: `BotaoIcone.tsx` (`["rotulo"]`), chips (`["key c.id"]`), opções do seletor e do popover, × dos aplicados;
- `botoes-mapa.ts`: `PopoverFiltros.tsx` (`Limpar → secundario/md`, `Mostrar conversas → primario/md`);
- `fundo-sobre-pagina`: a busca `bg-surface-muted` sem borda entra em `DENTRO_DE_SUPERFICIE` (coluna `bg-surface`).

- [ ] **Step 5: Aceite visual**

Estados `conversa`, `filtros` (ref. `telas/prototipo-estado-filtros.png`), `seletor-numero`, `nova-conversa` (ref. `telas/prototipo-estado-nova-conversa.png`) e `celular-lista`, nos 2 temas, app e protótipo.

Diferenças justificadas:
- faixa "Aria ativa" (E3);
- grupos do filtro (E4);
- conteúdo do popover de nova conversa (E4, D9);
- placeholder sem "tags" (a busca não procura tag, L15);
- sem contagem por número.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox" src/components/BotaoIcone.tsx src/components/BotaoIcone.test.ts src/app/botoes.test.ts src/app/botoes-mapa.ts src/app/estados-vazios-mapa.ts src/app/fundo-sobre-pagina.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): coluna Conversas com seletor de número, busca ⌘K e chips com contagem" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-9"></a>
### Task 9: Thread — balões por autor, eventos, separador de dia

**Files:**
- Modify: `src/components/conversa/BalaoMensagem.tsx` (versão da E0 Task 8; render `:73-89` de hoje)
- Modify: `src/components/conversa/itens-thread.ts` (criado na E0 Task 4)
- Create: `src/components/conversa/EventoSistema.tsx`, `src/components/conversa/SeparadorDia.tsx`
- Delete: `src/components/conversa/NotaNaThread.tsx` e `NotaNaThread.test.ts` (E0 Task 4: "a E1 troca pelo `BalaoMensagem` com `autor: "nota"`")
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:144-161` (thread), `:95, 122` ("Transferido de" vira evento)
- Modify: `scripts/visual/capturar-inbox.mjs` (`humano-compositor`)
- Test: `src/components/conversa/BalaoMensagem.test.ts`, `itens-thread.test.ts`, `EventoSistema.test.ts` (novo), `SeparadorDia.test.ts` (novo), `src/app/(app)/inbox/ConversaAberta.test.ts`

**Interfaces:**
- Consumes: `itensDaThread(mensagens, notas, temMaisAntes)` e `ItemThread` (E0 Task 4); `NotaInternaThread` com `origem` (E0 Task 3); `ConversaHook.notas`.
- Produces:
  - `type AutorBalao = "cliente" | "humano" | "aria" | "nota"`;
  - `BalaoMensagem` + `autor: AutorBalao`, `emSequencia?: boolean`, `destacada?: boolean`, `nota?: NotaInternaThread`;
  - `autorDoItem(i: ItemThread): AutorBalao` (ENTRADA → `cliente`; `origem === "IA"` → `aria`; nota → `nota`; resto → `humano`);
  - `type ItemThreadVisual = (ItemThread & { emSequencia: boolean }) | { tipo: "dia"; id: string; rotulo: string } | { tipo: "evento"; id: string; tom: "ia" | "neutro"; icone: "transferencia"; texto: string; hora: string | null }`;
  - `decorarThread(itens: ItemThread[], o: { fuso: string | null; agora: Date; transferidoDe?: string | null }): ItemThreadVisual[]`;
  - `rotuloDia(iso: string, fuso: string | null, agora: Date): string`, `notaComoMensagem(n: NotaInternaThread): MensagemThread`;
  - `EventoSistema(props: { tom: "ia" | "neutro"; icone: ReactNode; texto: string; hora?: string | null; riscado?: boolean })`;
  - `SeparadorDia(props: { rotulo: string })`.

Valores (HTML:264-282, 1008-1013):
- container das mensagens `px-[7%] pb-2.5 pt-[18px]`, abaixo de 700 `max-[699px]:px-2.5 max-[699px]:pb-2 max-[699px]:pt-3` (`mobile.js:42`);
- balão `max-w-[min(560px,72%)] px-[11px] pb-1.5 pt-2`, texto `text-sm leading-[1.45]`;
- raio: entrada `rounded-lg rounded-tl-[4px]`, saída `rounded-lg rounded-tr-[4px]`, em sequência `rounded-lg`; topo `mt-1.5` fora de sequência;
- fundo: `cliente` `bg-entry`; `humano` `bg-entry-accent`; `aria` `bg-bubble-ia`; `nota` `bg-bubble-note border border-dashed border-amber-600`, à direita;
- autor 12px/600 `mb-[3px] flex items-center gap-[5px]`, ícone 12, só no primeiro da sequência e nunca no `cliente` individual (o participante de grupo continua):

| Autor | Texto | Ícone | Cor |
|---|---|---|---|
| `humano` | `Você` quando `m.propria`; senão o nome (`autorDaMensagem`) | `IconUser` | `text-brand-800` |
| `aria` | `Aria · IA` | `IconSparkles` | `text-ai-700` |
| `nota` | `Nota interna · só equipe` ou `Nota da oportunidade · só equipe` (E0) | `IconLock` | `text-amber-700` |

  Autor da nota (`autorNome`) na linha da hora.
- hora `font-mono text-[10.5px] tabular-nums text-gray-600`, `mt-0.5 flex justify-end gap-1`; ✓✓ `IconChecks size={13}` (`text-brand-700` só em `LIDA`, E0);
- chevron: o `float-right` da E0 continua;
- `destacada`: `ring-2 ring-amber-600` (busca, Task 11);
- evento: `self-center my-1 flex max-w-[80%] items-center gap-[7px] rounded-[20px] py-[5px] pl-[11px] pr-1.5 text-xs`; `ia` `bg-ai-50 text-ai-700`, `neutro` `bg-surface text-gray-600`; ícone 13; hora `font-mono text-[11px] opacity-70 mr-1`;
- separador: `self-center my-2 rounded-md bg-surface px-3 py-1 text-xs font-medium text-gray-600`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// BalaoMensagem.test.ts
const b = (p: Partial<MensagemThread>, o: object = {}) => renderToStaticMarkup(createElement(BalaoMensagem, {
  m: { ...base, ...p }, fuso: "America/Sao_Paulo", aoComando: () => {}, recursos: () => false, ...o } as never));
it("cliente: fundo de entrada, cauda à esquerda, sem autor", () => {
  const h = b({ direcao: "ENTRADA", origem: null }, { autor: "cliente" });
  for (const c of ["bg-entry", "rounded-tl-[4px]", "max-w-[min(560px,72%)]", "leading-[1.45]"]) expect(h).toContain(c);
  expect(h).not.toContain("mb-[3px]");
});
it("humano: Você para a própria, nome para a de outra pessoa, verde forte", () => {
  expect(b({ propria: true, autorNome: "Carlos" }, { autor: "humano" })).toMatch(/text-brand-800[^>]*>.*Você/s);
  expect(b({ propria: false, autorNome: "Camila" }, { autor: "humano" })).toContain("Camila");
});
it("aria: balão roxo e Aria · IA", () => {
  const h = b({ origem: "IA" }, { autor: "aria" });
  expect(h).toContain("bg-bubble-ia"); expect(h).toContain("Aria · IA"); expect(h).toContain("text-ai-700");
});
it("nota: tracejado de aviso, rótulo pela origem, autor na linha da hora, sem ✓✓", () => {
  const n = { id: "e1", nota: "Combinar desconto", autorNome: "Ana", criadoEm: "2026-10-17T15:30:00.000Z", origem: "atendimento" as const };
  const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: notaComoMensagem(n), nota: n, autor: "nota", fuso: "America/Sao_Paulo", aoComando: () => {}, recursos: () => false, comandos: [] }));
  for (const c of ["bg-bubble-note", "border-dashed", "border-amber-600", "Nota interna · só equipe", "Ana", "12:30"]) expect(h).toContain(c);
  expect(h).not.toContain('title="Enviada"');
  expect(renderToStaticMarkup(createElement(BalaoMensagem, { m: notaComoMensagem({ ...n, origem: "oportunidade" }), nota: { ...n, origem: "oportunidade" }, autor: "nota", fuso: null, aoComando: () => {}, recursos: () => false, comandos: [] })))
    .toContain("Nota da oportunidade · só equipe");
});
it("em sequência: raio inteiro e sem autor", () => {
  const h = b({ origem: "IA" }, { autor: "aria", emSequencia: true });
  expect(h).not.toContain("rounded-tr-[4px]"); expect(h).not.toContain("Aria · IA");
});
it("hora mono 10,5 e ✓✓ de 13", () => {
  const h = b({ status: "LIDA" }, { autor: "humano" });
  expect(h).toContain("font-mono"); expect(h).toContain("text-[10.5px]"); expect(h).toMatch(/<svg[^>]*width="13"/);
});
```

Os testes de autor de `BalaoMensagem.test.ts:191-197` passam `autor` explícito e continuam.

```ts
// itens-thread.test.ts
it("rotuloDia usa o fuso de exibição", () => {
  const agora = new Date("2026-10-22T13:00:00.000Z");
  expect(rotuloDia("2026-10-22T02:30:00.000Z", "America/Sao_Paulo", agora)).toBe("Ontem");
  expect(rotuloDia("2026-10-22T02:30:00.000Z", "UTC", agora)).toBe("Hoje");
  expect(rotuloDia("2026-10-19T12:00:00.000Z", "America/Sao_Paulo", agora)).toBe("19/10/2026");
});
it("decorarThread: evento de transferência no topo, separador a cada dia, sequência por autor no mesmo dia", () => {
  const agora = new Date("2026-10-22T13:00:00.000Z");
  const itens = itensDaThread([
    m("m1", "2026-10-21T15:00:00Z", { direcao: "ENTRADA" }), m("m2", "2026-10-22T12:00:00Z", { direcao: "ENTRADA" }),
    m("m3", "2026-10-22T12:01:00Z", { direcao: "ENTRADA" }), m("m4", "2026-10-22T12:02:00Z", { origem: "IA" }),
  ], [n("n1", "2026-10-22T12:03:00Z")], false);
  const v = decorarThread(itens, { fuso: "America/Sao_Paulo", agora, transferidoDe: "Secretaria" });
  expect(v.map((i) => i.tipo === "dia" ? `dia:${i.rotulo}` : i.tipo === "evento" ? `ev:${i.texto}` : `${i.id}${(i as { emSequencia: boolean }).emSequencia ? "+" : ""}`))
    .toEqual(["ev:Transferido de Secretaria", "dia:Ontem", "m1", "dia:Hoje", "m2", "m3+", "m4", "nota:n1"]);
});
it("grupo: participantes diferentes não fazem sequência", () => {
  const itens = itensDaThread([m("a", "2026-10-22T12:00:00Z", { direcao: "ENTRADA", participanteNome: "Pai" }), m("b", "2026-10-22T12:01:00Z", { direcao: "ENTRADA", participanteNome: "Mãe" })], [], false);
  expect(decorarThread(itens, { fuso: "UTC", agora: new Date("2026-10-22T13:00:00Z") }).filter((i) => i.tipo === "mensagem").map((i) => (i as { emSequencia: boolean }).emSequencia)).toEqual([false, false]);
});

// EventoSistema.test.ts
it("pílula IA e neutra com hora mono", () => {
  const h = renderToStaticMarkup(createElement(EventoSistema, { tom: "ia", icone: "★", texto: "Aria preencheu Nível", hora: "09:58" }));
  for (const c of ["rounded-[20px]", "bg-ai-50", "text-ai-700", "font-mono", "09:58", "text-xs"]) expect(h).toContain(c);
  expect(renderToStaticMarkup(createElement(EventoSistema, { tom: "neutro", icone: "★", texto: "x", riscado: true }))).toContain("line-through");
});
// SeparadorDia.test.ts
it("pílula de superfície 12/500", () => {
  const h = renderToStaticMarkup(createElement(SeparadorDia, { rotulo: "Hoje" }));
  for (const c of ["bg-surface", "rounded-md", "text-xs", "font-medium", "text-gray-600", ">Hoje<"]) expect(h).toContain(c);
});

// ConversaAberta.test.ts
it("thread com fundo pontilhado da casca, padding de 7% e evento de transferência", () => { /* propsConversa com item({ atendimentoOrigemId: "o1" }) e origem visível mockada; toContain("px-[7%]"), toContain("Transferido de") */ });
```

O teste da E0 "thread mostra a nota interna junto das mensagens" continua passando, agora pelo `BalaoMensagem`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa "src/app/(app)/inbox/ConversaAberta.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `decorarThread`:
  - abre com o evento de transferência quando há `transferidoDe`;
  - insere `{ tipo: "dia" }` quando a chave do dia muda, calculada com `Intl.DateTimeFormat("en-CA", { timeZone: resolverFusoExibicao(fuso, "UTC") })`;
  - marca `emSequencia` quando o item anterior, sem separador entre eles, tem o mesmo `autorDoItem` e, em `cliente`, o mesmo `participanteNome`.
- `rotuloDia`: mesma chave; hoje → `Hoje`; véspera → `Ontem`; senão `formatarInstanteExibicao(iso, fuso, "UTC", "data")`.
- `ConversaAberta`: `VirtualList` sobre `decorarThread(itensDaThread(conversa.mensagens, conversa.notas, conversa.temMaisAntes), { fuso, agora: new Date(), transferidoDe })`; o `renderItem` escolhe entre `SeparadorDia`, `EventoSistema` (`IconArrowsExchange size={13}`) e `BalaoMensagem` (notas com `comandos={[]}`). O "Transferido de" sai do cabeçalho (`ConversaAberta.tsx:122`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa "src/app/(app)/inbox" src/app/paleta.test.ts src/app/botoes.test.ts src/app/contraste-elementos.test.ts`
Expected: PASS.

- [ ] **Step 5: Aceite visual**

Estados `conversa` e `humano-compositor` (ref. `telas/prototipo-claro-admin-desktop-humano-compositor.png`: nota tracejada, "Você", ✓✓, separador "Hoje") e `celular-conversa`, nos 2 temas.

Diferenças justificadas:
- sem sombra no balão (DS);
- eventos da Aria (E3), cartão de tarefa (E2) e cartão de agendada (E4) ainda não existem;
- ✓✓ verde só em "Lida" (ERP mostra mais estados).

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa "src/app/(app)/inbox/ConversaAberta.tsx" "src/app/(app)/inbox/ConversaAberta.test.ts" scripts/visual docs/planejamento/quadro-entregas.md
git rm src/components/conversa/NotaNaThread.tsx src/components/conversa/NotaNaThread.test.ts
git commit -m "feat(inbox): balões por autor, separador de dia e eventos na thread" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-10"></a>
### Task 10: Cabeçalho de 68 px e menu ⋮ (D7, D15, D16)

Até 13 botões em pílula (`AcoesAtendimento.tsx:94-108`, 207 px medidos) viram 2 visíveis + ⋮ (HTML:173-182, 237-250). Nenhuma ação some (parte 3 §1 item 7).

**Files:**
- Create: `src/app/(app)/inbox/CabecalhoConversa.tsx`, `src/app/(app)/inbox/MenuConversa.tsx`
- Modify: `src/app/(app)/inbox/AcoesAtendimento.tsx:71-135`: o componente `AcoesAtendimento` vira o hook `useAcoesAtendimento`; os diálogos (`:137-396`) ficam
- Modify: `src/components/Menu.tsx:6-8, 74, 77-165`
- Modify: `src/components/Botao.tsx:17-29` (variante `neutro`)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:110-143` (cabeçalho)
- Modify: `src/app/botoes-mapa.ts:1082-1101`, `src/app/botoes.test.ts:81`
- Modify: `scripts/visual/capturar-inbox.mjs` (`menu-mais`)
- Test: `CabecalhoConversa.test.ts`, `MenuConversa.test.ts` (novos), `src/app/(app)/inbox/AcoesAtendimento.test.ts`, `src/components/Menu.test.ts`, `src/components/Botao.test.ts`, `src/app/(app)/inbox/ConversaAberta.test.ts`

**Interfaces:**
- Consumes: `estadoVisualCabecalho`, `PONTO_TOM`, `TEXTO_TOM`, `Avatar` (Task 4); `BotaoIcone` (Task 8); `podeExecutar` (`src/server/inbox/permissoes.ts`); `marcarNaoLida` (`src/server/whatsapp/preferencias.ts:45`).
- Produces:
  - `type AtendimentoAberto = Pick<ItemListaInbox, "id" | "contatoId" | "contatoNome" | "finalidade" | "numeroRotulo" | "status" | "responsavelId" | "responsavelNome" | "grupo">`;
  - `CabecalhoConversa(props: { atendimento: AtendimentoAberto; acoes: AcoesCabecalho; painelAberto: boolean; aoAlternarPainel(): void; aoBuscar(): void; usuarioId: string; painelAuto: boolean; buscaAberta: boolean; aoVoltar(): void })`;
  - `type AcaoConversa = { rotulo: string; aoEscolher(): void; ocupado?: boolean }`;
  - `type ItemMenuConversa = { id: string; rotulo: string; icone: ReactNode; dica?: string; perigo?: boolean; desabilitado?: boolean; divisorDepois?: boolean; aoEscolher(): void }`;
  - `type AcoesCabecalho = { assumir: AcaoConversa | null; transferir: AcaoConversa | null; menu: ItemMenuConversa[]; dialogos: ReactNode; feedback: ReactNode; abrirAgendar: (() => void) | null }` (`abrirAgendar` abre o `DialogoAgendar`; `null` sem `pode("agendar")`; a Task 12 liga ao relógio do rodapé);
  - `useAcoesAtendimento(p: PropsAcoesAtendimento & { aoBuscar(): void }): AcoesCabecalho`;
  - `itensDoMenuConversa(o: { pode(a: string): boolean; fixada: boolean; silenciada: boolean; acoes: Record<string, () => void> }): ItemMenuConversa[]`;
  - `MenuConversa(props: { itens: ItemMenuConversa[] })`;
  - `Menu` + `ItemMenu.dica?`, `ItemMenu.divisorDepois?`, `densidade?: "padrao" | "compacta"`, `classeGatilho?`, `abertoInicial?`, `folhaNoCelular?`;
  - `Botao` variante `neutro`: `border border-gray-200 bg-transparent text-gray-800 hover:bg-highlight`.

Cabeçalho (HTML:163-182):
- `flex h-[68px] shrink-0 items-center gap-2.5 border-b border-gray-200 bg-surface pl-2.5 pr-3`;
- voltar `BotaoIcone` 36 "Voltar para a lista" (`IconChevronLeft` 20), só abaixo de 700;
- avatar 40 com `tom` (escondido abaixo de 700);
- bloco `min-w-0 flex-1 leading-[1.3]`:
  - nome 15/600 truncado + pílula de status `h-[18px] rounded-[5px] bg-surface-muted px-1.5 text-[10.5px] font-semibold text-gray-600`;
  - subtítulo 12.5 `text-gray-600`: ponto 7 px + estado 600 em `TEXTO_TOM` + `·` + subtítulo truncado.
- ações:
  - "Buscar na conversa" (`BotaoIcone` 36, `IconSearch` 17, escondido abaixo de 700; `ativo` com `buscaAberta`);
  - Transferir: `<Botao variante="neutro">` h 36, `IconArrowsExchange` 15 + texto só a partir de 1200 (`hidden min-[1200px]:inline`);
  - Assumir: `<Botao>` primário h 36, `IconHandStop` 15 + "Assumir conversa" a partir de 1200, "Assumir" de 700 a 1199, só ícone abaixo de 700;
  - "Painel do contato" (`BotaoIcone`, `ativo`);
  - `MenuConversa`.

Distribuição das ações atuais:

| Ação atual (`AcoesAtendimento.tsx`) | Onde fica | Item do ⋮ (ícone, dica, divisor) |
|---|---|---|
| Assumir (`:95`) | botão primário | — |
| Transferir (`:98`) | botão neutro | — |
| Marcar como não lida (novo na tela; D16, pessoal) | ⋮ | `IconMail` |
| Fixar / Desafixar (`:105`) | ⋮ | `IconPin`, dica `só você` |
| Silenciar / Reativar notificações (`:106`) | ⋮ | `IconBellOff` / `IconBell`, dica `8 h · só você`, divisor |
| Nota interna (`:100`) | ⋮ | `IconNote` |
| Agendar mensagem (`:101`) | ⋮ | `IconClock` |
| Convites e agendamentos (`:102`) | ⋮ | `IconCalendarEvent` |
| Buscar na conversa (D19) | ⋮ | `IconSearch`, dica `⌘F`, divisor |
| Atribuir (`:97`) | ⋮ | `IconUserCheck` |
| Devolver para a fila (`:96`) | ⋮ | `IconArrowBackUp` |
| Convidar (`:99`) | ⋮ | `IconUserPlus`, divisor |
| Encerrar atendimento (`:103`) | ⋮ | `IconDoorExit` |
| Bloquear contato (`:104`; D15) | ⋮ | `IconBan`, `perigo`, `desabilitado`, dica `AVISO_RECURSO_MOTOR` |

Cada item só entra com o `pode(...)` de hoje. "Marcar como não lida" e "Buscar" valem para todos; "Fixar" e "Silenciar" também, sem `pode` (`:105-106`). O segmentado "Status da conversa" (HTML:239-244) não entra (D7, padrão: status automático). Mesclar, Exportar e Arquivar não entram (D19, D7). O aviso "Fixar e silenciar valem só para você." (`:108`) vira a dica.

Menu `densidade="compacta"`: painel `w-[290px] rounded-dialog border border-gray-200 bg-surface-raised p-1.5 shadow-popover`; item `flex h-[38px] w-full items-center gap-[11px] rounded-lg px-2.5 text-left text-[13.5px] hover:bg-highlight`; ícone 16 em `w-[18px]`; dica `ml-auto text-[11.5px] text-gray-400`; divisor `my-1 mx-1.5 h-px bg-gray-200` (`role="separator"`). Com `folhaNoCelular`, abaixo de 700 o painel ignora a posição calculada e usa `fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[18px]`. Gatilho do ⋮: `classeGatilho="h-9 w-9 rounded-full text-gray-600 hover:bg-highlight aria-expanded:bg-gray-100"`, `IconDotsVertical` 17.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// AcoesAtendimento.test.ts
const acoes = Object.fromEntries(["naoLida", "fixar", "silenciar", "nota", "agendar", "pendentes", "buscar", "atribuir", "devolver", "convidar", "encerrar", "bloquear"].map((k) => [k, vi.fn()]));
const ids = (pode: (a: string) => boolean, o = { fixada: false, silenciada: false }) => itensDoMenuConversa({ pode, ...o, acoes }).map((i) => i.id);
it("ordem e grupos do menu ⋮ com todas as permissões", () => {
  expect(ids(() => true)).toEqual(["naoLida", "fixar", "silenciar", "nota", "agendar", "pendentes", "buscar", "atribuir", "devolver", "convidar", "encerrar", "bloquear"]);
  expect(itensDoMenuConversa({ pode: () => true, fixada: false, silenciada: false, acoes }).filter((i) => i.divisorDepois).map((i) => i.id)).toEqual(["silenciar", "buscar", "convidar"]);
});
it("sem permissão de setor: só as pessoais e a busca", () => {
  expect(ids(() => false)).toEqual(["naoLida", "fixar", "silenciar", "buscar"]);
});
it("rótulos alternam; bloquear segue desabilitado com o aviso do motor (D15)", () => {
  const m = itensDoMenuConversa({ pode: () => true, fixada: true, silenciada: true, acoes });
  expect(m.find((i) => i.id === "fixar")!.rotulo).toBe("Desafixar conversa");
  expect(m.find((i) => i.id === "silenciar")!).toMatchObject({ rotulo: "Reativar notificações" });
  expect(m.find((i) => i.id === "fixar")!.dica).toBe("só você");
  expect(m.find((i) => i.id === "bloquear")!).toMatchObject({ perigo: true, desabilitado: true, dica: AVISO_RECURSO_MOTOR });
  expect(m.some((i) => /status|arquivar|mesclar|exportar/i.test(i.rotulo))).toBe(false);
});
it("marcar como não lida chama a ação pessoal (D16)", () => {
  itensDoMenuConversa({ pode: () => true, fixada: false, silenciada: false, acoes }).find((i) => i.id === "naoLida")!.aoEscolher();
  expect(acoes.naoLida).toHaveBeenCalled();
});

// CabecalhoConversa.test.ts
const at = { id: "a1", contatoId: "c3", contatoNome: "Beatriz Lima", finalidade: "COMERCIAL", numeroRotulo: "Central da escola", status: "EM_ATENDIMENTO", responsavelId: "u1", responsavelNome: "Carlos", grupo: false };
const cab = (o: object = {}) => renderToStaticMarkup(createElement(CabecalhoConversa, { atendimento: at, acoes: { assumir: { rotulo: "Assumir", aoEscolher() {} }, transferir: { rotulo: "Transferir", aoEscolher() {} }, menu: [], dialogos: null, feedback: null }, painelAberto: false, painelAuto: true, aoAlternarPainel() {}, aoBuscar() {}, usuarioId: "u1", buscaAberta: false, aoVoltar() {}, ...o } as never));
it("68 px, avatar 40 colorido, nome 15/600, status e subtítulo com estado", () => {
  const h = cab();
  for (const c of ["h-[68px]", "bg-surface", "border-b", "bg-avatar-3", "h-10", "text-[15px]", "font-semibold", "Em atendimento", "h-[18px]", "Você está atendendo", "text-brand-700", "Comercial · Central da escola"]) expect(h).toContain(c);
});
it("ações visíveis: buscar, transferir (neutro), assumir (primário), painel e ⋮", () => {
  const h = cab();
  for (const r of ["Buscar na conversa", "Painel do contato", "Mais ações da conversa"]) expect(h).toContain(`aria-label="${r}"`);
  expect(h).toMatch(/border-gray-200[^"]*text-gray-800[^>]*>.*Transferir/s);
  expect(h).toContain("bg-brand-solid"); expect(h).toContain("min-[1200px]:inline");
});
it("sem permissão, sem botão; grupo: sem ações de atendimento no cabeçalho", () => {
  expect(cab({ acoes: { assumir: null, transferir: null, menu: [], dialogos: null, feedback: null } })).not.toContain("Transferir");
  const g = cab({ atendimento: { ...at, grupo: true }, acoes: { assumir: null, transferir: null, menu: [], dialogos: null, feedback: null } });
  expect(g).toContain("Conversa em grupo"); expect(g).not.toContain("Assumir");
});
it("painel automático: botão ativo só a partir de 1200; aberto: sempre", () => {
  expect(cab({ painelAuto: true })).toMatch(/aria-label="Painel do contato"[^>]*min-\[1200px\]:bg-gray-100/);
  expect(cab({ painelAuto: false, painelAberto: true })).toMatch(/aria-label="Painel do contato"[^>]*aria-pressed="true"/);
});

// Menu.test.ts
it("compacto aberto: 290 px, dica à direita e divisor", () => {
  const h = renderToStaticMarkup(createElement(Menu, { rotulo: "Mais", gatilho: "…", densidade: "compacta", abertoInicial: true,
    itens: [{ rotulo: "Fixar conversa", dica: "só você", divisorDepois: true, aoEscolher() {} }, { rotulo: "Bloquear", perigo: true, aoEscolher() {} }] }));
  for (const c of ["w-[290px]", "rounded-dialog", "h-[38px]", "text-[13.5px]", 'role="separator"', "só você", "text-red-700"]) expect(h).toContain(c);
});
// Botao.test.ts
it("variante neutro", () => { expect(botaoClasses({ variante: "neutro" })).toContain("border-gray-200"); expect(botaoClasses({ variante: "neutro" })).toContain("text-gray-800"); });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/components/Menu.test.ts src/components/Botao.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `useAcoesAtendimento` mantém toda a lógica de `AcoesAtendimento` (`:71-91`: `rodar`, `concluir`, `avisar`, estados de diálogo) e devolve, em `dialogos`, o mesmo JSX de `:111-133`. O `feedback` (`FeedbackAcao`) aparece logo abaixo do cabeçalho, numa faixa de 1 linha `px-3 py-1.5 bg-surface border-b`, só quando há mensagem.
- `ConversaAberta` usa `CabecalhoConversa` e repassa `aoBuscar`, que abre a busca da Task 11 (aqui, só alterna um estado `buscaAberta`).
- O `Menu` acrescenta as props sem mudar o comportamento padrão: o teste "classes exatas do painel e do item" (`Menu.test.ts:13-17`) continua.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/components src/app/botoes.test.ts src/app/campos.test.ts src/app/confirmacoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts`
Expected: PASS. Ajustes de trava:
- `botoes-mapa.ts`: o bloco `inbox/AcoesAtendimento.tsx` (`:1082-1101`) perde os 12 botões `sm` da barra e mantém os dos diálogos; entra `inbox/CabecalhoConversa.tsx` (`Transferir → neutro/md`, `Assumir conversa · Assumir → primario/md`);
- `botoes.test.ts`: `CONTROLES_QUE_NAO_SAO_BOTAO` de `ConversaAberta.tsx` perde "Voltar para a lista" e "Painel do contato", que passam para `CabecalhoConversa.tsx` via `BotaoIcone`;
- o `Menu.tsx` mantém `["rotulo", "key indice"]`.

- [ ] **Step 5: Aceite visual**

Estados `conversa`, `humano-compositor`, `menu-mais` (ref. `telas/prototipo-estado-menu-mais.png`), `celular-conversa` e `tablet-painel`, nos 2 temas.

Conferir:
- altura do cabeçalho = 68 em todas as larguras;
- no celular, os botões cabem numa linha (voltar, Transferir, Assumir, painel, ⋮).

Diferenças justificadas:
- sem segmentado de status (D7);
- itens do ERP no lugar de Mesclar, Exportar e Arquivar (D19, D7);
- "Devolver para Aria" e "Criar tarefa" (E3, E2);
- pílula nos botões de texto (DS).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox" src/components/Menu.tsx src/components/Menu.test.ts src/components/Botao.tsx src/components/Botao.test.ts src/app/botoes-mapa.ts src/app/botoes.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): cabeçalho de 68 px com duas ações e menu ⋮" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-11"></a>
### Task 11: Busca na conversa (D19)

D19 (padrão): a busca na conversa entra na E1 (doc 03, linha 17). O protótipo não tem comportamento (HTML:173, 1185). A busca da E1 procura nas mensagens **carregadas** (até `LIMITE_HISTORICO = 600`, `historico-conversa.ts:15`), sem consulta nova; a barra avisa quando há mensagens anteriores não carregadas.

**Files:**
- Create: `src/app/(app)/inbox/busca-conversa.ts`, `src/app/(app)/inbox/BuscaConversa.tsx`
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx` (barra abaixo do cabeçalho; `destacada` no balão; rolagem até o achado; ⌘F/Ctrl+F com a conversa aberta)
- Modify: `scripts/visual/capturar-inbox.mjs` (`busca-conversa`)
- Test: `busca-conversa.test.ts`, `BuscaConversa.test.ts` (novos), `ConversaAberta.test.ts`

**Interfaces:**
- Consumes: `ConversaHook.mensagens`, `temMaisAntes`, `maisAntigas`; `BalaoMensagem.destacada` (Task 9); `aoBuscar` (Task 10).
- Produces:
  - `normalizarBusca(s: string): string` (minúsculas, sem diacríticos por `NFD` + `\p{M}`, espaços colapsados);
  - `encontrarMensagens(mensagens: MensagemThread[], termo: string): string[]` (ids em ordem cronológica; termo com menos de 2 caracteres → `[]`; ignora `apagada` e `corpo` nulo);
  - `BuscaConversa(props: { termo: string; aoMudar(t: string): void; total: number; posicao: number; aoAnterior(): void; aoProximo(): void; aoFechar(): void; temMaisAntes: boolean; aoCarregarAntigas(): void })`.

Barra: `flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 bg-surface px-3`; campo `h-8 flex-1 rounded-item bg-surface-muted px-3 text-[13.5px]`, `aria-label="Buscar na conversa"`; contador `font-mono text-xs tabular-nums text-gray-600` "{posicao} de {total}" ou "Nenhuma"; `BotaoIcone` 34 "Anterior" (`IconChevronUp`) e "Próxima" (`IconChevronDown`); "Fechar" (`IconX`). Com `temMaisAntes`, uma linha `text-xs text-gray-600`: "Busca nas mensagens carregadas." + `<Botao variante="fantasma" tamanho="sm">Carregar anteriores</Botao>`. Enter = próxima, Shift+Enter = anterior, Esc fecha.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// busca-conversa.test.ts
const m = (id: string, corpo: string | null, o: Partial<MensagemThread> = {}) => ({ ...MSG, id, corpo, ...o });
it("encontrarMensagens ignora acento, caixa e apagadas", () => {
  const ms = [m("1", "Quero a MATRÍCULA"), m("2", "matricula ok"), m("3", "Matrícula", { apagada: true }), m("4", null), m("5", "outra")];
  expect(encontrarMensagens(ms, "matricula")).toEqual(["1", "2"]);
  expect(encontrarMensagens(ms, " Matrícula  ")).toEqual(["1", "2"]);
  expect(encontrarMensagens(ms, "m")).toEqual([]);
});
it("normalizarBusca", () => { expect(normalizarBusca("  Ação   Já ")).toBe("acao ja"); });

// BuscaConversa.test.ts
it("contador, navegação e aviso das anteriores", () => {
  const h = renderToStaticMarkup(createElement(BuscaConversa, { termo: "matri", aoMudar() {}, total: 3, posicao: 2, aoAnterior() {}, aoProximo() {}, aoFechar() {}, temMaisAntes: true, aoCarregarAntigas() {} }));
  for (const t of ["2 de 3", 'aria-label="Anterior"', 'aria-label="Próxima"', 'aria-label="Fechar busca"', "Busca nas mensagens carregadas.", "Carregar anteriores", "h-11"]) expect(h).toContain(t);
  expect(renderToStaticMarkup(createElement(BuscaConversa, { termo: "zz", aoMudar() {}, total: 0, posicao: 0, aoAnterior() {}, aoProximo() {}, aoFechar() {}, temMaisAntes: false, aoCarregarAntigas() {} }))).toContain("Nenhuma");
});
```

No `ConversaAberta.test.ts`, com `tela-sem-dom`: abrir a busca pelo `aoBuscar` do cabeçalho, mudar o termo para `"olá"` e conferir que o `BalaoMensagem` de `m1` recebe `destacada: true`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/busca-conversa.test.ts" "src/app/(app)/inbox/BuscaConversa.test.ts" "src/app/(app)/inbox/ConversaAberta.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`ConversaAberta` guarda `termo` e `posicao`. O achado atual rola até `[data-mensagem-id="<id>"]` com `scrollIntoView({ block: "center" })` dentro da `rolagem`. Se o item não estiver montado pela `VirtualList`, rola pelo índice estimado e tenta de novo no próximo frame. ⌘F/Ctrl+F só é capturado com a conversa aberta e o foco dentro da coluna da conversa; fora dela, o navegador busca como sempre.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/botoes.test.ts src/app/campos.test.ts src/app/fundo-sobre-pagina.test.ts`
Expected: PASS (campo de busca registrado nas travas de campos e de fundo, se acusado).

- [ ] **Step 5: Aceite visual**

Estado `busca-conversa` (app; Beatriz, termo `desconto`), desktop e celular, nos 2 temas. Sem referência do protótipo (só ícone); conferir que a barra não muda a altura do cabeçalho de 68.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox" scripts/visual src/app/campos-mapa.ts src/app/fundo-sobre-pagina.test.ts docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): busca na conversa nas mensagens carregadas (D19)" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-12"></a>
### Task 12: Rodapé e compositor

**Files:**
- Create: `src/app/(app)/inbox/RodapeConversa.tsx`
- Modify: `src/components/conversa/Compositor.tsx:20-36` (props), `:90-111` (estados), `:208-295` (render)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:162-175` (`<Compositor modo="responder">` → `<RodapeConversa modo="compositor">`)
- Modify: `src/app/botoes-mapa.ts:1274-1277`, `src/app/botoes.test.ts:52-53, 91`
- Modify: `scripts/visual/capturar-inbox.mjs` (`nota`)
- Test: `RodapeConversa.test.ts` (novo), `src/components/conversa/Compositor.test.ts`, `ConversaAberta.test.ts`

**Interfaces:**
- Consumes: `Compositor` (modos `responder` e `nota`, `Compositor.tsx:22`); `DialogoAgendar` pelo `useAcoesAtendimento` (Task 10), exposto como `acoes.abrirAgendar`, acréscimo ao retorno.
- Produces:
  - `RodapeConversa(props: { modo: "travado" | "compositor"; abaInicial?: "responder" | "nota"; atendimentoId: string; podeEnviar: boolean | null; falhaPermissao?: () => void; capacidades: readonly RecursoMotor[]; aoEnviarTexto(t: string): Promise<Resultado<unknown>>; aoEnviarMidia(url: string, legenda: string): Promise<Resultado<unknown>>; aoNota(t: string): Promise<Resultado>; respostas?: readonly RespostaDoCompositor[]; variaveisResposta?: PropsCompositor["variaveisResposta"]; aoAgendar?: () => void; travado?: { texto: string; aoNota(): void; aoAssumir?: () => void } })`;
  - `Compositor` + `aoAgendar?: () => void`.

Valores (HTML:351, 408-431, 1105-1109):
- rodapé `shrink-0 border-t border-gray-200 bg-surface px-4 pb-3.5 pt-2.5` (sem `bg-composer`);
- abas `flex gap-1.5 mb-2`; aba `h-[26px] rounded-[7px] px-2.5 text-xs font-semibold`:
  - Responder ativa `bg-brand-bg text-brand-700`;
  - Nota ativa `bg-amber-50 text-amber-700` com `IconLock` 11;
  - inativa `text-gray-600`;
  - `role="tab"`, `aria-selected`;
  - dica `ml-auto self-center text-xs text-gray-400` "/ respostas rápidas" (o "@ mencionar" entra com a menção, D20, E2);
- linha `flex items-end gap-2`:
  - Anexar e Agendar: `h-11 w-10 rounded-full text-gray-600 hover:bg-highlight`, ícones 19 e 18;
  - Emojis (ERP);
  - campo `min-h-[44px] max-h-[140px] flex-1 resize-none rounded-lg border border-gray-200 bg-surface-muted px-3.5 py-[11px] text-sm leading-5`; em nota, `border-amber-600 bg-amber-50`; placeholder `Escreva uma mensagem` / `Escreva uma nota interna`;
  - Enviar `grid h-11 w-11 place-items-center rounded-full bg-brand-solid text-on-brand` com `IconSend` 18 e `<span className="sr-only">Enviar</span>`; em nota, `bg-amber-700 text-surface`;
  - microfone com o campo vazio e fora da nota, no mesmo círculo `text-gray-600`;
- aviso de nota `AVISO_NOTA` (E0) em `mb-2 text-xs text-amber-700` (sem a caixa `bg-highlight`);
- sem envio, carregando e falha (`Compositor.tsx:90-111`): `border-t border-gray-200 bg-surface px-4 py-3 text-sm`, com os mesmos textos;
- travado (HTML:408-415): `flex min-h-12 items-center gap-3 rounded-lg bg-ai-50 py-[7px] pl-3.5 pr-2`, `IconSparkles` 17 `text-ai-700`, texto 13.5 truncado, `<Botao variante="neutro">` "Nota interna" com `IconNote` e `<Botao>` "Assumir para responder" quando `aoAssumir`. Na E1, `ConversaAberta` sempre usa `modo="compositor"` (D3).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// RodapeConversa.test.ts
const base = { atendimentoId: "a1", podeEnviar: true, capacidades: [], aoEnviarTexto: vi.fn(), aoEnviarMidia: vi.fn(), aoNota: vi.fn() };
it("compositor: abas Responder e Nota interna, dica de respostas rápidas", () => {
  const h = renderToStaticMarkup(createElement(RodapeConversa, { ...base, modo: "compositor" } as never));
  expect(h).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*class="[^"]*bg-brand-bg[^"]*text-brand-700[^"]*"[^>]*>Responder/);
  expect(h).toContain("Nota interna"); expect(h).toContain("/ respostas rápidas"); expect(h).not.toContain("@ mencionar");
  for (const c of ["h-[26px]", "rounded-[7px]", "px-4", "pb-3.5", "pt-2.5", "bg-surface"]) expect(h).toContain(c);
  expect(h).not.toContain("bg-composer");
});
it("abaInicial nota: campo e enviar em tons de aviso", () => {
  const h = renderToStaticMarkup(createElement(RodapeConversa, { ...base, modo: "compositor", abaInicial: "nota" } as never));
  expect(h).toContain("border-amber-600"); expect(h).toContain("bg-amber-50"); expect(h).toContain("Escreva uma nota interna");
});
it("travado: barra da IA com Nota interna e Assumir para responder, sem campo", () => {
  const h = renderToStaticMarkup(createElement(RodapeConversa, { ...base, modo: "travado", travado: { texto: "Aria pausou e aguarda sua aprovação acima.", aoNota() {}, aoAssumir() {} } } as never));
  for (const t of ["bg-ai-50", "Aria pausou e aguarda sua aprovação acima.", "Nota interna", "Assumir para responder", "min-h-12"]) expect(h).toContain(t);
  expect(h).not.toContain("<textarea");
});
```

`Compositor.test.ts`:
- `:226` e `:253` trocam "Digite uma mensagem" por "Escreva uma mensagem";
- novo `it("enviar é círculo de 44 com rótulo acessível; agendar aparece com aoAgendar")`: `toContain("h-11 w-11")`, `toContain("rounded-full")`, `toContain('<span class="sr-only">Enviar</span>')`, `toContain('aria-label="Agendar mensagem"')` só com `aoAgendar`;
- os `clicarBotao(tela(), "Enviar")` continuam, porque o texto existe no `sr-only`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/RodapeConversa.test.ts" src/components/conversa/Compositor.test.ts "src/app/(app)/inbox/ConversaAberta.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

O `RodapeConversa` guarda a aba em estado e passa `modo` ao `Compositor`; o rascunho continua separado por modo (`Compositor.tsx:38`). O `Compositor` deixa de usar `<Botao>` no Enviar e passa a usar `<button>` circular.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa "src/app/(app)/inbox" src/app/botoes.test.ts src/app/fundo-sobre-pagina.test.ts src/app/campos-texto.test.ts`
Expected: PASS. Ajustes de trava:
- `botoes-mapa.ts:1274-1277` perde `<Botao> Enviar → primario/md`;
- `NAO_SAO_BOTOES_DE_ACAO["src/components/conversa/Compositor.tsx"]` vai de 5 para 7 (+ enviar e agendar);
- `CONTROLES_QUE_NAO_SAO_BOTAO` do Compositor ganha `"Enviar"` e `"Agendar mensagem"`;
- `RodapeConversa.tsx` entra com as abas (`["Responder", "Nota interna"]`) e, no mapa, `Nota interna → neutro/md` e `Assumir para responder → primario/md`.

- [ ] **Step 5: Aceite visual**

Estados `humano-compositor` e `nota` (ref. `telas/prototipo-estado-nota-interna.png`), desktop e celular, nos 2 temas.

Diferenças justificadas:
- botão de tarefa (E2);
- Emoji e microfone (ERP, doc 03);
- "@ mencionar" (E2).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox" src/components/conversa src/app/botoes-mapa.ts src/app/botoes.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): rodapé com abas Responder e Nota e compositor do protótipo" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-13"></a>
### Task 13: Painel do contato com abas (casca)

**Regra das abas na E1:** uma aba só entra na barra quando a etapa que a implementa já entregou o conteúdo, e `abasDoPainel` aplica o D13 (padrão: abas comerciais só na finalidade comercial). `ABAS_ENTREGUES = ["detalhes"]` na E1. A E2 acrescenta `"oportunidades"` (só `COMERCIAL`) e `"atividade"`; a E4 acrescenta `"insights"` se o D12 decidir. Na E1, a barra mostra só "Detalhes".

**Files:**
- Create: `src/app/(app)/inbox/PainelContato.tsx`, `src/app/(app)/inbox/LinhaCampo.tsx`
- Modify: `src/server/inbox/paineis.ts:8-16` (tipo), `:30-40` (`carregarPainel` com `tags`)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:190-211` (conteúdo do painel)
- Modify: `src/app/(app)/inbox/PainelSetor.tsx:7-34` (sem `p-4` próprio; linhas no estilo da aba)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:145` (o `PainelTriagem` sai da thread)
- Modify: `scripts/visual/capturar-inbox.mjs` (`painel-detalhes`)
- Test: `PainelContato.test.ts`, `LinhaCampo.test.ts` (novos), `src/server/inbox/paineis.int.test.ts`, `InboxNovo.test.ts:51-59`, `PainelSetor.test.ts`

**Interfaces:**
- Consumes: `Avatar`, `tomDoAvatar` (Task 4); `PainelSetor`, `PainelAria`, `AcoesContato`, `OptOutContato`, `PainelTriagem` (sem mudança de props); `PessoaTag` (`schema.prisma:9469-9480`).
- Produces:
  - `type IdAbaPainel = "detalhes" | "oportunidades" | "insights" | "atividade"` (índice);
  - `type TagPainel = { rotulo: string; ia: boolean }`, `type ContatoPainel = { id: string; nome: string; subtitulo: string; tags: TagPainel[]; quadrado?: boolean }`, `type AbaPainel = { id: IdAbaPainel; rotulo: string; contagem?: number }`;
  - `ABAS_ENTREGUES: readonly IdAbaPainel[]`, `abasDoPainel(finalidade: string): AbaPainel[]`;
  - `PainelContato(props: { contato: ContatoPainel; abas: AbaPainel[]; abaAtiva: IdAbaPainel; aoTrocarAba(id: IdAbaPainel): void; children: ReactNode; aoFechar?: () => void })`, `AbasPainel(props: { abas; abaAtiva; aoTrocarAba })`;
  - `LinhaCampo(props: { icone: ReactNode; valor: ReactNode; rotulo: string; ia?: boolean })`;
  - `PainelSetor.tags?: TagPainel[]` e `tagsDaPessoa(pessoaId: string): Promise<TagPainel[]>` (ordem por nome; `ia = criadoPorId === null`, D20 padrão). Só no `COMERCIAL` com `pessoaId` visível (`paineis.ts:53-60`); nos outros setores, `[]`.

Valores (HTML:472-495, 512-522):
- aside `flex min-h-0 flex-col`;
- topo `relative flex flex-col items-center gap-3.5 border-b border-gray-200 px-6 pb-[26px] pt-9`;
- `aoFechar` → `BotaoIcone` 36 `absolute left-2.5 top-2.5` "Voltar para a conversa" (`IconChevronLeft` 20) abaixo de 700 e "Fechar painel" (`IconX`) de 700 a 1099; nada a partir de 1100;
- avatar 132; nome `text-xl font-medium leading-[1.25] text-balance text-center`; subtítulo `text-sm text-gray-600`;
- tags `flex flex-wrap justify-center gap-1.5`, tag `inline-flex h-[26px] items-center gap-[5px] rounded-[13px] bg-surface-muted px-2.5 text-[12.5px]` + `IconSparkles` 11 `text-ai-700` com `aria-label="Criada pela Aria"`;
- abas `flex border-b border-gray-200 px-2 pt-1.5`, aba `flex h-[38px] flex-auto items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1.5 text-[13px] font-semibold`, ativa `border-brand-solid text-gray-800`, inativa `border-transparent text-gray-600`; contagem `rounded-[10px] bg-ai-50 px-1.5 py-px font-mono text-[10.5px] font-medium text-ai-700`; `role="tablist"`/`"tab"`, `aria-selected`;
- conteúdo `flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] pb-6 pt-4`, com divisórias `-mx-[18px] h-px bg-gray-200` entre seções;
- `LinhaCampo`: `flex min-h-[52px] items-center gap-4 py-[9px]`, ícone `w-5 text-gray-600` 18, valor `text-[14.5px] [overflow-wrap:anywhere]`, rótulo `text-[12.5px] text-gray-600`, ✦ 12 `text-ai-700`.

`ContatoPainel` na E1: `nome = contatoNome`, `subtitulo = "{setor} · {numeroRotulo}"`, `tags = painel.tags ?? []`, `quadrado = false` (B2B na E2).

Aba Detalhes na E1, nesta ordem:
1. `LinhaCampo` WhatsApp (`IconPhone`, valor `font-mono` com `contatoTelefone`, só quando não vazio: regra 5);
2. `PainelSetor`;
3. `PainelAria` (fica aqui até a E3; sair do painel tiraria a aprovação de quem a tem hoje);
4. `AcoesContato`;
5. `OptOutContato` (não em grupo);
6. `PainelTriagem` (triagem e revisões, quando houver).

O lápis "Editar contato" e o "+ tag" ficam para a E2.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// PainelContato.test.ts
const contato = { id: "c1", nome: "Mariana Costa", subtitulo: "Comercial · Central da escola", tags: [{ rotulo: "Inglês", ia: false }, { rotulo: "Noite", ia: true }] };
const p = (o: object = {}) => renderToStaticMarkup(createElement(PainelContato, { contato, abas: abasDoPainel("COMERCIAL"), abaAtiva: "detalhes", aoTrocarAba() {}, children: "conteudo", ...o } as never));
it("cabeçalho: avatar 132, nome 20/500, subtítulo, tags com ✦ da IA", () => {
  const h = p();
  for (const c of ["h-[132px]", ">MC<", "text-xl", "font-medium", "Comercial · Central da escola", "h-[26px]", "rounded-[13px]", "Inglês", 'aria-label="Criada pela Aria"', "pt-9", "pb-[26px]"]) expect(h).toContain(c);
});
it("regra da E1: só Detalhes", () => {
  expect(ABAS_ENTREGUES).toEqual(["detalhes"]);
  expect(abasDoPainel("COMERCIAL")).toEqual([{ id: "detalhes", rotulo: "Detalhes" }]);
  expect(abasDoPainel("PEDAGOGICO")).toEqual([{ id: "detalhes", rotulo: "Detalhes" }]);
  expect(p()).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*border-brand-solid[^>]*>Detalhes/);
});
it("aba com contagem mono no tom da IA", () => {
  expect(renderToStaticMarkup(createElement(AbasPainel, { abas: [{ id: "atividade", rotulo: "Atividade", contagem: 5 }], abaAtiva: "atividade", aoTrocarAba() {} }))).toMatch(/bg-ai-50[^"]*font-mono|font-mono[^"]*bg-ai-50/);
});
it("voltar só com aoFechar", () => {
  expect(p()).not.toContain('aria-label="Voltar para a conversa"');
  expect(p({ aoFechar() {} })).toContain('aria-label="Voltar para a conversa"');
});

// LinhaCampo.test.ts
it("linha de 52 px com ícone, valor e rótulo", () => {
  const h = renderToStaticMarkup(createElement(LinhaCampo, { icone: "☎", valor: "+55 11 98421-3307", rotulo: "WhatsApp", ia: true }));
  for (const c of ["min-h-[52px]", "text-[14.5px]", "text-[12.5px]", "WhatsApp", "text-ai-700"]) expect(h).toContain(c);
});

// paineis.int.test.ts
it("comercial com pessoa visível traz as tags em ordem, ✦ nas sem autor; outros setores sem tags", async () => {
  /* cenário comercial existente + Pessoa ligada ao lead + Tag "Noite" (criadoPorId null) e "Inglês" (criadoPorId do vendedor) */
  expect((await carregarPainel(sess(vendedor), at.id))!.tags).toEqual([{ rotulo: "Inglês", ia: false }, { rotulo: "Noite", ia: true }]);
  expect((await carregarPainel(sess(financeiro), atFin.id))!.tags).toEqual([]);
});

// InboxNovo.test.ts (:51-55 reescrito)
it("conversa aberta: painel com avatar, aba Detalhes e o conteúdo atual do setor", () => {
  const h = html({ selecionado: "a1" });
  for (const t of ['aria-label="Painel do contato"', "Detalhes", "Registrar opt-out"]) expect(h).toContain(t);
});
it("grupo: painel sem opt-out", () => {
  expect(html({ selecionado: "a1", extra: { inicial: { itens: [{ ...item("a1", "Turma"), grupo: true }], proximo: null } } })).not.toContain("Registrar opt-out");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox"` e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox/paineis.int.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`InboxNovo` monta `<PainelContato contato=… abas={abasDoPainel(atual.finalidade)} abaAtiva={aba} aoTrocarAba={setAba} aoFechar={…}>` com o conteúdo de Detalhes. `aba` volta a `"detalhes"` ao trocar de conversa. `PainelSetor` passa a usar `dl` com `dt text-[12.5px] text-gray-600` e `dd text-sm`, sem padding externo; os textos não mudam.

- [ ] **Step 4: Rodar e ver passar**

Run: os comandos do Step 2 e `node_modules/.bin/vitest run src/app/botoes.test.ts src/app/fundo-sobre-pagina.test.ts src/app/estados-vazios.test.ts`
Expected: PASS. As abas entram em `CONTROLES_QUE_NAO_SAO_BOTAO` (`["key a.id"]`, como `FichaContato.tsx`); a tag `bg-surface-muted` entra em `DENTRO_DE_SUPERFICIE`.

- [ ] **Step 5: Aceite visual**

Estados `painel-detalhes` (ref. `telas/prototipo-estado-painel-detalhes.png`), `tablet-painel` e `celular-painel`, nos 2 temas.

Diferenças justificadas:
- só a aba Detalhes;
- conteúdo do ERP no lugar do cartão de oportunidade e da lista de campos (E2);
- sem lápis nem "+ tag" (E2);
- subtítulo por setor e número (E2 troca pelo produto).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox" src/server/inbox/paineis.ts src/server/inbox/paineis.int.test.ts src/app/botoes.test.ts src/app/fundo-sobre-pagina.test.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): painel do contato com avatar, tags e abas (casca)" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-14"></a>
### Task 14: Estados — sem seleção, carregando, erro, painel vazio

**Files:**
- Modify: `src/components/Esqueleto.tsx:116-140` (`EsqueletoConversas`), novos `EsqueletoThread` e `EsqueletoPainel`
- Modify: `src/app/(app)/inbox/loading.tsx` (sem mudança de código; o esqueleto muda)
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:197-199` (painel carregando, falha e vazio), `:221-228` (sem seleção)
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:146-147` (anteriores, erro e carregando)
- Modify: `src/app/(app)/inbox/PainelSetor.tsx:8` (texto vazio com `text-gray-400`)
- Modify: `scripts/visual/capturar-inbox.mjs` (`sem-selecao`, `carregando`, `painel-erro`, `thread-erro`)
- Test: `src/components/Esqueleto.test.ts`, `InboxNovo.test.ts`, `InboxNovo.interacao.test.ts`, `ConversaAberta.test.ts`, `src/app/borda-rota.render.test.ts`

**Interfaces:**
- Consumes: `ConversaHook.carregando`, `erro`, `recarregar`, `temMaisAntes`; `tentarPainelDeNovo` (`InboxNovo.tsx:164`).
- Produces: `EsqueletoThread({ rotulo })`, `EsqueletoPainel({ rotulo })`, ambos com `Carregando` (o anúncio que `Esqueleto.test.ts:24-35` exige).

Estados:
- **Sem seleção** (parte 1 §3.8): no `fundo-conversa`, centralizado, `IconMessages` 40 `text-gray-400`, "Escolha uma conversa" 15/600, "As mensagens aparecem aqui." 13 `text-gray-600`. O `PainelTriagem` continua acima quando houver. Sem painel.
- **Carregando a página** (`EsqueletoConversas`): mesma raiz da página (`-m-4 md:-m-8 flex h-[calc(100dvh-3.5625rem)] sm:h-[calc(100dvh-3.3125rem)] md:h-dvh`):
  - coluna 372: título `h-5 w-32` com `data-esqueleto="titulo"`, busca `h-[38px] rounded-item`, 3 chips `h-7 w-20 rounded-[20px]`, 6 itens com círculo 44 e 2 linhas;
  - conversa `fundo-conversa` com cabeçalho `h-[68px] bg-surface border-b` e 4 balões alternados;
  - painel 348 `hidden min-[1200px]:flex` com círculo 132 e 2 linhas.
- **Carregando a thread:** `conversa.carregando && !conversa.mensagens.length` → `EsqueletoThread` (4 balões, `rotulo="mensagens"`).
- **Carregando o painel:** `painelSetor?.id !== atual.id` → `EsqueletoPainel` (`rotulo="detalhes"`), no lugar de "Carregando detalhes…".
- **Erro do painel:** carregado com `dado === null` → `<div role="alert">` "Não foi possível carregar os detalhes." + `<Botao variante="secundario" tamanho="sm">Tentar de novo</Botao>` (`tentarPainelDeNovo`), no lugar do `PainelSetor` nulo. O compositor segue a regra atual (`InboxNovo.tsx:160-165`).
- **Erro da thread:** `conversa.erro` → pílula `mx-auto my-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700` com `role="alert"`, "Não foi possível carregar as mensagens." e `<Botao variante="fantasma" tamanho="sm">Tentar de novo</Botao>` (`conversa.recarregar`). O detalhe técnico do erro (`ErroFonte`) não aparece.
- **Painel vazio:** `PainelSetor` com dados sem conteúdo ("Sem oportunidade visível para você.") em `text-[12.5px] text-gray-400` (HTML:575, 620).
- **Mensagens anteriores:** botão em pílula `mx-auto mb-2 block rounded-full bg-surface px-3 py-1 text-xs font-medium text-gray-600`.
- **Erro da página** (`error.tsx`): sem mudança (ErroArea, padrão do ERP; parte 1 §3.8).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// Esqueleto.test.ts
it("conversas: tela cheia com coluna 372, cabeçalho 68 e painel 348 a partir de 1200", () => {
  const h = renderToStaticMarkup(createElement(EsqueletoConversas, { rotulo: "conversas" }));
  for (const c of ["md:h-dvh", "min-[1100px]:w-[372px]", "h-[68px]", "fundo-conversa", "w-[348px]", "min-[1200px]:flex", "h-[132px]"]) expect(h).toContain(c);
  expect(titulos(h)).toBe(1);
});
it.each([["thread", EsqueletoThread, "mensagens"], ["painel", EsqueletoPainel, "detalhes"]] as const)("%s anuncia", (_, C, r) => {
  expect(renderToStaticMarkup(createElement(C, { rotulo: r }))).toContain(`Carregando ${r}`);
});

// InboxNovo.test.ts
it("sem seleção: ícone, título e texto no fundo pontilhado", () => {
  const h = html({ selecionado: null });
  expect(h).toContain("Escolha uma conversa"); expect(h).toContain("As mensagens aparecem aqui."); expect(h).toContain("fundo-conversa");
});
it("painel carregando usa o esqueleto", () => { expect(html({ selecionado: "a1" })).toContain("Carregando detalhes"); });

// InboxNovo.interacao.test.ts
it("painel que falha mostra erro com tentar de novo no painel", async () => {
  respostaPainel = () => new Response("", { status: 500 });
  tela(); await esvaziar();
  const t = tela();
  expect(texto(elementos(t).find((n) => n.props.role === "alert")!.props.children)).toContain("Não foi possível carregar os detalhes.");
  clicarBotao(elementos(t).find((n) => n.props["aria-label"] === "Painel do contato")!, "Tentar de novo");
  expect(chamadasPainel.length).toBeGreaterThanOrEqual(1);
});

// ConversaAberta.test.ts
it("thread: carregando mostra esqueleto; erro mostra texto fixo e tentar de novo", () => {
  expect(renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, conversa: { ...conversaVazia, carregando: true } as never })))).toContain("Carregando mensagens");
  const e = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, conversa: { ...conversaVazia, erro: "Falha ao carregar mensagens (500)." } as never })));
  expect(e).toContain("Não foi possível carregar as mensagens."); expect(e).toContain("Tentar de novo"); expect(e).not.toContain("(500)");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/Esqueleto.test.ts "src/app/(app)/inbox" src/app/borda-rota.render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Conforme a lista. `borda-rota.render.test.ts:79` continua com `titulos: 1` e `rotulo: "Carregando conversas"`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/feedback-separado.test.ts`
Expected: PASS (os `<Botao>` novos entram no `botoes-mapa.ts`).

- [ ] **Step 5: Aceite visual**

Estados `sem-selecao`, `carregando` (app com latência de 3 s via CDP `Network.emulateNetworkConditions`, captura 300 ms depois da navegação cliente para `/inbox`), `painel-erro` (`page.route("**/api/inbox/atendimentos/*/painel", r => r.fulfill({ status: 500 }))`), `thread-erro` (o mesmo em `*/mensagens*`) e `lista-vazia`, nos 3 tamanhos e 2 temas. O protótipo não prevê esses estados; o revisor confere a coerência com a casca.

- [ ] **Step 6: Commit**

```bash
git add src/components/Esqueleto.tsx src/components/Esqueleto.test.ts "src/app/(app)/inbox" src/app/botoes-mapa.ts scripts/visual docs/planejamento/quadro-entregas.md
git commit -m "feat(inbox): estados sem seleção, carregando, erro e painel vazio" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-15"></a>
### Task 15: Fecho — componentes mortos, travas e conferência visual final

**Files:**
- Delete: `src/app/(app)/inbox/PainelFiltros.tsx` (substituído pela coluna, Task 8); os testes de `PainelFiltros` em `ListaAtendimentos.test.ts:154-169` passam para `filtros-url.test.ts` ou saem
- Delete: o export do componente `AcoesAtendimento` (se ainda existir depois da Task 10); o arquivo fica com o hook e os diálogos
- Check: `contarNaoLidas` (`src/server/whatsapp/consultas-inbox.ts:78`), `ItemLista` e `Chip` (`grep`: `ItemLista` e `Chip` seguem usados em Funil, Tarefas e Sino, e ficam)
- Modify: `src/app/botoes.test.ts`, `src/app/botoes-mapa.ts`, `src/app/estados-vazios-mapa.ts`, `src/app/fundo-sobre-pagina.test.ts` (sobras das listas), `src/app/(app)/inbox/sem-polling.test.ts` (inclui `src/lib/eventos-inbox.ts` e `src/components/SeloNaoLidasInbox.tsx` na varredura)
- Create: `src/app/(app)/inbox/inbox-e1.test.ts` (trava de mortos e de mono)
- Modify: `docs/planejamento/quadro-entregas.md` (fechamento da seção da E1)

**Interfaces:**
- Consumes: tudo das Tasks 1–14.
- Produces: o Inbox E1 completo; as E2–E4 partem daqui.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// inbox-e1.test.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
it("componentes substituídos não voltam", () => {
  expect(existsSync("src/app/(app)/inbox/PainelFiltros.tsx")).toBe(false);
  expect(existsSync("src/components/conversa/NotaNaThread.tsx")).toBe(false);
  expect(readFileSync("src/app/(app)/inbox/AcoesAtendimento.tsx", "utf8")).not.toMatch(/export function AcoesAtendimento\(/);
  expect(readFileSync("src/app/(app)/inbox/page.tsx", "utf8")).not.toMatch(/<h1|NovoAtendimento opcoes/);
});
it("horas e contadores do inbox usam font-mono com tabular-nums", () => {
  for (const f of ["ItemConversa.tsx", "ChipsFiltro.tsx"]) expect(readFileSync(`src/app/(app)/inbox/${f}`, "utf8")).toMatch(/font-mono[^"`]*tabular-nums|tabular-nums[^"`]*font-mono/);
  expect(readFileSync("src/components/conversa/BalaoMensagem.tsx", "utf8")).toMatch(/font-mono[^"`]*tabular-nums/);
});
it("nenhum uppercase nas telas do inbox (sentence case, docs/18)", () => {
  const arquivos = (readdirSync("src/app/(app)/inbox") as string[]).filter((f) => f.endsWith(".tsx"));
  expect(arquivos.filter((f) => /\buppercase\b/.test(readFileSync(`src/app/(app)/inbox/${f}`, "utf8")))).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/inbox-e1.test.ts"`
Expected: FAIL (`PainelFiltros.tsx` ainda existe).

- [ ] **Step 3: Remover e limpar**

Apagar os arquivos. Rodar `node_modules/.bin/tsc --noEmit` e corrigir os imports órfãos. Remover das travas as entradas que ficaram sem arquivo: as próprias travas acusam sobras (`fundo-sobre-pagina.test.ts:79`, `botoes.test.ts` e `estados-vazios.test.ts` conferem sobra).

- [ ] **Step 4: Gate completo**

Run, cada um com saída 0:
- `node_modules/.bin/tsc --noEmit`
- `npm test`
- `npm run lint` (no máximo 40 avisos)
- `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox`

- [ ] **Step 5: Conferência visual final**

Rodar a demo de novo (as integrações truncam o banco) e `node scripts/visual/capturar-inbox.mjs --alvo ambos --estado todos`.

Montar no PR uma tabela por estado × tamanho × tema, com o par app/protótipo. Cada diferença precisa estar na lista "diferenças justificadas" de alguma task ou ganhar uma issue nova. Medir em 1440×900, nos dois temas:
- lista 372;
- painel 348;
- cabeçalho 68;
- busca 38;
- chip 28;
- item com padding 11/10;
- balão até 560;
- compositor de 44;
- `scrollHeight <= innerHeight`.

- [ ] **Step 6: Commit**

```bash
git add -A "src/app/(app)/inbox" src/app src/components src/lib docs/planejamento/quadro-entregas.md
git commit -m "chore(inbox): remove componentes substituídos e fecha a E1" -m "<trailer de co-autoria do projeto>"
```

---

## Self-review

**Cobertura da parte 1:**
- §1.1 cores: Task 1 e Global Constraints.
- §1.2 tipografia (mono, pesos, sentence case): Tasks 1 e 15.
- §1.3 raios e §1.4 espaçamentos: valores em cada task.
- §1.5 sombras: Global Constraints, Tasks 3 e 9.
- §1.6 ícones: tabela de mapeamento aplicada nas Tasks 7–13.
- §2 layout (tela cheia, moldura, grade, painel alternável, tablet, celular, cabeçalhos de 68, rolagem, fundo pontilhado): Tasks 1, 3, 10 e 14.
- §3.1 coluna: Task 8; o cartão "Aria ativa" é só slot (E3).
- §3.2 item: Tasks 4 e 7.
- §3.3 cabeçalho: Task 10; a faixa de handoff é E3.
- §3.4 thread: Task 9; cartões de tarefa e de agendada são E2 e E4.
- §3.5 cartão da Aria: E3.
- §3.6 rodapé: Task 12.
- §3.7 painel: Task 13, com as abas extras e a lista de campos na E2.
- §3.8 estados: Task 14.
- §4 papéis: o desenho não muda por papel; o link de números só para admin está na Task 8.
- §5 travas (design-system, oklch, contraste, paleta, tipografia, fundo-sobre-pagina, botoes, testes do inbox): Tasks 1, 4, 7, 8, 10, 12, 13 e 15.
- §6 ordem: respeitada, com o harness na Task 2 e o selo do menu na Task 6 (pedido do coordenador).

**Consistência com o contrato:** `ColunaConversas`, `ChipsFiltro`, `ItemConversa`, `BadgeEstado`, `estadoVisualItem`, `CabecalhoConversa`, `MenuConversa`, `RodapeConversa`, `PainelContato`, `IdAbaPainel`, `BalaoMensagem.autor`, `EventoSistema`, `SeparadorDia`, `Avatar.tom/selo` e `InboxNovo.abrirPainelPadrao` estão com o nome e as props do índice; o resto está em "Acréscimos ao contrato". `TomEstado` só ganhou um valor. Os produtos da E0 (`itensDaThread`, `ItemThread`, `NotaInternaThread.origem`, `prazoEstourado`, `useAgoraDosPrazos`, `marcarAtendimentoLido`, `criarMarcadorDeLeitura`, raiz `min-h-0 flex-1`, chevron `float-right`) são consumidos sem renomear.

**Proporção:** o plano tem mais linhas que a spec, porque a spec descreve diferenças e o plano fixa medidas, nomes e testes de 15 entregas. Não há corpo de componente; os únicos blocos de algoritmo são o hash do avatar e a regex da Task 2. Os demais blocos de código são testes.

---

## Issues

Formato do índice. Arquivo irmão para criação em lote: `2026-10-22-inbox-prototipo-02-design.issues.json`.

### [Inbox E1.1] Tokens, fonte mono e travas

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Criar os tokens de avatar (8 tons com branco ≥ 4,5:1), balão da IA, nota e pontos, a classe `fundo-conversa` e a fonte JetBrains Mono (`--font-mono`), atualizando as travas de design system, contraste e tipografia.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-1`

**Arquivos:**
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/app/fonts/`
- `src/app/contraste-mapa.ts`
- `src/app/design-system.test.ts`
- `src/app/contraste.test.ts`
- `src/app/tipografia.test.ts`
- `docs/18-design-system.md`

**Critérios de aceite:**
- Testes da Task 1 verdes; tokens e fonte conferidos no DevTools nos dois temas.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E0 (plano 01). O integrador entrega `jetbrains-mono-latin-wght.woff2`, a licença e o sha256.

### [Inbox E1.2] Harness de comparação visual

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Criar `scripts/visual/demo-inbox.ts` (dados de demonstração só no banco descartável) e `scripts/visual/capturar-inbox.mjs` (Playwright, app e protótipo, 3 tamanhos × 2 temas, unpkg servido do node_modules).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-2`

**Arquivos:**
- `scripts/visual/demo-inbox.ts`
- `scripts/visual/nucleo-captura.mjs`
- `scripts/visual/nucleo-captura.d.mts`
- `scripts/visual/capturar-inbox.mjs`
- `scripts/visual/README.md`
- `src/test/visual-inbox.test.ts`

**Critérios de aceite:**
- `src/test/visual-inbox.test.ts` verde; 12 capturas do estado `conversa` em `tmp/visual/`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** O integrador acrescenta as devDependencies `playwright-core@1.56.1`, `@babel/standalone@7.29.0` e `lucide-static@0.460.0` (agentes não mudam o package.json).

### [Inbox E1.3] Casca em tela cheia

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Página só com o `InboxNovo` em tela cheia (sem h1 nem formulário), grade 372/flex/348, painel alternável (automático a partir de 1200), sobreposição de 348 px no tablet e vistas no celular.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-3`

**Arquivos:**
- `src/app/(app)/inbox/page.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/ConversaAberta.tsx`
- `src/app/botoes.test.ts`
- `scripts/visual/capturar-inbox.mjs`

**Critérios de aceite:**
- Testes da Task 3; aceite visual de `conversa`, `painel-fechado`, `tablet-painel` e `celular-*`; sem rolagem da página.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.1, E1.2, E0.7.

### [Inbox E1.4] Avatar, BadgeEstado e estado visual

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Avatar com cor por hash, selo da IA e tamanhos 44 e 132; `BadgeEstado` com tons; `estadoVisualItem` e `estadoVisualCabecalho` como funções puras.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-4`

**Arquivos:**
- `src/components/Avatar.tsx`
- `src/app/(app)/inbox/BadgeEstado.tsx`
- `src/app/(app)/inbox/estado-visual.ts`

**Critérios de aceite:**
- Testes da Task 4 (incluindo nome com emoji, grupo e prazo de 30 min).
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.1, E0.5 (`prazoEstourado`).

### [Inbox E1.5] Contagens dos chips e saúde dos números

- **Labels:** `inbox`, `etapa-1`, `back-end`

**Objetivo:** Criar `contarChipsInbox` (5 contagens no escopo, respeitando os outros filtros), `?contagens=1` na rota da lista e `saude` em `opcoesFiltroInbox`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-5`

**Arquivos:**
- `src/server/inbox/filtros.ts`
- `src/server/inbox/consultas-pagina.ts`
- `src/server/inbox/opcoes-filtro.ts`
- `src/app/api/inbox/atendimentos/route.ts`
- `src/app/(app)/inbox/page.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- Testes de integração de `consultas-pagina` e `opcoes-filtro`; testes unitários da Task 5.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** —

### [Inbox E1.6] Selo de não lidas do menu lateral (exceção autorizada)

- **Labels:** `inbox`, `etapa-1`, `back-end`

**Objetivo:** O selo do Inbox no menu lateral passa a contar conversas não lidas pessoais (mesma regra da E0 Task 2) sobre todo o escopo e a se atualizar pelo SSE, com uma conexão por aba.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-6`

**Arquivos:**
- `src/server/inbox/nao-lidas.ts`
- `src/app/api/inbox/nao-lidas/route.ts`
- `src/lib/eventos-inbox.ts`
- `src/components/SeloNaoLidasInbox.tsx`
- `src/components/Sidebar.tsx`
- `src/components/BarraMobile.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/inbox/useEventosInbox.ts`
- `src/app/(app)/inbox/InboxNovo.tsx`

**Critérios de aceite:**
- Testes da Task 6 (integração e unitários); aceite visual do selo caindo ao abrir e subindo com mensagem nova.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E0.2 (`docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-2`), E1.5.

### [Inbox E1.7] Item da lista

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Criar o `ItemConversa` com o desenho do protótipo (avatar 44, nome 14/600, hora mono, contador, pino, silenciada, badges) dentro da `ListaAtendimentos`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-7`

**Arquivos:**
- `src/app/(app)/inbox/ItemConversa.tsx`
- `src/app/(app)/inbox/ListaAtendimentos.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/botoes.test.ts`
- `src/app/estados-vazios-mapa.ts`

**Critérios de aceite:**
- Testes da Task 7; aceite visual de `conversa`, `celular-lista` e `lista-vazia`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.4, E0.1, E0.2, E0.5.

### [Inbox E1.8] Coluna Conversas (D17)

- **Labels:** `inbox`, `etapa-1`, `ui`, `bloqueado-por-decisao`

**Objetivo:** Criar a coluna com cabeçalho, seletor de número (todos os papéis, D17), filtros em popover, nova conversa em popover, busca com ⌘K, chips com contagem e slot `faixaAria`.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-8`

**Arquivos:**
- `src/app/(app)/inbox/ColunaConversas.tsx`
- `src/app/(app)/inbox/ChipsFiltro.tsx`
- `src/app/(app)/inbox/SeletorNumero.tsx`
- `src/app/(app)/inbox/PopoverFiltros.tsx`
- `src/app/(app)/inbox/PopoverColuna.tsx`
- `src/app/(app)/inbox/filtros-url.ts`
- `src/components/BotaoIcone.tsx`
- `src/app/(app)/inbox/NovoAtendimento.tsx`

**Critérios de aceite:**
- Testes da Task 8; aceite visual de `filtros`, `seletor-numero`, `nova-conversa` e `celular-lista`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.3, E1.5, E1.7; D17 (padrão: todos os papéis).

Implementa o padrão da coluna "Padrão enquanto aberta" do índice. Se a decisão vier diferente, a task é revista no mesmo PR que atualiza a tabela.

### [Inbox E1.9] Thread: balões por autor, eventos e separador de dia

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Balões por autor (cliente, humano, Aria, nota tracejada), cauda, sequência, hora mono, `EventoSistema`, `SeparadorDia` no fuso pessoal e fundo pontilhado.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-9`

**Arquivos:**
- `src/components/conversa/BalaoMensagem.tsx`
- `src/components/conversa/itens-thread.ts`
- `src/components/conversa/EventoSistema.tsx`
- `src/components/conversa/SeparadorDia.tsx`
- `src/app/(app)/inbox/ConversaAberta.tsx`

**Critérios de aceite:**
- Testes da Task 9; aceite visual de `humano-compositor` e `celular-conversa`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.1, E1.4, E0.3, E0.4, E0.8.

### [Inbox E1.10] Cabeçalho de 68 px e menu ⋮ (D7, D15, D16)

- **Labels:** `inbox`, `etapa-1`, `ui`, `bloqueado-por-decisao`

**Objetivo:** Cabeçalho de 68 px com Buscar, Transferir, Assumir, Painel e ⋮; as ações atuais vão para o `MenuConversa`, sem status manual (D7), com Bloquear desabilitado (D15) e não lida pessoal (D16).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-10`

**Arquivos:**
- `src/app/(app)/inbox/CabecalhoConversa.tsx`
- `src/app/(app)/inbox/MenuConversa.tsx`
- `src/app/(app)/inbox/AcoesAtendimento.tsx`
- `src/components/Menu.tsx`
- `src/components/Botao.tsx`
- `src/app/botoes-mapa.ts`

**Critérios de aceite:**
- Testes da Task 10; aceite visual de `menu-mais` e `celular-conversa`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.3, E1.4, E1.8; D7, D15, D16 (padrões).

Implementa o padrão da coluna "Padrão enquanto aberta" do índice. Se a decisão vier diferente, a task é revista no mesmo PR que atualiza a tabela.

### [Inbox E1.11] Busca na conversa (D19)

- **Labels:** `inbox`, `etapa-1`, `ui`, `bloqueado-por-decisao`

**Objetivo:** Barra de busca nas mensagens carregadas, sem acento e sem caixa, com navegação, destaque no balão e ⌘F dentro da conversa (D19).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-11`

**Arquivos:**
- `src/app/(app)/inbox/busca-conversa.ts`
- `src/app/(app)/inbox/BuscaConversa.tsx`
- `src/app/(app)/inbox/ConversaAberta.tsx`

**Critérios de aceite:**
- Testes da Task 11; aceite visual de `busca-conversa`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.9, E1.10; D19 (padrão: entra na E1).

Implementa o padrão da coluna "Padrão enquanto aberta" do índice. Se a decisão vier diferente, a task é revista no mesmo PR que atualiza a tabela.

### [Inbox E1.12] Rodapé e compositor

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** `RodapeConversa` com abas Responder e Nota interna, compositor de 44 px com botão de enviar circular e botão de agendar; variante travada pronta e desligada (D3).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-12`

**Arquivos:**
- `src/app/(app)/inbox/RodapeConversa.tsx`
- `src/components/conversa/Compositor.tsx`
- `src/app/(app)/inbox/ConversaAberta.tsx`
- `src/app/botoes-mapa.ts`
- `src/app/botoes.test.ts`

**Critérios de aceite:**
- Testes da Task 12; aceite visual de `humano-compositor` e `nota`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.3, E1.10.

### [Inbox E1.13] Painel do contato com abas (casca)

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Painel com avatar de 132 px, nome, subtítulo, tags só leitura (✦ nas sem autor, D20) e `AbasPainel` com a regra `ABAS_ENTREGUES` (na E1, só Detalhes, com o conteúdo atual).

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-13`

**Arquivos:**
- `src/app/(app)/inbox/PainelContato.tsx`
- `src/app/(app)/inbox/LinhaCampo.tsx`
- `src/server/inbox/paineis.ts`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/PainelSetor.tsx`

**Critérios de aceite:**
- Testes da Task 13 (inclusive `paineis.int.test.ts`); aceite visual de `painel-detalhes`, `tablet-painel` e `celular-painel`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.3, E1.4.

### [Inbox E1.14] Estados: sem seleção, carregando, erro e painel vazio

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Esqueletos da página, da thread e do painel no layout novo; estado sem seleção; erros do painel e da thread com tentar de novo; painel vazio.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-14`

**Arquivos:**
- `src/components/Esqueleto.tsx`
- `src/app/(app)/inbox/InboxNovo.tsx`
- `src/app/(app)/inbox/ConversaAberta.tsx`
- `src/app/(app)/inbox/PainelSetor.tsx`

**Critérios de aceite:**
- Testes da Task 14; aceite visual de `sem-selecao`, `carregando`, `painel-erro`, `thread-erro` e `lista-vazia`.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.8, E1.9, E1.13.

### [Inbox E1.15] Fecho: componentes mortos, travas e conferência visual final

- **Labels:** `inbox`, `etapa-1`, `ui`

**Objetivo:** Remover `PainelFiltros`, `NotaNaThread` e o componente `AcoesAtendimento`, limpar as travas, rodar o gate completo e comparar todos os estados com o protótipo.

**Plano:** `docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md#task-15`

**Arquivos:**
- `src/app/(app)/inbox/PainelFiltros.tsx`
- `src/app/(app)/inbox/inbox-e1.test.ts`
- `src/app/botoes.test.ts`
- `src/app/botoes-mapa.ts`
- `src/app/estados-vazios-mapa.ts`
- `src/app/fundo-sobre-pagina.test.ts`
- `docs/planejamento/quadro-entregas.md`

**Critérios de aceite:**
- `inbox-e1.test.ts`; tsc, npm test, lint e integrações do Inbox com saída 0; tabela de capturas app × protótipo no PR.
- Aceite visual do índice: `scripts/visual/capturar-inbox.mjs` nos estados da task, 1440×900, 1024×768 e 390×844, nos dois temas, com as capturas app × protótipo no PR.
- Gate: `tsc --noEmit`, `npm test` e `npm run lint` com saída 0.

**Dependências:** E1.1 a E1.14.
