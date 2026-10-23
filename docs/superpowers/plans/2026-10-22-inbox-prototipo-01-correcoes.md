# Inbox E0: correções do Inbox atual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os defeitos do Inbox atual que não dependem do protótipo nem de decisão do dono: leitura ao abrir, notas invisíveis, prazo congelado, anexos sem ação, cores que não existem, rolagem dupla e chevron sobre o texto.

**Architecture:** correções pontuais nos arquivos atuais (`src/app/(app)/inbox/`, `src/components/conversa/`, `src/server/whatsapp/`, `src/server/inbox/`). A única peça nova de servidor é a ação `marcarAtendimentoLido`, que junta duas ações que já existiam. O resto liga o que já existe: `marcarLida`, `marcarConversaLida`, `notasDoAtendimento` e `posicaoPopover`. Sem migration, sem schema novo e sem decisão nova de papel.

**Tech Stack:** Next 16 (App Router, server actions), React 18, Prisma/PostgreSQL (`LISTEN/NOTIFY` do barramento do Inbox), Tailwind 3.4 com tokens em `globals.css`, Vitest 4 (unitário sem jsdom com `renderToStaticMarkup` e `src/test/tela-sem-dom.ts`; integração `*.int.test.ts` com `vitest.integration.config.ts`).

**Spec:**
- Contrato comum: `docs/superpowers/plans/2026-10-22-inbox-prototipo-00-indice.md`. Nomes, decisões, faixas de migration, Global Constraints e formato de issues vêm de lá e não são redefinidos aqui.
- `docs/planejamento/inbox-prototipo/analise-parte1-design.md`: resumo executivo (defeitos visuais), §3.2, §3.4, §3.7, §5 e §6 item 0.
- `docs/planejamento/inbox-prototipo/analise-parte2-botoes-funcionalidades.md`: resumo item 4, L28, L35, T4, F9, F10, §10 (última linha), §13 e §14 bloco 1.
- `docs/planejamento/inbox-prototipo/analise-parte3-telas-atalhos.md`: resumo item 4, T18 e T19.
- `docs/planejamento/funcoes-do-inbox.md` (doc 03): "Confirmação de leitura: abrir a conversa marca como lida no WhatsApp (motor)"; contato, enquete e localização valem "para todos com acesso à conversa".

## Global Constraints

Valem todas as Global Constraints do índice (`…-00-indice.md`, seção "Global Constraints"). Além delas, só para a E0:

- **Migration:** nenhuma. A faixa reservada da E0 (`20261023010000`–`20261023090000`) fica sem uso.
- **Polling:** nenhum `setInterval(` nem `router.refresh()` em `src/app/(app)/inbox` (trava `sem-polling.test.ts`). Um timer de uso único (`setTimeout`) até um prazo conhecido é permitido.
- **Tempo real:** o aviso novo usa o canal e o formato atuais (`CANAL_INBOX`, `AvisoInbox` em `src/server/inbox/barramento.ts:5-19`) e só leva ids. Nenhum tipo novo de aviso.
- **Textos fixos desta etapa** (copiar literalmente):
  - rótulo da nota do atendimento: `Nota interna · só equipe`;
  - rótulo da nota do lead: `Nota da oportunidade · só equipe`;
  - aviso de anexo ainda sem formulário: `O envio deste tipo pelo Inbox ainda não está disponível.`
- **Aceite visual:** o harness `scripts/visual/demo-inbox.ts` só nasce na E1 (índice, "Aceite visual"). Nas tasks de UI da E0, o PR leva capturas manuais de antes e depois, feitas com `npm run dev`, em 1440×900, 1024×768 e 390×844, nos dois temas, só dos estados que a task toca.
- **Commits:** onde os comandos deste plano mostram `<trailer de co-autoria do projeto>`, vai o trailer que o índice exige, o mesmo da sessão do executor.
- **Quadro:** a primeira task executada cria, em `docs/planejamento/quadro-entregas.md`, a seção `### Inbox E0: correções do Inbox atual — <data>`. Cada task acrescenta ali um item com arquivos, testes e resultado dos comandos.

## Review Focus

1. **Rajada de mensagens na conversa aberta:** cada `mensagem.nova` da conversa aberta marca de novo como lida. O esperado é ter no máximo uma marcação em voo por conversa e uma repetição no fim, nunca uma chamada ao motor por mensagem. Teste: `marcador de leitura junta chamadas da mesma conversa em voo` (Task 2).
2. **Marcar como lida falhando** (conversa de grupo, escopo revogado, rede): o esperado é que nada quebre nem apareça como erro, e que a lista siga utilizável. Teste: `falha ao marcar é engolida e a repetição pendente ainda roda` (Task 2).
3. **Prazo muito distante** (mais de 24,8 dias): `setTimeout` com atraso acima de 2³¹−1 ms dispara na hora e viraria um laço de renderização. O esperado é um timer limitado ao teto. Teste: `esperaAteProximo limita ao teto do setTimeout` (Task 5).
4. **Nota da Aria desfeita:** o evento `NotaInternaArquivada` não pode deixar a nota voltar à thread. Teste: `nota arquivada não volta na página da thread` (Task 3).
5. **Nota antiga fora da janela carregada:** com `temMaisAntes`, uma nota anterior à primeira mensagem carregada apareceria no topo, fora de ordem. O esperado é que ela só apareça depois de carregar as mensagens daquele período. Teste: `nota anterior à janela só entra quando não há mais antigas` (Task 4).

---

## Mapa de arquivos

| Arquivo | Task | Responsabilidade |
|---|---|---|
| `src/test/literais-string.ts` (novo) | 1 | `literaisDeString(fonte)`: extraído de `src/app/fundo-sobre-pagina.test.ts:47-59` e usado pelas duas travas |
| `src/app/paleta.test.ts` | 1 | Trava ampliada: classe de cor sem tom que não existe no `tailwind.config.ts` |
| `src/server/whatsapp/preferencias.ts` | 2 | `marcarAtendimentoLido(atendimentoId)` |
| `src/server/whatsapp/acoes.ts:330-350` | 2 | `marcarConversaLida` só chama o motor com a sessão `CONECTADO` |
| `src/app/(app)/inbox/marcar-lida.ts` (novo) | 2 | `criarMarcadorDeLeitura`: uma marcação em voo por conversa |
| `src/app/(app)/inbox/InboxNovo.tsx` | 2, 7 | Marca ao abrir e em `mensagem.nova` da aberta; altura sem `100dvh` fixo |
| `src/server/inbox/barramento.ts` | 3 | `avisarAtendimentoAtualizado(tx, a)` |
| `src/server/whatsapp/consultas-inbox.ts:46, 203-209` | 3 | `NotaInternaThread.origem`; `notasInternasDoAtendimento` (consulta sem `"use server"`) |
| `src/server/whatsapp/acoes-conversa.ts:24-63` | 3 | A nota avisa o SSE; `notasDoAtendimento` delega para a consulta |
| `src/server/inbox/consultas-pagina.ts:147-192` | 3 | A página da thread devolve as notas do atendimento e do lead |
| `src/components/conversa/historico-conversa.ts`, `fonte-erp.ts` | 4 | Notas no estado do histórico |
| `src/components/conversa/itens-thread.ts` (novo) | 4 | `itensDaThread`: mensagens e notas intercaladas |
| `src/components/conversa/NotaNaThread.tsx` (novo) | 4 | Bloco da nota na thread (a E1 troca pelo `BalaoMensagem` com `autor: "nota"`) |
| `src/app/(app)/inbox/ConversaAberta.tsx:148-160` | 4 | Thread com mensagens e notas |
| `src/app/(app)/inbox/prazo-vivo.ts` (novo) | 5 | `prazoEstourado`, `proximoEstouroEm`, `esperaAteProximo` e `useAgoraDosPrazos` |
| `src/app/(app)/inbox/ListaAtendimentos.tsx:26-31` | 1, 5 | Contador com `bg-brand-solid`; `agora` vivo |
| `src/components/conversa/Compositor.tsx:54-58, 251-259` | 6 | Contato, Enquete e Localização sempre desabilitados, com motivo |
| `src/app/(app)/inbox/page.tsx:62-77` | 7 | Coluna com a altura da área de conteúdo |
| `src/components/conversa/BalaoMensagem.tsx` | 1, 8 | ✓✓ com `text-brand-700`; chevron fora do texto; menu fixo |

---

<a id="task-1"></a>
### Task 1: Classes de cor inexistentes e trava de paleta ampliada

O regex atual de `paleta.test.ts:19-20` exige tom numérico, e por isso `bg-brand`, `text-brand`, `text-muted-foreground` e `bg-muted` passaram sem gerar CSS. A trava nova olha as classes sem tom dentro dos literais de string de `.ts`/`.tsx` (o parser do TypeScript já ignora comentários). Uma classe só passa se for cor do `tailwind.config.ts` ou um utilitário que não é cor.

**Files:**
- Create: `src/test/literais-string.ts`
- Modify: `src/app/fundo-sobre-pagina.test.ts:42-59` (passa a importar `literaisDeString`)
- Modify: `src/app/paleta.test.ts`
- Modify: `src/app/(app)/inbox/ListaAtendimentos.tsx:42` (`bg-brand` → `bg-brand-solid`)
- Modify: `src/components/conversa/BalaoMensagem.tsx:28` (`text-brand` → `text-brand-700`)
- Modify: `src/components/conversa/EnqueteLeitura.tsx:22` (`bg-brand` → `bg-brand-solid`)
- Modify: `src/app/(app)/inbox/PainelSetor.tsx:10, 15, 21` (`text-muted-foreground` → `text-gray-600`)
- Modify: `src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx:40` (`bg-muted` → `bg-gray-100`, como pede o comentário de `fundo-sobre-pagina.test.ts:10-15`)
- Test: `src/app/paleta.test.ts`, `src/app/(app)/inbox/ListaAtendimentos.test.ts`, `src/components/conversa/BalaoMensagem.test.ts`, `src/app/(app)/inbox/PainelSetor.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `literaisDeString(fonte: string): string[]` em `src/test/literais-string.ts`, com o mesmo comportamento de hoje. `corSemToken(texto: string): string[]`, local de `paleta.test.ts`. A E1 amplia a trava com os tokens novos e não precisa mexer na regra.

- [ ] **Step 1: Escrever os testes que falham**

Em `paleta.test.ts`, acrescentar:

```ts
import { literaisDeString } from "@/test/literais-string";

// Nome de cor sem tom: vale se for cor do config (chave string, ou "<nome>-<chave não numérica>", como brand-bg)
// ou um built-in do Tailwind; senão, só se for um utilitário que não é cor (tabela abaixo, por prefixo).
const CORES_SEM_TOM = new Set<string>([
  "transparent", "current", "inherit", "black", "white",
  ...Object.entries(cores).flatMap(([nome, v]) =>
    typeof v === "string" ? [nome] : Object.keys(v).filter((k) => !/^\d+$/.test(k)).map((k) => `${nome}-${k}`)),
]);
const NAO_E_COR: Record<string, readonly string[]> = {
  text: ["xs", "sm", "base", "lg", "xl", "left", "center", "right", "justify", "start", "end", "ellipsis", "clip", "wrap", "nowrap", "balance", "pretty"],
  bg: ["fixed", "local", "scroll", "bottom", "center", "left", "right", "top", "repeat", "no-repeat", "repeat-x", "repeat-y", "repeat-round", "repeat-space", "auto", "cover", "contain", "none"],
  border: ["t", "r", "b", "l", "x", "y", "s", "e", "solid", "dashed", "dotted", "double", "hidden", "none", "collapse", "separate"],
  ring: ["inset", "offset"], outline: ["none", "dashed", "dotted", "double"], divide: ["x", "y", "solid", "dashed", "dotted", "double", "none"],
  decoration: ["solid", "double", "dotted", "dashed", "wavy", "auto", "clone", "slice"], accent: ["auto"], fill: ["none"], stroke: ["none"],
};
const UTILITARIO_SEM_TOM =
  /(?<![\w-])(?:[a-z0-9-]+:)*!?(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|fill|stroke|placeholder|accent|caret|decoration)-([a-z]+(?:-[a-z]+)*)(?:\/\d+)?(?![\w-])/g;

function corSemToken(texto: string): string[] { /* para cada match: prefixo base = m[1].split("-")[0]; passa se m[2] ∈ CORES_SEM_TOM ou ∈ NAO_E_COR[base]; senão devolve m[0] */ }

it("o detector de cor sem tom pega nome que não existe no config e aceita token e utilitário que não é cor", () => {
  expect(corSemToken(`"rounded-full bg-brand px-1.5 text-on-brand"`)).toEqual(["bg-brand"]);
  expect(corSemToken(`"text-brand hover:text-muted-foreground bg-muted/50 border-brand"`))
    .toEqual(["text-brand", "hover:text-muted-foreground", "bg-muted/50", "border-brand"]);
  expect(corSemToken(`"bg-brand-solid text-on-brand bg-brand-bg bg-surface-raised border-border-soft divide-border-soft bg-ai-solid text-white bg-transparent border-current"`)).toEqual([]);
  expect(corSemToken(`"text-sm text-left border-t border-dashed outline-none ring-inset bg-cover text-start text-2xl"`)).toEqual([]);
  expect(corSemToken(`"text-brand-700 bg-gray-100"`)).toEqual([]); // com tom: regra antiga (violacoesDePaleta)
});

it("nenhum literal de string em .ts/.tsx usa cor sem tom que não exista no tailwind.config", () => {
  const ofensores = fontes.filter(({ arquivo }) => /\.tsx?$/.test(arquivo)).flatMap(({ arquivo, linhas }) =>
    literaisDeString(linhas.join("\n")).flatMap(corSemToken).map((c) => `${arquivo} ${c}`));
  expect(ofensores).toEqual([]);
});
```

O `.css` fica fora da regra nova porque propriedades como `accent-color:` e `outline-offset:` casariam com o regex. A regra antiga continua lendo o `.css`.

Pinos de marcação nos testes dos componentes:

```ts
// ListaAtendimentos.test.ts
it("contador de não lidas usa o fundo sólido da marca (bg-brand não existe)", () => {
  expect(html({ naoLidas: 3 })).toMatch(/<span class="[^"]*bg-brand-solid[^"]*text-on-brand[^"]*">3<\/span>/);
});
// BalaoMensagem.test.ts
it("✓✓ de lida é verde (text-brand-700)", () => {
  expect(html({ status: "LIDA" })).toMatch(/<svg[^>]*class="[^"]*text-brand-700/);
});
// PainelSetor.test.ts
it("rótulo e vazio usam texto secundário (text-gray-600), não classe inexistente", () => {
  const t = h({ setor: "COMERCIAL", oportunidade: { id: "o1", titulo: "Maria", etapa: "PROPOSTA", valor: null }, pessoaId: null });
  expect(t).toMatch(/<dt class="text-gray-600">/); expect(t).not.toContain("muted-foreground");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/(app)/inbox/ListaAtendimentos.test.ts src/components/conversa/BalaoMensagem.test.ts src/app/(app)/inbox/PainelSetor.test.ts`

Expected: FAIL. A varredura lista exatamente estes 7 itens:
- `DevolucaoCredito.tsx bg-muted`;
- `ListaAtendimentos.tsx bg-brand`;
- `PainelSetor.tsx text-muted-foreground` (3 vezes);
- `BalaoMensagem.tsx text-brand`;
- `EnqueteLeitura.tsx bg-brand`.

Os três pinos também falham. Qualquer outro ofensor que aparecer vai para o revisor no PR: não entra na tabela `NAO_E_COR` sem discussão.

- [ ] **Step 3: Extrair `literaisDeString` para `src/test/literais-string.ts` e trocar as 7 classes pelos valores listados em Files**

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e também `node_modules/.bin/vitest run src/app/fundo-sobre-pagina.test.ts src/app/contraste-elementos.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/literais-string.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts "src/app/(app)/inbox/ListaAtendimentos.tsx" "src/app/(app)/inbox/ListaAtendimentos.test.ts" src/components/conversa/BalaoMensagem.tsx src/components/conversa/BalaoMensagem.test.ts src/components/conversa/EnqueteLeitura.tsx "src/app/(app)/inbox/PainelSetor.tsx" "src/app/(app)/inbox/PainelSetor.test.ts" "src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx" docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): classes de cor inexistentes e trava de paleta sem tom" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-2"></a>
### Task 2: Abrir a conversa marca como lida (pessoal, compartilhado e WhatsApp)

Hoje ninguém chama `marcarLida` (`src/server/whatsapp/preferencias.ts:54`) nem `marcarConversaLida` (`src/server/whatsapp/acoes.ts:330`). A primeira grava o `lidaAte` pessoal, de que depende o contador da lista (`preferencias-consulta.ts:10-12`). A segunda zera o contador compartilhado `naoLidas` e manda `message.read` ao motor. Uma ação nova junta as duas. O cliente a chama ao abrir uma conversa (inclusive pelo `?c=` inicial) e a cada `mensagem.nova` da conversa aberta com a aba visível. A ida ao WhatsApp passa a exigir a sessão `CONECTADO`, a mesma regra de `capacidadesDoNumero` (`motor/capacidades.ts:11-14`), com o recurso `confirmacaoLeitura`.

**Files:**
- Modify: `src/server/whatsapp/acoes.ts:339-348`
- Modify: `src/server/whatsapp/preferencias.ts`
- Create: `src/app/(app)/inbox/marcar-lida.ts`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:98-177`
- Test: `src/server/whatsapp/motor/presenca.int.test.ts`, `src/server/whatsapp/preferencias.int.test.ts`, `src/app/(app)/inbox/marcar-lida.test.ts` (novo), `src/app/(app)/inbox/InboxNovo.interacao.test.ts`

**Interfaces:**
- Consumes: `marcarLida(atendimentoId)` e `marcarConversaLida(conversaId)`. O parâmetro desta última é o id do atendimento, apesar do nome (`acoes.ts:335-337`).
- Produces:
  - `marcarAtendimentoLido(atendimentoId: string): Promise<Resultado>` em `preferencias.ts`. Para no primeiro `{ ok: false }`.
  - `criarMarcadorDeLeitura(marcar: (id: string) => Promise<unknown>): (id: string) => void` em `marcar-lida.ts`.
  - `zerarNaoLidas(itens: ItemListaInbox[], id: string): ItemListaInbox[]` e `avisoMarcaLida(a: AvisoInbox, selecionado: string | null): boolean`, exportadas de `InboxNovo.tsx`, como `mesclarPrimeiraPagina`.
  - A E1 (`ItemConversa`) lê o `naoLidas` já zerado.

- [ ] **Step 1: Escrever os testes de servidor que falham**

```ts
// presenca.int.test.ts
it("sessão fora de CONECTADO: zera naoLidas e não chama o motor", async () => {
  const { autor, numero, at } = await cenario();
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao: "CAIU" } });
  expect((await comoUsuario(autor, () => marcarConversaLida(at.id))).ok).toBe(true);
  expect(acao).not.toHaveBeenCalled();
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id } })).naoLidas).toBe(0);
});

// preferencias.int.test.ts (cenário existente; número BAILEYS, então o motor não entra)
it("marcarAtendimentoLido zera a não lida pessoal e o contador compartilhado", async () => {
  const { v1, a, chegaInbound } = await cenario();
  await chegaInbound("oi");
  await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { naoLidas: 1 } });
  comoUsuario(v1);
  expect(await marcarAtendimentoLido(a.id)).toMatchObject({ ok: true });
  expect((await preferenciasDoUsuario(v1.id, [a.id])).get(a.id)?.naoLidas).toBe(0);
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).naoLidas).toBe(0);
});
it("marcarAtendimentoLido fora do escopo não grava nada", async () => {
  const { fora, a } = await cenario();
  await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { naoLidas: 2 } });
  comoUsuario(fora);
  expect(await marcarAtendimentoLido(a.id)).toEqual({ ok: false, erro: "Conversa não encontrada ou fora do seu escopo." });
  expect(await prisma.preferenciaConversaUsuario.count()).toBe(0);
  expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).naoLidas).toBe(2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/motor/presenca.int.test.ts src/server/whatsapp/preferencias.int.test.ts`

Expected: FAIL. O motor é chamado com a sessão `CAIU`, e `marcarAtendimentoLido` não existe.

- [ ] **Step 3: Implementar no servidor**

- Em `marcarConversaLida`, trocar `if (conversa.numero.driver === "MOTOR")` (`acoes.ts:340`) por `if (capacidadesDoNumero(conversa.numero).includes("confirmacaoLeitura"))`, importando de `./motor/capacidades`.
- Em `preferencias.ts`, criar `marcarAtendimentoLido`: chama `marcarLida(id)` e, se o resultado for `ok`, devolve o de `marcarConversaLida(id)`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2. Expected: PASS, incluindo os dois testes que já existiam em `presenca.int.test.ts:30-47`.

- [ ] **Step 5: Escrever os testes de cliente que falham**

`marcar-lida.test.ts`, com promessas adiadas:

```ts
it("marcador de leitura junta chamadas da mesma conversa em voo", async () => {
  const pendentes: (() => void)[] = [];
  const marcar = vi.fn(() => new Promise<void>((ok) => pendentes.push(ok)));
  const m = criarMarcadorDeLeitura(marcar);
  m("a1"); m("a1"); m("a1");
  expect(marcar).toHaveBeenCalledTimes(1);
  m("a2");
  expect(marcar).toHaveBeenCalledTimes(2);           // outra conversa não espera
  pendentes[0](); await Promise.resolve(); await Promise.resolve();
  expect(marcar).toHaveBeenCalledTimes(3);           // uma repetição para as duas pendentes de a1
  expect(marcar.mock.calls.map((c) => c[0])).toEqual(["a1", "a2", "a1"]);
});
it("falha ao marcar é engolida e a repetição pendente ainda roda", async () => {
  const marcar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue({ ok: true });
  const m = criarMarcadorDeLeitura(marcar);
  m("a1"); m("a1");
  await vi.waitFor(() => expect(marcar).toHaveBeenCalledTimes(2));
});
```

`InboxNovo.interacao.test.ts`:
- acrescentar o mock `vi.mock("@/server/whatsapp/preferencias", () => ({ marcarAtendimentoLido: marcar, alternarFixada: vi.fn(), silenciarConversa: vi.fn() }))`, com `marcar = vi.fn(async () => ({ ok: true }))` em `vi.hoisted`;
- acrescentar `vi.stubGlobal("document", { visibilityState: "visible" })` no `beforeEach`;
- dar `naoLidas: 2` ao `a2`.

```ts
describe("InboxNovo: abrir marca como lida", () => {
  it("?c= inicial marca a conversa uma vez", () => {
    tela(); tela();
    expect(marcar).toHaveBeenCalledTimes(1); expect(marcar).toHaveBeenCalledWith("a1");
  });
  it("trocar de conversa marca a nova e zera o contador dela na lista na hora", () => {
    const lista = () => elementos(tela()).find((n) => n.type === ListaAtendimentos)!.props as PropsListaAtendimentos;
    lista().aoSelecionar("a2");
    tela(); // o efeito de [selecionado] roda no render seguinte
    expect(marcar).toHaveBeenLastCalledWith("a2");
    expect(lista().itens.find((i) => i.id === "a2")!.naoLidas).toBe(0);
  });
  it("mensagem.nova da conversa aberta marca de novo; de outra conversa ou com a aba oculta, não", () => {
    tela(); marcar.mockClear();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a2", mensagemId: "x", conversaId: "c" });
    expect(marcar).not.toHaveBeenCalled();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "y", conversaId: "c" });
    expect(marcar).toHaveBeenCalledWith("a1");
    marcar.mockClear(); vi.stubGlobal("document", { visibilityState: "hidden" });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "z", conversaId: "c" });
    expect(marcar).not.toHaveBeenCalled();
  });
});
```

`zerarNaoLidas` devolve a mesma referência quando o item não existe ou já está em 0. Esse caso vai num `it` em `InboxNovo.test.ts`.

- [ ] **Step 6: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/marcar-lida.test.ts" "src/app/(app)/inbox/InboxNovo.interacao.test.ts" "src/app/(app)/inbox/InboxNovo.test.ts"`

Expected: FAIL (módulo e exports inexistentes).

- [ ] **Step 7: Implementar no cliente**

- `criarMarcadorDeLeitura`: um `Map<string, { pendente: boolean }>` das conversas em voo. Uma chamada para um id em voo só marca `pendente`. No `finally`, se `pendente`, roda mais uma vez. Erros vão para `.catch(() => undefined)`.
- Em `InboxNovo`:
  - `const marcarLeitura = useRef(criarMarcadorDeLeitura(marcarAtendimentoLido)).current`;
  - um `useEffect` com dependência `[selecionado]` que, havendo seleção, chama `marcarLeitura(selecionado)` e `setItens((l) => zerarNaoLidas(l, selecionado))`;
  - em `aoAviso` (`InboxNovo.tsx:152`), quando `avisoMarcaLida(a, selecionadoRef.current)` e `typeof document !== "undefined" && document.visibilityState === "visible"`, chamar `marcarLeitura(a.atendimentoId!)`.

- [ ] **Step 8: Rodar e ver passar**

Run: o comando do Step 6 e `node_modules/.bin/vitest run "src/app/(app)/inbox"`. Expected: PASS, com `sem-polling.test.ts` verde.

- [ ] **Step 9: Conferir no app**

Com `npm run dev`, abra uma conversa com não lidas. O contador some na hora, e o selo do menu lateral cai no próximo render do servidor (`revalidatePath("/inbox")`). Anexar ao PR a captura de antes e depois em 1440×900.

- [ ] **Step 10: Commit**

```bash
git add src/server/whatsapp/acoes.ts src/server/whatsapp/preferencias.ts src/server/whatsapp/motor/presenca.int.test.ts src/server/whatsapp/preferencias.int.test.ts "src/app/(app)/inbox/marcar-lida.ts" "src/app/(app)/inbox/marcar-lida.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/InboxNovo.interacao.test.ts" "src/app/(app)/inbox/InboxNovo.test.ts" docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): abrir a conversa marca como lida e confirma a leitura pelo motor" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-3"></a>
### Task 3: Notas do atendimento na rota da conversa, com aviso em tempo real

A nota gravada por `registrarNotaAtendimento` (`acoes-conversa.ts:24-45`) é um `Evento NotaInterna` no agregado `AtendimentoWhatsApp`. A rota da thread (`consultas-pagina.ts:180-183`), porém, devolve só as notas do lead, e só na primeira página. Esta task faz a página trazer as notas do atendimento e as do lead, também nas páginas `depois`, já que é por elas que a thread se atualiza a cada aviso (`historico-conversa.ts:173-176`). Nas páginas `antes`, as notas vêm como `null`, o que quer dizer "sem mudança". A nota nova emite `atendimento.atualizado` na mesma transação, como `avisarRevogado` (`acoes-atendimento.ts:332-335`), sem passar `paraUsuarioId`. Assim, o SSE leva a nota a todos com escopo, inclusive ao próprio autor.

**Files:**
- Modify: `src/server/inbox/barramento.ts`
- Modify: `src/server/whatsapp/consultas-inbox.ts:46, 203-209`
- Modify: `src/server/whatsapp/acoes-conversa.ts:39-41, 48-63`
- Modify: `src/server/inbox/consultas-pagina.ts:149, 180-183`
- Test: `src/server/whatsapp/nota-interna.int.test.ts`, `src/server/inbox/consultas-pagina.int.test.ts`

**Interfaces:**
- Consumes: `atendimentoVisivel(u, id, envio?, tx?)`, que devolve `conversaId`; `podeVerLeadNaThread`; `notasDoLead`.
- Produces:
  - `NotaInternaThread = { id: string; nota: string; autorNome: string | null; criadoEm: string; origem: "atendimento" | "oportunidade" }`;
  - `notasInternasDoAtendimento(atendimentoId: string): Promise<NotaInternaThread[]>`, sem checar escopo: quem chama já checou. Traz as 50 mais recentes e tira as arquivadas, com a lógica atual de `acoes-conversa.ts:52-62`;
  - `avisarAtendimentoAtualizado(tx: Prisma.TransactionClient, a: { id: string; conversaId: string }): Promise<void>`;
  - `listarMensagensPagina(...)` devolve `notas: NotaInternaThread[] | null`: `null` com `antes`; sem cursor ou com `depois`, as notas do atendimento mais as do lead (quando `podeVerLeadNaThread` deixa), em ordem crescente de `(criadoEm, id)`.
  - A Task 4 consome `notas` pela rota `GET /api/inbox/atendimentos/[id]/mensagens`, que não muda.

- [ ] **Step 1: Escrever os testes que falham**

Em `nota-interna.int.test.ts`, acrescentar `beforeAll(() => iniciarEscuta(process.env.DATABASE_URL!))`, `afterAll(() => prisma.$disconnect())` e os helpers `escutar` e `pausa` de `participantes-aviso.int.test.ts:21-28`. Pausar 300 ms depois de montar o cenário.

```ts
it("registrar nota avisa atendimento.atualizado do atendimento, só com ids", async () => {
  const { fin, a } = await cenario(); await pausa(300);
  const { r, sair } = escutar(); comoUsuario(fin);
  expect((await registrarNotaAtendimento({ atendimentoId: a.id, nota: "Cliente ligou" })).ok).toBe(true);
  const esperado: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId };
  await vi.waitFor(() => expect(r).toContainEqual(esperado), { timeout: 2000 });
  expect(JSON.stringify(r)).not.toContain("Cliente ligou");
  sair();
});
it("repetição idempotente da nota não avisa de novo", async () => {
  const { fin, a } = await cenario(); comoUsuario(fin);
  const chave = "11111111-1111-4111-8111-111111111111";
  await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x", chaveIdempotencia: chave }); await pausa(300);
  const { r, sair } = escutar();
  await registrarNotaAtendimento({ atendimentoId: a.id, nota: "x", chaveIdempotencia: chave }); await pausa(300);
  expect(r.filter((x) => x.atendimentoId === a.id)).toEqual([]);
  sair();
});
```

Em `consultas-pagina.int.test.ts`, usar o cenário do arquivo com um atendimento **FINANCEIRO**, já que as notas do atendimento não dependem do comercial. As notas são gravadas direto, com `prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: admin.id, payload: { nota } }))`, porque o arquivo não simula a sessão:

```ts
it("a página da thread traz as notas do atendimento sem cursor e com depois; com antes, null", async () => {
  // 70 mensagens (mais que LIMITE_THREAD = 60) e 2 notas gravadas por registrarNotaAtendimento, a 2ª mais nova
  const p1 = (await listarMensagensPagina(sess(admin), a.id, {}))!;
  expect(p1.notas!.map((n) => [n.nota, n.origem])).toEqual([["primeira", "atendimento"], ["segunda", "atendimento"]]);
  expect((await listarMensagensPagina(sess(admin), a.id, { antes: p1.antes! }))!.notas).toBeNull();
  expect((await listarMensagensPagina(sess(admin), a.id, { depois: p1.depois! }))!.notas).toHaveLength(2);
});
it("nota arquivada não volta na página da thread", async () => {
  // Evento NotaInternaArquivada com payload { eventoId: <id da 1ª nota> }
  expect((await listarMensagensPagina(sess(admin), a.id, {}))!.notas!.map((n) => n.nota)).toEqual(["segunda"]);
});
it("nota do lead entra com origem oportunidade para quem vê o lead", async () => {
  // atendimento COMERCIAL com leadId; Evento NotaInterna no agregado Lead
  expect((await listarMensagensPagina(sess(admin), a.id, {}))!.notas!.some((n) => n.origem === "oportunidade")).toBe(true);
});
```

O teste `inbox.int.test.ts:525-528` continua passando sem mudança: tem uma nota de lead só.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/whatsapp/nota-interna.int.test.ts src/server/inbox/consultas-pagina.int.test.ts src/server/whatsapp/inbox.int.test.ts`

Expected: FAIL (sem aviso, sem notas do atendimento, `notas` nunca é `null`).

- [ ] **Step 3: Implementar**

- `avisarAtendimentoAtualizado`: `` tx.$executeRaw`SELECT pg_notify(${CANAL_INBOX}, ${JSON.stringify(aviso)})` ``, com `aviso: AvisoInbox = { tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }`.
- Em `registrarNotaAtendimento`, chamar o aviso logo depois de `registrarEvento` (`acoes-conversa.ts:41`). O ramo da repetição (`:37`) não avisa.
- `notasDoAtendimento` mantém a assinatura e delega para `notasInternasDoAtendimento` depois de checar o escopo.
- `notasDoLead` passa a pôr `origem: "oportunidade"`.
- Em `listarMensagensPagina`:
  - `verNotas` passa a usar `!cAntes` no lugar de `!pos`;
  - com `cAntes`, `notas: null`;
  - nos outros casos, `[...notasInternasDoAtendimento(id), ...(verNotasLead ? notasDoLead(leadId) : [])]` ordenado por `(criadoEm, id)`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e `node_modules/.bin/vitest run -c vitest.integration.config.ts src/server/inbox src/server/whatsapp/acoes-atendimento-pool.int.test.ts src/server/whatsapp/inbox-idempotencia.int.test.ts src/server/aria/historico.int.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/inbox/barramento.ts src/server/whatsapp/consultas-inbox.ts src/server/whatsapp/acoes-conversa.ts src/server/inbox/consultas-pagina.ts src/server/whatsapp/nota-interna.int.test.ts src/server/inbox/consultas-pagina.int.test.ts docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): rota da conversa traz as notas do atendimento e a nota avisa o SSE" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-4"></a>
### Task 4: Notas internas aparecem na thread

**Files:**
- Modify: `src/components/conversa/historico-conversa.ts:5-20, 70-164`
- Modify: `src/components/conversa/fonte-erp.ts:17-18`
- Create: `src/components/conversa/itens-thread.ts`
- Create: `src/components/conversa/NotaNaThread.tsx`
- Modify: `src/app/(app)/inbox/ConversaAberta.tsx:148-160`
- Test: `src/components/conversa/historico-conversa.test.ts`, `src/components/conversa/itens-thread.test.ts` (novo), `src/components/conversa/NotaNaThread.test.ts` (novo), `src/app/(app)/inbox/ConversaAberta.test.ts`

**Interfaces:**
- Consumes: `NotaInternaThread` e a regra de `notas` da Task 3 (`null` = sem mudança).
- Produces:
  - `PaginaHistorico.notas?: NotaInternaThread[] | null` (opcional, para não quebrar as fontes falsas) e `EstadoHistorico.notas: NotaInternaThread[]` (vazio em `historicoVazio`). Por `useConversa`, o `ConversaHook` passa a ter `notas`;
  - `type ItemThread = { tipo: "mensagem"; id: string; m: MensagemThread } | { tipo: "nota"; id: string; n: NotaInternaThread }`, com `id` igual a `m.id` ou `` `nota:${n.id}` ``;
  - `itensDaThread(mensagens: MensagemThread[], notas: NotaInternaThread[], temMaisAntes: boolean): ItemThread[]`;
  - `NotaNaThread(props: { n: NotaInternaThread; fuso: string | null })`;
  - Na E1, `BalaoMensagem` com `autor: "nota"` substitui `NotaNaThread`, e `itensDaThread` continua.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// itens-thread.test.ts
const m = (id: string, em: string) => ({ ...MSG_BASE, id, criadoEm: em });
const n = (id: string, em: string) => ({ id, nota: id, autorNome: "Ana", criadoEm: em, origem: "atendimento" as const });
it("intercala por horário; no empate a mensagem vem antes da nota", () => {
  expect(itensDaThread([m("m1", "2026-10-01T10:00:00Z"), m("m2", "2026-10-01T12:00:00Z")], [n("n1", "2026-10-01T11:00:00Z"), n("n2", "2026-10-01T12:00:00Z")], false)
    .map((i) => i.id)).toEqual(["m1", "nota:n1", "m2", "nota:n2"]);
});
it("nota anterior à janela só entra quando não há mais antigas", () => {
  const msgs = [m("m1", "2026-10-01T10:00:00Z")], notas = [n("n0", "2026-10-01T09:00:00Z")];
  expect(itensDaThread(msgs, notas, true).map((i) => i.id)).toEqual(["m1"]);
  expect(itensDaThread(msgs, notas, false).map((i) => i.id)).toEqual(["nota:n0", "m1"]);
});
it("sem mensagens, todas as notas", () => { expect(itensDaThread([], [n("n1", "2026-10-01T09:00:00Z")], false)).toHaveLength(1); });

// NotaNaThread.test.ts
it("nota do atendimento: rótulo, autor, texto com quebras e hora no fuso", () => {
  const h = renderToStaticMarkup(createElement(NotaNaThread, { n: { id: "e1", nota: "linha 1\nlinha 2", autorNome: "Ana", criadoEm: "2026-10-17T15:30:00.000Z", origem: "atendimento" }, fuso: "America/Sao_Paulo" }));
  expect(h).toContain('role="note"'); expect(h).toContain("Nota interna · só equipe"); expect(h).toContain("Ana");
  expect(h).toMatch(/whitespace-pre-wrap[^>]*>linha 1\nlinha 2</); expect(h).toContain("12:30");
});
it("nota do lead usa o rótulo da oportunidade", () => {
  expect(renderToStaticMarkup(createElement(NotaNaThread, { n: { id: "e2", nota: "x", autorNome: null, criadoEm: "2026-10-17T15:30:00.000Z", origem: "oportunidade" }, fuso: null })))
    .toContain("Nota da oportunidade · só equipe");
});

// historico-conversa.test.ts
const n1: NotaInternaThread = { id: "e1", nota: "a", autorNome: null, criadoEm: msg(0).criadoEm, origem: "atendimento" };
const n2: NotaInternaThread = { ...n1, id: "e2", nota: "b" };
it("abrir guarda as notas; maisAntigas mantém; maisNovas troca pelas da página", async () => {
  let notas = [n1];
  const base = fonteFalsa({ a: 150 });
  const f: FonteHistorico = { pagina: async (id, o, s) => ({ ...(await base.pagina(id, o, s)), notas: o.antes ? null : notas }) };
  const h = new HistoricoConversa(f);
  await h.abrir("a"); expect(h.getState().notas).toEqual([n1]);
  await h.maisAntigas(); expect(h.getState().notas).toEqual([n1]);
  notas = [n1, n2]; await h.maisNovas(); expect(h.getState().notas).toEqual([n1, n2]);
});
it("fonteErp repassa as notas da rota", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ mensagens: [], notas: [n1], antes: null, depois: null, temMais: false }))));
  expect((await fonteErp.pagina("a", {})).notas).toEqual([n1]);
  vi.unstubAllGlobals();
});

// ConversaAberta.test.ts (conversaVazia ganha notas: [])
it("thread mostra a nota interna junto das mensagens", () => {
  const conversa = { ...conversaVazia, mensagens: [msg], notas: [{ id: "e1", nota: "Combinar desconto", autorNome: "Ana", criadoEm: "2026-10-17T16:00:00.000Z", origem: "atendimento" }] } as unknown as ConversaHook;
  const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, conversa })));
  expect(h).toContain("Combinar desconto"); expect(h).toContain("Nota interna · só equipe");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa "src/app/(app)/inbox/ConversaAberta.test.ts"`

Expected: FAIL (módulos novos inexistentes, `notas` fora do estado).

- [ ] **Step 3: Implementar**

- `HistoricoConversa` publica `notas: p.notas` sempre que a página traz `notas` não nulo: em `abrir`, `recarregar` e em cada volta de `maisNovas`. Em `maisAntigas`, mantém as que já tem.
- `fonteErp` devolve `notas: j.notas ?? null`.
- `NotaNaThread` alinha à direita, com `max-w-[80%] rounded-lg border border-dashed border-amber-700 bg-amber-50 px-3 py-2 text-sm`. Leva `IconLock` de 12 px no rótulo e o texto com `whitespace-pre-wrap break-words`. A hora sai por `formatarInstanteExibicao(iso, fuso, "UTC", "hora")`, como em `BalaoMensagem.tsx:32-34`.
- `ConversaAberta` passa `itensDaThread(conversa.mensagens, conversa.notas, conversa.temMaisAntes)` ao `VirtualList`, com `getKey={(i) => i.id}`, e o `renderItem` escolhe o componente pelo `tipo`.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, mais `node_modules/.bin/vitest run src/app/paleta.test.ts src/app/botoes.test.ts src/app/contraste-elementos.test.ts`. Expected: PASS.

- [ ] **Step 5: Conferir no app**

Com `npm run dev`, grave uma nota pelo diálogo "Nota interna". Ela aparece na thread de quem gravou e, sem recarregar, na de outra pessoa com a mesma conversa aberta. Anexar ao PR as capturas nos dois temas em 1440×900 e 390×844.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa/historico-conversa.ts src/components/conversa/historico-conversa.test.ts src/components/conversa/fonte-erp.ts src/components/conversa/itens-thread.ts src/components/conversa/itens-thread.test.ts src/components/conversa/NotaNaThread.tsx src/components/conversa/NotaNaThread.test.ts "src/app/(app)/inbox/ConversaAberta.tsx" "src/app/(app)/inbox/ConversaAberta.test.ts" docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): notas internas aparecem na thread" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-5"></a>
### Task 5: "Prazo estourado" vivo

`ListaAtendimentos.tsx:31` congela o `agora` na montagem. Isso não pede polling: basta um `setTimeout` único até o próximo prazo que vai vencer. Quando ele dispara, `agora` avança e o timer é reagendado para o prazo seguinte. A lista nova que chega pelo SSE recalcula o próximo prazo.

**Files:**
- Create: `src/app/(app)/inbox/prazo-vivo.ts`
- Modify: `src/app/(app)/inbox/ListaAtendimentos.tsx:26-31, 66`
- Test: `src/app/(app)/inbox/prazo-vivo.test.ts` (novo), `src/app/(app)/inbox/prazo-vivo.interacao.test.ts` (novo), `src/app/(app)/inbox/ListaAtendimentos.test.ts`

**Interfaces:**
- Consumes: `ItemListaInbox` (`grupo`, `status`, `prazoRespostaEm`).
- Produces (a E1 usa em `ItemConversa`, que recebe `agora: Date`):
  - `prazoEstourado(i: Pick<ItemListaInbox, "grupo" | "status" | "prazoRespostaEm">, agora: number): boolean`, movida de `ListaAtendimentos.tsx:26-27` sem mudar a regra;
  - `proximoEstouroEm(itens: ItemListaInbox[], agora: number): number | null`: o menor `prazoRespostaEm` maior que `agora` entre os itens que não são grupo nem `ENCERRADO`;
  - `TETO_TIMER_MS = 2_147_483_647`;
  - `esperaAteProximo(proximo: number | null, agora: number): number | null`: `null` sem próximo; senão `min(max(proximo - agora + 1, 0), TETO_TIMER_MS)`;
  - `useAgoraDosPrazos(itens: ItemListaInbox[]): number`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// prazo-vivo.test.ts
const T = Date.UTC(2026, 9, 22, 12);
const it_ = (o: Partial<ItemListaInbox>) => ({ grupo: false, status: "EM_ATENDIMENTO", prazoRespostaEm: null, ...o }) as ItemListaInbox;
it("proximoEstouroEm ignora passado, grupo, encerrado e sem prazo, e devolve o menor futuro", () => {
  const iso = (ms: number) => new Date(T + ms).toISOString();
  expect(proximoEstouroEm([it_({ prazoRespostaEm: iso(-1000) }), it_({ grupo: true, prazoRespostaEm: iso(5000) }),
    it_({ status: "ENCERRADO", prazoRespostaEm: iso(4000) }), it_({}), it_({ prazoRespostaEm: iso(9000) }), it_({ prazoRespostaEm: iso(7000) })], T)).toBe(T + 7000);
  expect(proximoEstouroEm([it_({})], T)).toBeNull();
});
it("esperaAteProximo limita ao teto do setTimeout", () => {
  expect(esperaAteProximo(null, T)).toBeNull();
  expect(esperaAteProximo(T + 60_000, T)).toBe(60_001);
  expect(esperaAteProximo(T - 5, T)).toBe(0);
  expect(esperaAteProximo(T + 40 * 86_400_000, T)).toBe(TETO_TIMER_MS);
});
it("prazoEstourado mantém a regra da lista", () => {
  expect(prazoEstourado(it_({ prazoRespostaEm: new Date(T - 1).toISOString() }), T)).toBe(true);
  expect(prazoEstourado(it_({ status: "ENCERRADO", prazoRespostaEm: new Date(T - 1).toISOString() }), T)).toBe(false);
  expect(prazoEstourado(it_({ grupo: true, prazoRespostaEm: new Date(T - 1).toISOString() }), T)).toBe(false);
});
```

`prazo-vivo.interacao.test.ts` usa o mock de `react` com `useState` de `criarGanchos` e o `useEffect` que roda quando as dependências mudam, copiado de `InboxNovo.interacao.test.ts:14-31`, mais `vi.useFakeTimers()` e `vi.setSystemTime(T)`:

```ts
it("o selo aparece quando o prazo vence, sem recarregar e sem setInterval", () => {
  const itens = [it_({ prazoRespostaEm: new Date(T + 60_000).toISOString() })];
  const agora = () => { m.posEfeito = 0; return m.g!.renderizar((p: ItemListaInbox[]) => useAgoraDosPrazos(p), itens) as number; };
  expect(prazoEstourado(itens[0], agora())).toBe(false);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(60_001);
  expect(prazoEstourado(itens[0], agora())).toBe(true);
  expect(vi.getTimerCount()).toBe(0); // sem próximo prazo, nenhum timer
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/prazo-vivo.test.ts" "src/app/(app)/inbox/prazo-vivo.interacao.test.ts"`

Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

- `useAgoraDosPrazos`: `useState(() => Date.now())`. Um `useEffect` com dependência `[espera]`, em que `espera = esperaAteProximo(proximoEstouroEm(itens, agora), agora)`. Com `espera` nula, não faz nada. Senão, `setTimeout(() => setAgora(Date.now()), espera)` com `clearTimeout` na limpeza.
- `ListaAtendimentos` troca `useState(() => Date.now())` por `useAgoraDosPrazos(itens)` e `estourado` por `prazoEstourado`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox"`. Expected: PASS, incluindo `sem-polling.test.ts` e os testes de prazo de `ListaAtendimentos.test.ts:29-38`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/inbox/prazo-vivo.ts" "src/app/(app)/inbox/prazo-vivo.test.ts" "src/app/(app)/inbox/prazo-vivo.interacao.test.ts" "src/app/(app)/inbox/ListaAtendimentos.tsx" docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): selo de prazo estourado aparece quando o prazo vence" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-6"></a>
### Task 6: Anexos Contato, Enquete e Localização sem ação

Com o motor conectado, os três itens ficam habilitados, mas sem `onClick` (`Compositor.tsx:255`): o clique não faz nada. O servidor já envia os três tipos (`enviarConteudoInbox`, `motor/acoes-mensagem.ts:405`, com `contatoJid`, `opcoes` ou `latitude` e `longitude` validados em `:374-389`). Falta o formulário que colhe esses dados, e ele é a entrega "anexos extras" da E4 (índice). Pelo doc 03, as três funções valem para todos e nenhuma sai por causa do visual. Por isso a decisão é **manter os itens visíveis e desabilitados com o motivo**, o mesmo padrão dos recursos do motor (`recursos-canal.ts:4-5`), em vez de escondê-los. Sem motor, o motivo continua `AVISO_RECURSO_MOTOR`. Com motor, o motivo é o aviso novo.

**Files:**
- Modify: `src/components/conversa/Compositor.tsx:13-17, 251-259`
- Test: `src/components/conversa/Compositor.test.ts:145-162`

**Interfaces:**
- Consumes: —
- Produces: `AVISO_ANEXO_EM_BREVE = "O envio deste tipo pelo Inbox ainda não está disponível."`, exportado de `Compositor.tsx`. A E4 apaga a constante quando liga os formulários.

- [ ] **Step 1: Trocar o teste `contato, enquete e localização só ficam ativos quando estão nas capacidades da thread` (`Compositor.test.ts:150-157`) e acrescentar a trava geral**

```ts
it("com o motor conectado, contato, enquete e localização seguem desabilitados com o aviso de que o envio pelo Inbox ainda não existe", () => {
  m.g = criarGanchos();
  const p = props({ capacidades: ["cartaoContato", "enquete", "localizacao"] });
  const tela = () => m.g!.renderizar(Compositor, p);
  (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
  const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
  expect(h).toContain(AVISO_ANEXO_EM_BREVE); expect(h).not.toContain(AVISO_RECURSO_MOTOR);
  for (const r of ["Contato", "Enquete", "Localização"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${r}</button>`));
});
it("nenhum item habilitado do menu Anexar fica sem ação", () => {
  for (const capacidades of [[], ["cartaoContato", "enquete", "localizacao"]] as RecursoMotor[][]) {
    m.g = criarGanchos();
    const p = props({ capacidades });
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const itens = elementos(tela()).filter((n) => n.props.role === "menuitem" && !n.props.disabled);
    expect(itens.length).toBeGreaterThan(0);
    for (const i of itens) expect(typeof i.props.onClick, String(i.props.children)).toBe("function");
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa/Compositor.test.ts`

Expected: FAIL (export inexistente; o item fica habilitado sem `onClick`).

- [ ] **Step 3: Implementar**

Nos `ITENS_MOTOR`, sempre `disabled`. O `<small>` mostra `AVISO_RECURSO_MOTOR` quando o recurso não está nas capacidades e `AVISO_ANEXO_EM_BREVE` quando está.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa/Compositor.test.ts src/app/botoes.test.ts`. Expected: PASS. A contagem de `botoes.test.ts:53` não muda.

- [ ] **Step 5: Commit**

```bash
git add src/components/conversa/Compositor.tsx src/components/conversa/Compositor.test.ts docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): anexos contato, enquete e localização desabilitados com motivo enquanto não há formulário" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-7"></a>
### Task 7: Rolagem dupla da página

A caixa do Inbox tem altura fixa `h-[calc(100dvh-8rem)]` (`InboxNovo.tsx:214`). Acima dela ficam o título, o sino e o formulário "Abrir atendimento" (`page.tsx:63-70`), e a página medida tem 1044 px num viewport de 900 (análise parte 1 §2). A correção mínima: a página vira uma coluna flex com a altura exata da área de conteúdo, e a caixa ocupa o resto (`flex-1 min-h-0`). A E1 tira o título e o formulário e põe a tela cheia. Esta task só garante que a página não role.

Alturas, a partir do código atual:
- a partir de `md`, o `main` tem `p-8` (`src/app/(app)/layout.tsx:22`), o que dá `100dvh - 4rem`;
- abaixo de `md`, o `main` tem `p-4` (2rem), e a `BarraMobile` (`src/components/BarraMobile.tsx:45`) tem `py-1.5` + botão `max-sm:min-h-11` + borda, 57 px = `3.5625rem`.

A `Trilha` não aparece em `/inbox`, que tem um nível só (`src/components/Trilha.tsx:13`).

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx:63-76`
- Modify: `src/app/(app)/inbox/InboxNovo.tsx:214`
- Test: `src/app/(app)/inbox/page.test.ts`, `src/app/(app)/inbox/InboxNovo.test.ts`

**Interfaces:**
- Consumes: —
- Produces: a raiz do `InboxNovo` cresce dentro de um pai flex (`flex-1 min-h-0`). A E1 mantém isso quando a página vira só `<InboxNovo>` em tela cheia.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// page.test.ts
it("a página é uma coluna com a altura da área de conteúdo, e o InboxNovo ocupa o resto", async () => {
  mocks.preferencia.mockResolvedValue({ ok: false });
  const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(h).toMatch(/^<div class="[^"]*\bflex\b[^"]*\bflex-col\b[^"]*h-\[calc\(100dvh-2rem-3\.5625rem\)\][^"]*md:h-\[calc\(100dvh-4rem\)\]/);
  expect(h).toMatch(/<div class="[^"]*\bmin-h-0\b[^"]*\bflex-1\b[^"]*">inbox:/);
});
it("a conta da altura segue o padding do main e a altura da barra do celular", () => {
  expect(readFileSync("src/app/(app)/layout.tsx", "utf8")).toContain('className="min-w-0 flex-1 p-4 md:p-8"');
  const barra = readFileSync("src/components/BarraMobile.tsx", "utf8");
  expect(barra).toContain("px-2 py-1.5 md:hidden"); expect(barra).toContain("max-sm:min-h-11");
});
// InboxNovo.test.ts
it("a caixa do Inbox cresce no pai (flex-1 min-h-0) e não fixa altura pela viewport", () => {
  const raiz = html().match(/<div data-vista="lista" data-conectado="[01]" class="([^"]*)"/)![1].split(" ");
  expect(raiz).toEqual(expect.arrayContaining(["flex", "min-h-0", "flex-1"]));
  expect(html()).not.toContain("100dvh");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.test.ts"`

Expected: FAIL.

- [ ] **Step 3: Implementar**

- Raiz de `page.tsx`: `flex flex-col h-[calc(100dvh-2rem-3.5625rem)] md:h-[calc(100dvh-4rem)]`.
- Linha do título e bloco do `NovoAtendimento` com `shrink-0`.
- Bloco do `InboxNovo`: `mt-4 flex min-h-0 flex-1 flex-col`.
- Em `InboxNovo.tsx:214`, `h-[calc(100dvh-8rem)] min-h-[420px]` vira `min-h-0 flex-1`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run "src/app/(app)/inbox" src/app/responsivo.test.ts src/app/paleta.test.ts`. Expected: PASS.

- [ ] **Step 5: Conferir no app**

Com `npm run dev`, em `/inbox` (sem e com `?c=`), nos três tamanhos e nos dois temas, rodar no console `document.documentElement.scrollHeight <= window.innerHeight`. Expected: `true`. A lista e a thread continuam rolando por dentro. Anexar ao PR as capturas de página inteira de antes e depois.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx" "src/app/(app)/inbox/page.test.ts" "src/app/(app)/inbox/InboxNovo.tsx" "src/app/(app)/inbox/InboxNovo.test.ts" docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): página do inbox sem rolagem dupla" -m "<trailer de co-autoria do projeto>"
```

---

<a id="task-8"></a>
### Task 8: Chevron do menu da mensagem fora do texto

O chevron fica sempre visível em `absolute right-1 top-1` (`BalaoMensagem.tsx:88-89`), por cima da primeira linha. O menu abre em `absolute right-0 top-7` (`:91`) e sai da área visível (análise parte 1 §3.4).

A correção:
1. o chevron vem antes do conteúdo, com `float-right`, e reserva espaço só na primeira linha;
2. aparece no hover ou no foco do balão, sempre em tela de toque e sempre com o menu aberto;
3. o menu usa `position: fixed` com `posicaoPopover` (`src/lib/popover.ts:6`) e os ouvintes de `ligarMenuAberto` (`src/components/Menu.tsx:23`), que fecham com clique fora, Esc, rolagem e redimensionamento e trazem o teclado com setas. Esses ouvintes substituem o efeito próprio de `BalaoMensagem.tsx:50-57`.

**Files:**
- Modify: `src/components/conversa/BalaoMensagem.tsx:47-105`
- Test: `src/components/conversa/BalaoMensagem.test.ts`

**Interfaces:**
- Consumes: `posicaoPopover`, `ligarMenuAberto`, `CLASSE_PAINEL_MENU` e `CLASSE_ITEM_MENU`.
- Produces: as props de `BalaoMensagem` não mudam (`menuAberto` continua para os testes de marcação). A E1 acrescenta `autor` sobre esta versão.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("o chevron não fica sobre o texto: vem antes do conteúdo, flutua à direita e não é absoluto", () => {
  const h = html({ corpo: "Perfeito. Quanto fica?" });
  expect(h).toMatch(/<button[^>]*aria-label="Opções da mensagem"[^>]*class="[^"]*\bfloat-right\b[^"]*"[\s\S]*Perfeito\. Quanto fica\?/);
  expect(h).not.toContain("absolute right-1 top-1");
});
it("o chevron aparece no hover ou foco do balão, sempre em tela de toque e com o menu aberto", () => {
  const fechado = html({});
  expect(fechado).toMatch(/class="[^"]*\bgroup\b[^"]*\brelative\b|class="[^"]*\brelative\b[^"]*\bgroup\b/);
  for (const c of ["opacity-0", "group-hover:opacity-100", "group-focus-within:opacity-100", "[@media(hover:none)]:opacity-100"]) expect(fechado).toContain(c);
  expect(html({}, { menuAberto: true })).toMatch(/aria-label="Opções da mensagem"[^>]*aria-expanded="true"[^>]*class="[^"]*\bopacity-100\b/);
});
it("menu aberto é fixo na viewport (posicaoPopover), não preso ao balão", () => {
  const h = html({}, { menuAberto: true });
  expect(h).toMatch(/role="menu"[^>]*style="position:fixed/);
  expect(h).not.toContain("absolute right-0 top-7");
});
```

Os testes atuais de `BalaoMensagem.test.ts:30-53` seguem valendo, porque os itens do menu continuam no markup com `menuAberto`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node_modules/.bin/vitest run src/components/conversa/BalaoMensagem.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar**

Os mesmos passos de `Menu.tsx:78-128`:
- refs do gatilho e do painel;
- `useLayoutEffect` que mede e chama `posicaoPopover`;
- `style={{ position: "fixed", top, left, visibility: pos ? "visible" : "hidden", zIndex: 50 }}`, com `role` antes de `style` no JSX, como em `Menu.tsx:139-143`, já que o teste lê os atributos nessa ordem;
- `useEffect` com `ligarMenuAberto({ doc: document, painel, gatilho, habilitados, fechar })`.

O gatilho fica antes do autor, com `float-right -mr-1 ml-2 rounded opacity-0 hover:bg-highlight focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100`, e `opacity-100` quando o menu está aberto. O balão ganha `group`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node_modules/.bin/vitest run src/components/conversa src/app/botoes.test.ts src/app/paleta.test.ts "src/app/(app)/inbox"`. Expected: PASS. A ordem de rótulos em `botoes.test.ts:87` não muda.

- [ ] **Step 5: Conferir no app**

Abra o menu de uma mensagem perto da borda de baixo: ele abre para cima e fica dentro da tela. O texto da primeira linha não fica sob o chevron. Anexar as capturas de 1440×900 e 390×844 nos dois temas, no estado `-desktop-menu-mensagem` (análise parte 1 §7).

- [ ] **Step 6: Commit**

```bash
git add src/components/conversa/BalaoMensagem.tsx src/components/conversa/BalaoMensagem.test.ts docs/planejamento/quadro-entregas.md
git commit -m "fix(inbox): chevron do menu da mensagem fora do texto e menu dentro da tela" -m "<trailer de co-autoria do projeto>"
```

---

## Gate de cada PR

Antes de abrir o PR de qualquer task (Global Constraints do índice), com saída 0:

- `node_modules/.bin/tsc --noEmit`
- `npm test`
- `npm run lint`, com no máximo 40 avisos
- nas Tasks 2 e 3: `node_modules/.bin/vitest run -c vitest.integration.config.ts <arquivos .int.test.ts da task>`, com o `.erp-test-profile` do worktree apontando para um banco descartável

Registrar no quadro o número de arquivos e testes de cada comando.

## Fora da E0 (registrado para as próximas etapas)

- **Selo de não lidas do menu lateral (contador pessoal), vai para a E1.** Hoje `contarNaoLidas` (`src/server/whatsapp/consultas-inbox.ts:78-81`) soma o `naoLidas` compartilhado de todo o escopo, e o resultado só é lido no render do layout (`src/app/(app)/layout.tsx:12`). Para virar pessoal, a consulta precisa somar a contagem de `preferenciasDoUsuario` (`preferencias-consulta.ts:13-45`) sobre todo o escopo, que hoje faz um `groupBy` por instante de leitura e só para uma página. É uma consulta agregada nova, que precisa de revisão de índice, e um componente cliente no shell assinando o SSE. Não é pequeno. Com a Task 2, o selo pelo menos cai ao abrir uma conversa, pelo `revalidatePath("/inbox")`. **Atenção:** o índice põe a barra lateral global fora do escopo. O plano 02 precisa registrar esse item como exceção explícita, ou o integrador decide outro destino.
- **Aviso SSE de agendamento**, vai para a E4 (agendamento completo, cartão no fio). **Aviso SSE de sugestão da Aria**, vai para a E3. A análise parte 2 (§13 e §14 bloco 3) classifica os dois como lacuna de tempo real de esforço P/M, dependente do bloco 2 (estado da Aria), e não como defeito pequeno. Só o aviso da **nota** entra aqui (Task 3): sem ele, a nota que a Task 4 passa a mostrar não chega a quem está com a conversa aberta.
- **Formulários de Contato, Enquete e Localização**, vão para a E4 ("anexos extras" do índice).

## Issues

<a id="issues"></a>

**[Inbox E0.1] Classes de cor inexistentes e trava de paleta ampliada**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: trocar as 7 classes de cor que não geram CSS (`bg-brand`, `text-brand`, `text-muted-foreground`, `bg-muted`) e ampliar `paleta.test.ts` para barrar cor sem tom que não exista no `tailwind.config.ts`.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-1`
- Arquivos: `src/app/paleta.test.ts`, `src/test/literais-string.ts`, `src/app/fundo-sobre-pagina.test.ts`, `ListaAtendimentos.tsx`, `BalaoMensagem.tsx`, `EnqueteLeitura.tsx`, `PainelSetor.tsx`, `DevolucaoCredito.tsx`
- Aceite: testes da Task 1 verdes; o contador de não lidas aparece em verde sólido e o ✓✓ de lida em verde (capturas antes e depois em 1440×900, nos dois temas).
- Dependências: nenhuma.

**[Inbox E0.2] Abrir a conversa marca como lida**
- Labels: `inbox`, `etapa-0`, `back-end`
- Objetivo: abrir uma conversa, ou receber mensagem nela aberta, grava a leitura pessoal, zera o contador compartilhado e confirma a leitura no WhatsApp pelo motor conectado (doc 03).
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-2`
- Arquivos: `src/server/whatsapp/preferencias.ts`, `src/server/whatsapp/acoes.ts`, `src/app/(app)/inbox/marcar-lida.ts`, `src/app/(app)/inbox/InboxNovo.tsx`
- Aceite: testes da Task 2 verdes (unitários e de integração); o contador some ao abrir (captura).
- Dependências: nenhuma.

**[Inbox E0.3] Notas do atendimento na rota da conversa, com aviso em tempo real**
- Labels: `inbox`, `etapa-0`, `back-end`
- Objetivo: a página da thread devolve as notas internas do atendimento (e as do lead para quem o vê), e a nota nova avisa o SSE.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-3`
- Arquivos: `src/server/inbox/barramento.ts`, `src/server/whatsapp/consultas-inbox.ts`, `src/server/whatsapp/acoes-conversa.ts`, `src/server/inbox/consultas-pagina.ts`
- Aceite: testes de integração da Task 3 verdes.
- Dependências: nenhuma.

**[Inbox E0.4] Notas internas aparecem na thread**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: mostrar na thread, em ordem de horário, as notas que a rota passa a devolver.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-4`
- Arquivos: `src/components/conversa/historico-conversa.ts`, `fonte-erp.ts`, `itens-thread.ts`, `NotaNaThread.tsx`, `src/app/(app)/inbox/ConversaAberta.tsx`
- Aceite: testes da Task 4 verdes; nota aparece para o autor e para outra pessoa sem recarregar (capturas em 1440×900 e 390×844, nos dois temas).
- Dependências: E0.3.

**[Inbox E0.5] "Prazo estourado" vivo**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: o selo aparece quando o prazo vence, sem recarregar e sem polling.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-5`
- Arquivos: `src/app/(app)/inbox/prazo-vivo.ts`, `src/app/(app)/inbox/ListaAtendimentos.tsx`
- Aceite: testes da Task 5 verdes, `sem-polling.test.ts` verde.
- Dependências: nenhuma.

**[Inbox E0.6] Anexos Contato, Enquete e Localização desabilitados com motivo**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: nenhum item do menu Anexar fica habilitado sem ação. Os três ficam desabilitados com o motivo até a E4 ligar os formulários.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-6`
- Arquivos: `src/components/conversa/Compositor.tsx`
- Aceite: testes da Task 6 verdes; captura do menu Anexar com o motor conectado.
- Dependências: nenhuma.

**[Inbox E0.7] Página do Inbox sem rolagem dupla**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: a página do Inbox não rola: só a lista e a thread rolam.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-7`
- Arquivos: `src/app/(app)/inbox/page.tsx`, `src/app/(app)/inbox/InboxNovo.tsx`
- Aceite: testes da Task 7 verdes; `document.documentElement.scrollHeight <= innerHeight` em 1440×900, 1024×768 e 390×844, nos dois temas (capturas de página inteira).
- Dependências: E0.2 (mesmo arquivo, `InboxNovo.tsx`).

**[Inbox E0.8] Chevron do menu da mensagem fora do texto**
- Labels: `inbox`, `etapa-0`, `ui`
- Objetivo: o chevron não cobre o texto do balão, e o menu da mensagem abre dentro da tela.
- Plano: `docs/superpowers/plans/2026-10-22-inbox-prototipo-01-correcoes.md#task-8`
- Arquivos: `src/components/conversa/BalaoMensagem.tsx`
- Aceite: testes da Task 8 verdes; capturas do menu aberto perto da borda, em 1440×900 e 390×844, nos dois temas.
- Dependências: E0.1 (mesmo arquivo).
