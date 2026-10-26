import { AbaInsights } from "./insights/AbaInsights";
import { DriverWhatsApp } from "@prisma/client";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Interação do InboxNovo sem DOM (src/test/tela-sem-dom.ts): o componente é chamado como função, com useState/useRef/
// useCallback dos ganchos de teste e um useEffect mínimo que roda o efeito quando as dependências mudam (o painel
// do atendimento é buscado num efeito). O aviso do SSE é capturado do useEventosInbox simulado.
const m = vi.hoisted(() => ({
  g: null as null | import("@/test/tela-sem-dom").Ganchos,
  efeitos: [] as { deps?: unknown[]; limpar?: void | (() => void) }[],
  posEfeito: 0,
  parametros313: null as string | null,
  modo: null as null | "uma" | "duas" | "tres",
  contagens: undefined as unknown,
  avisoThread: null as unknown,
  aoAviso: null as null | ((a: import("@/server/inbox/barramento").AvisoInbox) => void),
  aoVisibilidade: null as null | (() => void),
}));
const assumir357Inbox=vi.hoisted(()=>vi.fn(async()=>({ok:true})));
const assumir328Inbox=vi.hoisted(()=>vi.fn(async()=>({ok:true})));
vi.mock("@/server/whatsapp/acoes-atendimento",()=>({assumirAtendimento:assumir328Inbox,assumirConversaDaAria:assumir357Inbox,atribuirAtendimento:vi.fn(),convidarParticipante:vi.fn(),devolverParaFila:vi.fn(),revogarParticipante:vi.fn(),transferirAtendimento:vi.fn()}));
const marcar = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useSyncExternalStore: (() => m.modo) as unknown as typeof real.useSyncExternalStore,
    useState: ((i: unknown) => {
      if (!m.g) return real.useState(i as never);
      const estado = m.g.useState(i);
      // Observa o estado produtor por sua forma pública, sem índice de hook ou atributo de teste na UI.
      if (i && typeof i === "object" && "todas" in i) m.contagens = estado[0];
      return estado;
    }) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
    useCallback: ((f: unknown, d: unknown[]) => {
      if (!m.g) return real.useCallback(f as never, d);
      const memo = m.g.useRef<{ deps: unknown[]; valor: unknown } | null>(null);
      if (!memo.current || d.some((v, i) => !Object.is(v, memo.current!.deps[i]))) memo.current = { deps: d, valor: f };
      return memo.current.valor;
    }) as unknown as typeof real.useCallback,
    useMemo: ((f: () => unknown, d: unknown[]) => (m.g ? f() : real.useMemo(f, d))) as unknown as typeof real.useMemo,
    useEffect: ((f: () => void | (() => void), d?: unknown[]) => {
      if (!m.g) return real.useEffect(f, d);
      const k = m.posEfeito++;
      const antes = m.efeitos[k];
      if (antes && d && antes.deps && d.length === antes.deps.length && d.every((v, i) => Object.is(v, antes.deps![i]))) return;
      if (typeof antes?.limpar === "function") antes.limpar();
      m.efeitos[k] = { deps: d, limpar: f() };
    }) as unknown as typeof real.useEffect,
  };
});
vi.mock("./useEventosInbox", () => ({ useEventosInbox: (f: typeof m.aoAviso) => { m.aoAviso = f; return { conectado: true }; } }));
vi.mock("@/components/conversa/useConversa", () => ({ useConversa: (_id: unknown, aviso: unknown) => { m.avisoThread = aviso; return { mensagens: [] }; } }));
vi.mock("@/server/whatsapp/acoes", () => ({ enviarTextoInbox: vi.fn(), enviarMidiaInbox: vi.fn(), registrarOptOutContato: vi.fn(), removerOptOutContato: vi.fn() }));
vi.mock("@/server/whatsapp/preferencias", () => ({ marcarAtendimentoLidoAutomatico: marcar, alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/inbox", useSearchParams: () => m.parametros313 === null ? null : new URLSearchParams(m.parametros313) }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { criarGanchos, elementos } from "@/test/tela-sem-dom";
import { ConversaAberta } from "./ConversaAberta";
import { ColunaConversas } from "./ColunaConversas";
import { AcoesContato } from "./AcoesContato";
import { PainelContato } from "./PainelContato";
import { ModalTarefa } from "./ModalTarefa";
import { AbaAtividade } from "./abas/AbaAtividade";
import { AbaOportunidades } from "./abas/AbaOportunidades";
import { PainelSetor } from "./PainelSetor";
import { AbaDetalhes } from "./abas/AbaDetalhes";

import { LinhaCampo } from "./LinhaCampo";
import { OptOutContato } from "./OptOutContato";
import { PainelTriagem } from "./PainelTriagem";
import { InboxNovo, type PropsInboxNovo } from "./InboxNovo";
import { TagsContato } from "./abas/TagsContato";
import { ContatoSemNome } from "./abas/ContatoSemNome";
import { GavetaContato } from "./abas/GavetaContato";

const item = (id: string) => ({
  id, numeroId: "n1", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: DriverWhatsApp.META_CLOUD, contatoId: `c-${id}`, contatoNome: id,
  contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: id === "a2" ? 2 : 0, ultimaMensagemEm: "2026-10-01T02:30:00.000Z", preview: "Oi",
  linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
});
const props = {
  inicial: { itens: [item("a1"), item("a2")], proximo: null }, filtros: {}, selecionado: "a1",
  usuario: { id: "u1", papeis: ["VENDEDOR"] }, fuso: null, agoraInicial: Date.parse("2026-03-29T23:30:00.000Z"),
} as unknown as PropsInboxNovo;

let respostaPainel: () => Response | Promise<Response>;
let respostaLista: () => Promise<Response>;
let regiaoConversaVisivel: boolean;
const chamadasPainel: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  m.modo = null;
  m.parametros313 = null;
  regiaoConversaVisivel = true;
  marcar.mockReset(); marcar.mockResolvedValue({ ok: true });
  m.aoVisibilidade = null;
  vi.stubGlobal("document", { visibilityState: "visible", querySelectorAll: () => [],
    addEventListener: (tipo: string, f: () => void) => { if (tipo === "visibilitychange") m.aoVisibilidade = f; },
    removeEventListener: (tipo: string, f: () => void) => { if (tipo === "visibilitychange" && m.aoVisibilidade === f) m.aoVisibilidade = null; },
  });
  m.g = criarGanchos(); m.efeitos = []; m.aoAviso = null; chamadasPainel.length = 0;
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true }), { status: 200 });
  respostaLista = async () => new Response(JSON.stringify({ itens: props.inicial.itens, proximo: null }), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/painel/detalhes")) return new Response(JSON.stringify({ pessoa: null, oportunidade: null, b2b: null, campos: [] }));
    if (url.endsWith("/painel")) { chamadasPainel.push(url); return respostaPainel(); }
    return respostaLista();
  }));
});
afterEach(() => { for (const e of m.efeitos) if (typeof e.limpar === "function") e.limpar(); m.g = null; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const esvaziar = () => vi.advanceTimersByTimeAsync(50);
function tela(p: PropsInboxNovo = props): ReactNode {
  m.posEfeito = 0;
  const t = m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode, p);
  const secao = elementos(t).find((n) => n.type === "section" && n.props["aria-label"] === "Conversa");
  const ref = (secao as { ref?: { current: unknown } } | undefined)?.ref;
  if (ref) ref.current = { getClientRects: () => regiaoConversaVisivel ? [{}] : [], closest: () => null, focus() {} };
  return t;
}
const conversa = (t: ReactNode) => elementos(t).find((n) => n.type === ConversaAberta)!.props as Pick<import("./ConversaAberta").PropsConversaAberta, "podeEnviar" | "falhaPermissao" | "podeUsarInsights" | "aoMudar">;
const lista = (t: ReactNode) => elementos(t).find((n) => n.type === ColunaConversas)!.props as { itens: { id: string; naoLidas: number }[]; aoSelecionar(id: string): void };

describe("InboxNovo: identidades React dos painéis", () => {
  it("conserva ações restantes na mesma conversa e troca sua identidade ao selecionar outra", async () => {
    respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true, aria: {}, acoes: {} }), { status: 200 });
    const paineis = (t: ReactNode) => elementos(t).filter((n) => n.type === AcoesContato) as ReactElement<{ atendimentoId: string }>[];
    tela(); await esvaziar();
    const anteriores = paineis(tela());
    expect(anteriores).toHaveLength(1); // AcoesContato permanece uma única montagem.
    expect(anteriores.every((p) => p.props.atendimentoId === "a1")).toBe(true);
    expect(anteriores[0].key).not.toBeNull();
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a1", conversaId: "cv1", mensagemId: null });
    tela(); await esvaziar();
    expect(paineis(tela()).map((p) => p.key)).toEqual(anteriores.map((p) => p.key));

    lista(tela()).aoSelecionar("a2");
    tela(); await esvaziar();
    const atuais = paineis(tela());
    expect(atuais).toHaveLength(1);
    for (const [i, atual] of atuais.entries()) {
      expect(atual.props.atendimentoId).toBe("a2");
      expect(atual.type).toBe(anteriores[i].type);
      expect(atual.key).not.toBe(anteriores[i].key);
    }
  });
});
const pagina = (itens: ReturnType<typeof item>[]) => new Response(JSON.stringify({ itens, proximo: null }), { status: 200 });
const mudarVisibilidade = (estado: string) => { (document as unknown as { visibilityState: string }).visibilityState = estado; };

describe("InboxNovo: leitura ao abrir", () => {
  it("soma entrada oculta nova à contagem prévia conhecida mesmo com leitura e recuperação falhas", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 2 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "m-antiga", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(2);
    respostaLista = async () => new Response("", { status: 503 });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-nova-apos-contagem", conversaId: "cv1" });
    await esvaziar(); tela();
    marcar.mockResolvedValue({ ok: false });
    respostaLista = async () => new Response("", { status: 503 });
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(3);
  });
  it("GET fresco que já inclui a mensagem corrige a contagem após SSE atrasado", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 3 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "status-ja-incluiu", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(3);
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-ja-contada", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(3);
  });
  it("GET iniciado antes da entrada oculta não apaga a contagem quando responde depois", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 2 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "status-contagem", conversaId: "cv1" });
    await esvaziar(); tela();
    let concluirAntigo!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirAntigo = ok; });
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "status-antigo", conversaId: "cv1" });
    await vi.advanceTimersByTimeAsync(50);
    expect(concluirAntigo).toBeTypeOf("function"); // GET começou antes da entrada oculta
    respostaLista = async () => new Response("", { status: 503 });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-apos-get", conversaId: "cv1" });
    concluirAntigo(pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]));
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(3);
  });
  it("entrada oculta mantém contagem conhecida se leitura e GET de recuperação falharem", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    let concluirAntigo!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirAntigo = ok; });
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "status-pre-entrada", conversaId: "cv1" });
    await vi.advanceTimersByTimeAsync(50);
    expect(concluirAntigo).toBeTypeOf("function"); // corpo antigo aberto antes do SSE
    respostaLista = async () => new Response("", { status: 503 });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-oculta-falha", conversaId: "cv1" });
    concluirAntigo(pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]));
    await esvaziar(); tela();
    marcar.mockResolvedValue({ ok: false });
    respostaLista = async () => new Response("", { status: 503 });
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
  });
  it("GET fresco zero após SSE aceita leitura de outra aba e mantém tentativa pessoal independente", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-outra-aba", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    marcar.mockResolvedValue({ ok: false });
    respostaLista = async () => new Response("", { status: 503 });
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    await esvaziar(); tela();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    mudarVisibilidade("hidden"); m.aoVisibilidade!();
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledTimes(2);
    await esvaziar();
  });
  it("GET fresco da mesma versão corrige zero mesmo se a leitura falhar antes da resposta", async () => {
    tela(); await esvaziar();
    respostaLista = async () => new Response("", { status: 503 });
    let concluirLeitura!: (r: { ok: boolean }) => void;
    marcar.mockImplementationOnce(() => new Promise((ok) => { concluirLeitura = ok; }));
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-resposta-perdida", conversaId: "cv1" });
    let concluirFresco!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirFresco = ok; });
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "status-pos-pedido", conversaId: "cv1" });
    await vi.advanceTimersByTimeAsync(50);
    expect(concluirFresco).toBeTypeOf("function"); // consulta na mesma versão, ação ainda pendente
    respostaLista = async () => new Response("", { status: 503 });
    concluirLeitura({ ok: false }); await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
    concluirFresco(pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]));
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
  });
  it("sucesso não transforma IDs pendentes em não lidas depois de GET fresco zero", async () => {
    tela(); await esvaziar();
    mudarVisibilidade("hidden");
    respostaLista = async () => new Response("", { status: 503 });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-primeira", conversaId: "cv1" });
    await esvaziar(); tela();
    let concluirLeitura!: (r: { ok: boolean }) => void;
    marcar.mockImplementationOnce(() => new Promise((ok) => { concluirLeitura = ok; }));
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-durante", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    concluirLeitura({ ok: true }); await esvaziar(); tela(); marcar.mockClear();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
    await esvaziar();
  });
  it("entrada oculta com leitura e GET falhos permite tentativa no próximo retorno", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 0 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-oculta-retry", conversaId: "cv1" });
    await esvaziar(); tela();
    marcar.mockResolvedValue({ ok: false });
    respostaLista = async () => new Response("", { status: 503 });
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    await esvaziar(); tela(); marcar.mockClear();
    mudarVisibilidade("hidden"); m.aoVisibilidade!();
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("restaura as entradas ocultas únicas conhecidas, sem contar SSE repetido duas vezes", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    respostaLista = async () => new Response("", { status: 503 });
    for (const mensagemId of ["m-1", "m-1", "m-2"]) m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId, conversaId: "cv1" });
    await esvaziar(); tela();
    marcar.mockResolvedValue({ ok: false });
    respostaLista = async () => new Response("", { status: 503 });
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    await esvaziar(); tela();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(2);
  });
  it("sucesso consome só as entradas ocultas observadas antes do pedido", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-antes", conversaId: "cv1" });
    await esvaziar(); tela();
    let concluir!: () => void;
    marcar.mockImplementationOnce(() => new Promise((ok) => { concluir = () => ok({ ok: true }); }));
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    mudarVisibilidade("hidden");
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-depois", conversaId: "cv1" });
    concluir(); await esvaziar(); tela(); marcar.mockClear();
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("voltar à aba com zero não lidas e sem mensagem nova não repete a ação de leitura", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    for (let i = 0; i < 3; i++) {
      mudarVisibilidade("hidden"); m.aoVisibilidade!();
      mudarVisibilidade("visible"); m.aoVisibilidade!();
      await esvaziar(); tela();
    }
    expect(marcar).not.toHaveBeenCalled();
  });
  it("mensagem recebida oculta continua pendente mesmo se a leitura anterior terminar com zero", async () => {
    let concluir!: () => void;
    marcar.mockImplementationOnce(() => new Promise((ok) => { concluir = () => ok({ ok: true }); }));
    tela(); mudarVisibilidade("hidden");
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-apos-pedido", conversaId: "cv1" });
    concluir(); await esvaziar(); tela(); marcar.mockClear();
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
    await esvaziar(); tela(); marcar.mockClear();
    mudarVisibilidade("hidden"); m.aoVisibilidade!();
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).not.toHaveBeenCalled();
  });
  it("retorno recupera repetição descartada por aba oculta antes da conclusão", async () => {
    let concluir!: () => void;
    marcar.mockImplementationOnce(() => new Promise((ok) => { concluir = () => ok({ ok: true }); }));
    tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-em-voo", conversaId: "cv1" });
    mudarVisibilidade("hidden"); concluir(); await esvaziar();
    expect(marcar).toHaveBeenCalledTimes(1);
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledTimes(2);
  });
  it("voltar à aba visível lê a conversa exibida sem esperar outro aviso SSE", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    mudarVisibilidade("hidden");
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-oculta", conversaId: "cv1" });
    await esvaziar(); tela();
    expect(marcar).not.toHaveBeenCalled();
    expect(typeof m.aoVisibilidade).toBe("function");
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("voltar à aba não lê a thread oculta na lista e remove o listener ao desmontar", async () => {
    const t = tela(); await esvaziar(); marcar.mockClear();
    (conversa(t) as unknown as { aoVoltar(): void }).aoVoltar();
    regiaoConversaVisivel = false; tela();
    expect(typeof m.aoVisibilidade).toBe("function");
    mudarVisibilidade("visible"); m.aoVisibilidade!();
    expect(marcar).not.toHaveBeenCalled();
    for (const e of m.efeitos) if (typeof e.limpar === "function") e.limpar();
    expect(m.aoVisibilidade).toBeNull();
  });
  it("Voltar no celular mantém a nova mensagem não lida enquanto a região da conversa está oculta", async () => {
    const t = tela(); await esvaziar(); marcar.mockClear();
    (conversa(t) as unknown as { aoVoltar(): void }).aoVoltar();
    regiaoConversaVisivel = false; tela();
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 1 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-lista", conversaId: "cv1" });
    await esvaziar();
    expect(marcar).not.toHaveBeenCalled();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
    lista(tela()).aoSelecionar("a1");
    regiaoConversaVisivel = true; tela();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("não lê entrada quando o painel ocupa a vista da conversa no celular", async () => {
    m.modo = "uma"; vi.stubGlobal("window", { innerWidth: 390 });
    const t = tela(); await esvaziar(); marcar.mockClear();
    cabecalho(t).aoAlternarPainel();
    regiaoConversaVisivel = false; tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-painel", conversaId: "cv1" });
    expect(marcar).not.toHaveBeenCalled();
  });
  it("a região ainda visível em duas colunas continua lendo após voltar à lista", async () => {
    const t = tela(); await esvaziar(); marcar.mockClear();
    (conversa(t) as unknown as { aoVoltar(): void }).aoVoltar(); tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-desktop", conversaId: "cv1" });
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("descarta repetição pendente ao ocultar a conversa antes da leitura em voo terminar", async () => {
    let concluir!: () => void;
    marcar.mockImplementation(() => new Promise((ok) => { concluir = () => ok({ ok: true }); }));
    const t = tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-pendente", conversaId: "cv1" });
    (conversa(t) as unknown as { aoVoltar(): void }).aoVoltar();
    regiaoConversaVisivel = false; tela(); concluir(); await esvaziar();
    expect(marcar).toHaveBeenCalledTimes(1);
  });
  it("descarta repetição pendente quando a aba fica oculta antes da conclusão", async () => {
    let concluir!: () => void;
    marcar.mockImplementation(() => new Promise((ok) => { concluir = () => ok({ ok: true }); }));
    tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m-aba", conversaId: "cv1" });
    mudarVisibilidade("hidden"); concluir(); await esvaziar();
    expect(marcar).toHaveBeenCalledTimes(1);
  });
  it("marca o atendimento selecionado pelo deep link inicial", () => {
    tela();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("ao abrir outra conversa, zera imediatamente o contador da lista", () => {
    const lista = (t: ReactNode) => elementos(t).find((n) => n.type === ColunaConversas)!.props as { itens: { id: string; naoLidas: number }[]; aoSelecionar(id: string): void };
    lista(tela()).aoSelecionar("a2");
    tela(); // o efeito da nova seleção publica o estado no render seguinte
    expect(lista(tela()).itens.find((i) => i.id === "a2")?.naoLidas).toBe(0);
    expect(marcar).toHaveBeenLastCalledWith("a2");
  });
  it("mensagem nova marca apenas a conversa aberta quando a aba está visível", async () => {
    tela(); await esvaziar(); marcar.mockClear();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a2", mensagemId: "m2", conversaId: "cv2" });
    expect(marcar).not.toHaveBeenCalled();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
    marcar.mockClear();
    mudarVisibilidade("hidden");
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m3", conversaId: "cv1" });
    expect(marcar).not.toHaveBeenCalled();
  });
  it("aviso recebido durante uma leitura em voo agenda uma só repetição", async () => {
    const resolver: (() => void)[] = [];
    marcar.mockImplementation(() => new Promise((ok) => resolver.push(() => ok({ ok: true }))));
    tela();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m2", conversaId: "cv1" });
    expect(marcar).toHaveBeenCalledTimes(1);
    resolver[0]();
    await vi.waitFor(() => expect(marcar).toHaveBeenCalledTimes(2));
  });
  it("GET da mensagem nova não repõe não lidas enquanto a leitura da conversa aberta está em voo", async () => {
    tela(); await esvaziar();
    let concluirLeitura!: (r: { ok: boolean }) => void;
    marcar.mockImplementation(() => new Promise((ok) => { concluirLeitura = ok; }));
    let concluirLista!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirLista = ok; });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar(); // GET começa enquanto a leitura segue pendente
    concluirLista(pagina([{ ...item("a1"), naoLidas: 1 }, item("a2")]));
    await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    concluirLeitura({ ok: true });
    await esvaziar();
  });
  it("GET iniciado antes de abrir outra conversa não desfaz o zero otimista", async () => {
    tela(); await esvaziar();
    let concluirLista!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirLista = ok; });
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a2", mensagemId: null, conversaId: "cv2" });
    await esvaziar(); // snapshot iniciado antes da troca de seleção
    let concluirLeitura!: (r: { ok: boolean }) => void;
    marcar.mockImplementation(() => new Promise((ok) => { concluirLeitura = ok; }));
    lista(tela()).aoSelecionar("a2");
    tela();
    concluirLista(pagina([item("a1"), item("a2")]));
    await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a2")?.naoLidas).toBe(0);
    concluirLeitura({ ok: true });
    await esvaziar();
  });
  it("GET em voo ainda é tratado como antigo após a leitura concluir; GET novo mostra a contagem atual", async () => {
    tela(); await esvaziar();
    let concluirLista!: (r: Response) => void;
    respostaLista = () => new Promise((ok) => { concluirLista = ok; });
    let concluirLeitura!: (r: { ok: boolean }) => void;
    marcar.mockImplementation(() => new Promise((ok) => { concluirLeitura = ok; }));
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar(); // snapshot iniciado antes da conclusão da leitura
    concluirLeitura({ ok: true });
    await esvaziar();
    concluirLista(pagina([{ ...item("a1"), naoLidas: 1 }, item("a2")]));
    await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(0);
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 1 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
  });
  it("falha real da leitura restaura a contagem do servidor", async () => {
    tela(); await esvaziar();
    marcar.mockResolvedValue({ ok: false });
    lista(tela()).aoSelecionar("a2");
    tela(); await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a2")?.naoLidas).toBe(2);
  });
  it("rejeição da ação com GET falho restaura a última contagem conhecida", async () => {
    tela(); await esvaziar();
    marcar.mockRejectedValue(new Error("sem conexão"));
    respostaLista = async () => new Response("", { status: 503 });
    lista(tela()).aoSelecionar("a2");
    tela(); await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a2")?.naoLidas).toBe(2);
  });
  it("GET da leitura anterior não desfaz a restauração após falha; GET fresco continua válido", async () => {
    tela(); await esvaziar(); // leitura inicial v1 concluída
    let concluirAntigo!: (r: Response) => void;
    let consultas = 0;
    respostaLista = () => {
      consultas++;
      return consultas === 1 ? new Promise((ok) => { concluirAntigo = ok; }) : Promise.resolve(new Response("", { status: 503 }));
    };
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "m0", conversaId: "cv1" });
    await esvaziar(); // voo v1 permanece aberto
    marcar.mockResolvedValue({ ok: false });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar(); // a leitura v2 falha; a consulta de reconciliação também falha
    expect(consultas).toBe(1); // eventos/leitura compartilham uma pendência, sem GET concorrente
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
    concluirAntigo(pagina([item("a1"), item("a2")]));
    await esvaziar();
    expect(consultas).toBe(2); // recuperação fresca após consumir o corpo antigo
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
    respostaLista = async () => pagina([{ ...item("a1"), naoLidas: 2 }, item("a2")]);
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar();
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(2);
  });
});

describe("InboxNovo: permissão de envio carregando × falhou (C2 da revisão do #218)", () => {
  it("antes do painel chegar o compositor recebe null (carregando), não false", async () => {
    expect(conversa(tela()).podeEnviar).toBeNull();
    expect(conversa(tela()).falhaPermissao).toBeUndefined();
    await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(true);
  });
  it("painel negado pelo servidor: false (o motivo de falta de permissão)", async () => {
    respostaPainel = () => new Response(JSON.stringify({ podeEnviar: false }), { status: 200 });
    tela(); await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(false);
  });
  it("falha ao buscar o painel: estado de erro com tentar de novo, que volta a carregar e recupera", async () => {
    respostaPainel = () => new Response("", { status: 500 });
    tela(); await esvaziar();
    const c = conversa(tela());
    expect(c.podeEnviar).toBeNull();
    expect(typeof c.falhaPermissao).toBe("function");
    respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true }), { status: 200 });
    c.falhaPermissao!();
    const recarregando = conversa(tela());
    expect(recarregando.podeEnviar).toBeNull();
    expect(recarregando.falhaPermissao).toBeUndefined();
    await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(true);
    expect(chamadasPainel).toHaveLength(2);
  });
});

describe("InboxNovo: aviso do SSE recarrega o painel do atendimento aberto (C3 da revisão do #218)", () => {
  it("aviso do atendimento selecionado recarrega o painel e o compositor libera (transferência/convite com envio)", async () => {
    respostaPainel = () => new Response(JSON.stringify({ podeEnviar: false }), { status: 200 });
    tela(); await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(false);
    respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true }), { status: 200 });
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a1", mensagemId: null, conversaId: "cv1" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(2);
    expect(conversa(tela()).podeEnviar).toBe(true);
  });
  it("resync recarrega o painel", async () => {
    tela(); await esvaziar();
    m.aoAviso!({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(2);
  });
  it("mensagem.nova e mensagem.status do atendimento selecionado não recarregam o painel (C1 da R1 do #220)", async () => {
    tela(); await esvaziar();
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    tela(); await esvaziar();
    m.aoAviso!({ tipo: "mensagem.status", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(1);
  });
  it("recarga por aviso que falha mantém o último true conhecido: sem erro no meio da digitação (C2 da R1 do #220)", async () => {
    tela(); await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(true);
    respostaPainel = () => new Response("", { status: 500 });
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a1", mensagemId: null, conversaId: "cv1" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(2);
    const c = conversa(tela());
    expect(c.podeEnviar).toBe(true);
    expect(c.falhaPermissao).toBeUndefined();
  });
  it("recarga por aviso que volta 404 (acesso revogado) trava o compositor, sem erro de tentar de novo (C1 da revisão do #223)", async () => {
    tela(); await esvaziar();
    expect(conversa(tela()).podeEnviar).toBe(true);
    respostaPainel = () => new Response(JSON.stringify({ erro: "Atendimento não encontrado." }), { status: 404 });
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a1", mensagemId: null, conversaId: "cv1" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(2);
    const c = conversa(tela());
    expect(c.podeEnviar).toBe(false);
    expect(c.falhaPermissao).toBeUndefined();
  });
  it("404 na carga inicial segue como erro com tentar de novo", async () => {
    respostaPainel = () => new Response("", { status: 404 });
    tela(); await esvaziar();
    const c = conversa(tela());
    expect(c.podeEnviar).toBeNull();
    expect(typeof c.falhaPermissao).toBe("function");
  });
  it("aviso de outro atendimento não recarrega o painel", async () => {
    tela(); await esvaziar();
    m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a2", mensagemId: null, conversaId: "cv2" });
    tela(); await esvaziar();
    expect(chamadasPainel).toHaveLength(1);
  });
});

describe("contagens no estado produtor para os chips", () => {
  const inicial = { todas: 90, minhas: 4, naoLidas: 8, prazo: 2, fila: 9 };
  const render = (p: PropsInboxNovo = { ...props, selecionado: null, contagens: inicial }): ReactNode => {
    m.posEfeito = 0;
    return m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode, p);
  };
  const resposta = (naoLidas: number) => new Response(JSON.stringify({ itens: props.inicial.itens, proximo: null, contagens: { ...inicial, naoLidas } }));
  it("inicializa do servidor e consolida SSE com atualização final fresca; não calcula pelo tamanho da página", async () => {
    const resolver: ((r: Response) => void)[] = [];
    respostaLista = () => new Promise((ok) => resolver.push(ok));
    render(); expect(m.contagens).toEqual(inicial);
    const aviso = { tipo: "resync" as const, atendimentoId: null, mensagemId: null, conversaId: "" };
    m.aoAviso!(aviso); await esvaziar(); m.aoAviso!(aviso);
    expect(resolver).toHaveLength(1);
    resolver[0](resposta(20)); await esvaziar(); render(); expect(m.contagens).toEqual({ ...inicial, naoLidas: 20 });
    expect(resolver).toHaveLength(2); resolver[1](resposta(3)); await esvaziar(); render(); expect(m.contagens).toEqual({ ...inicial, naoLidas: 3 });
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).includes("contagens=1"))).toBe(true);
  });
  it("troca de filtros preserva os agregados novos mesmo se o GET antigo terminar depois", async () => {
    let concluir!: (r: Response) => void; respostaLista = () => new Promise((ok) => { concluir = ok; });
    render(); m.aoAviso!({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    await esvaziar();
    const p = { ...props, selecionado: null, filtros: { busca: "novo" }, contagens: { ...inicial, todas: 2 } };
    render(p); render(p); concluir(resposta(30)); await esvaziar(); render(p);
    expect(m.contagens).toEqual(p.contagens);
  });
  it.each([true, false])("leitura em voo não aceita agregado antigo e reconcilia após resultado %s", async (ok) => {
    let ler!: (r: { ok: boolean }) => void; marcar.mockImplementation(() => new Promise((resolve) => { ler = resolve; }));
    const resolver: ((r: Response) => void)[] = []; respostaLista = () => new Promise((resolve) => resolver.push(resolve));
    const p = { ...props, contagens: inicial };
    render(p); m.aoAviso!({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    await esvaziar();
    resolver[0](resposta(60)); await esvaziar(); render(p); expect(m.contagens).toEqual(inicial);
    ler({ ok }); await esvaziar(); expect(resolver).toHaveLength(2);
    resolver[1](resposta(ok ? 0 : 8)); await esvaziar(); render(p);
    expect(m.contagens).toEqual({ ...inicial, naoLidas: ok ? 0 : 8 });
  });
});
const cabecalho = (t: ReactNode) => elementos(t).find((n) => n.type === ConversaAberta)!.props as unknown as import("./ConversaAberta").PropsConversaAberta;
describe("ligação do painel à casca", () => {
  it("toggle considera automático efetivo, não apenas escolha true", () => {
    m.modo = "tres"; vi.stubGlobal("window", { innerWidth: 1440 });
    expect(cabecalho(tela()).painelAberto).toBe(true);
    cabecalho(tela()).aoAlternarPainel(); expect(cabecalho(tela()).painelAberto).toBe(false);
    cabecalho(tela()).aoAlternarPainel(); expect(cabecalho(tela()).painelAberto).toBe(true);
  });
  it("abaixo do corte muda vista; ao cruzar três colunas retorna ao automático", () => {
    m.modo = "uma"; vi.stubGlobal("window", { innerWidth: 390 });
    cabecalho(tela()).aoAlternarPainel(); expect(elementos(tela())[0].props["data-vista"]).toBe("painel");
    m.modo = "tres"; tela(); const atual = tela();
    expect(cabecalho(atual).painelAberto).toBe(true); expect(cabecalho(atual).painelAuto).toBe(true);
    expect(elementos(atual)[0].props["data-vista"]).toBe("conversa");
  });
});

it("referência civil do SSR permanece estável ao selecionar e receber SSE",async()=>{
 const referencia=(t:ReactNode)=>(elementos(t).find(n=>n.type===ConversaAberta)!.props as {agoraInicial?:number}).agoraInicial;
 expect(referencia(tela())).toBe(props.agoraInicial);
 lista(tela()).aoSelecionar("a2");await esvaziar();expect(referencia(tela())).toBe(props.agoraInicial);
 m.aoAviso!({tipo:"mensagem.nova",atendimentoId:"a2",mensagemId:"m314",conversaId:"cv2"});await esvaziar();expect(referencia(tela())).toBe(props.agoraInicial);
});

const navegar313=(p:PropsInboxNovo)=>{tela(p);return tela(p);};
const coluna313=(t:ReactNode)=>elementos(t).find(n=>n.type===ColunaConversas)!.props as unknown as import("./ColunaConversas").PropsColunaConversas;
it("navegação AppRouter troca c real e fechaNova, mas prop inalterada conserva seleção local",async()=>{
 tela();await esvaziar();coluna313(tela()).aoNovaConversa();expect(coluna313(tela()).novaConversaAberta).toBe(true);
 const navegada={...props,selecionado:"a2"};const t=navegar313(navegada);expect(coluna313(t).selecionado).toBe("a2");expect(coluna313(t).novaConversaAberta).toBe(false);expect(elementos(t)[0].props["data-vista"]).toBe("conversa");
 coluna313(t).aoSelecionar("a1");expect(coluna313(tela(navegada)).selecionado).toBe("a1");
});
it("navegação c→null retorna lista e não deixa a conversa anterior selecionada",async()=>{
 tela();await esvaziar();const t=navegar313({...props,selecionado:null});expect(coluna313(t).selecionado).toBeNull();expect(elementos(t)[0].props["data-vista"]).toBe("lista");expect(elementos(t).some(n=>n.type===ConversaAberta)).toBe(false);
});
it("filtro e navegação concorrentes usam juntos a nova página e o novo selecionado",async()=>{
 tela();await esvaziar();const novo={...props,filtros:{busca:"nova"},selecionado:"a3",inicial:{itens:[item("a3")],proximo:"p3"}} as PropsInboxNovo;
 const t=navegar313(novo);expect(coluna313(t).selecionado).toBe("a3");expect(coluna313(t).itens.map(i=>i.id)).toEqual(["a3"]);expect(coluna313(t).proximo).toBe("p3");expect(coluna313(t).filtros).toEqual({busca:"nova"});
});
it("navegar para null descarta repetição e falha tardia da leitura anterior",async()=>{
 let concluir!:(r:{ok:boolean})=>void;marcar.mockImplementationOnce(()=>new Promise(r=>{concluir=r;}));
 const inicial={...props,inicial:{itens:[{...item("a1"),naoLidas:7},item("a2")],proximo:null}} as PropsInboxNovo;
 tela(inicial);m.aoAviso!({tipo:"mensagem.nova",atendimentoId:"a1",mensagemId:"m313",conversaId:"cv1"});
 const navegada={...inicial,selecionado:null,inicial:{itens:[{...item("a1"),naoLidas:3},item("a2")],proximo:null}} as PropsInboxNovo;
 navegar313(navegada);concluir({ok:false});await esvaziar();const t=tela(navegada);expect(marcar).toHaveBeenCalledTimes(1);expect(coluna313(t).itens.find(i=>i.id==="a1")?.naoLidas).toBe(3);
});


describe("composição318: Detalhes do contato selecionado", () => {
  const painel = (t: ReactNode) => elementos(t).find(n => n.type === PainelContato)!;
  it("liga identidade/tags autorizadas e mantém a ordem dos blocos restantes sem painel Aria", async () => {
    const tags = [{ id: "noite", rotulo: "Noite", ia: true }];
    respostaPainel = () => new Response(JSON.stringify({ setor: "COMERCIAL", tags, podeEnviar: true, cabecalho: { pessoaId: null, tagsDisponiveis: [], semNome: false, subtitulo: "Pessoa física · Inglês", quadrado: false, capacidades: { veLead: false, verContato: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, tarefas: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: false } }, aria: { pausada: true, motivo: "CELULAR", podeDevolver: false, podeDecidir: false, cartoes: [], handoff: null }, acoes: {} }));
    const p = { ...props, triagem: [{ id: "t1" }] as PropsInboxNovo["triagem"], revisoes: [] };
    tela(p); await esvaziar(); const t = tela(p), no = painel(t);
    expect(no.props.contato).toEqual({ id: "c-a1", nome: "a1", subtitulo: "Pessoa física · Inglês", tags, quadrado: false });
    expect(no.props.abas).toEqual([{ id: "detalhes", rotulo: "Detalhes" }, { id: "oportunidades", rotulo: "Oportunidades" }, { id: "atividade", rotulo: "Atividade" }]); expect(no.props.abaAtiva).toBe("detalhes");
    const blocos = elementos(no.props.children as ReactNode).filter(n => [AbaDetalhes, AcoesContato, OptOutContato, PainelTriagem].includes(n.type as never));
    expect(blocos.map(n => n.type)).toEqual([AbaDetalhes, AcoesContato, OptOutContato, PainelTriagem]);
    expect(blocos[0].props.dados).toEqual({ pessoa: null, oportunidade: null, b2b: null, campos: [] });
    expect(elementos(t).filter(n => n.type === PainelContato)).toHaveLength(1);
    expect(elementos(t).filter(n => n.type === PainelTriagem)).toHaveLength(1);
    expect(elementos(t).find(n => n.type === ConversaAberta)!.props).not.toHaveProperty("triagem");
    expect(elementos(t).find(n => n.type === ConversaAberta)!.props).not.toHaveProperty("revisoes");
  });
  it("não reaproveita tags de outra seleção durante a carga e reinicia a aba em Detalhes", async () => {
    respostaPainel = () => new Response(JSON.stringify({ setor: "COMERCIAL", tags: [{ id: "privadaA", rotulo: "Privada A", ia: false }], podeEnviar: true }));
    tela(); await esvaziar(); const antes = tela();
    (painel(antes).props.aoTrocarAba as (id: string) => void)("atividade");
    lista(antes).aoSelecionar("a2");
    const depois = painel(tela());
    expect(depois.props.contato).toMatchObject({ id: "c-a2", nome: "a2", tags: [] });
    expect(depois.props.abaAtiva).toBe("detalhes");
    lista(tela()).aoSelecionar("a1"); expect(painel(tela()).props.abaAtiva).toBe("detalhes");
  });
  it("telefone ausente e grupo preservam omissões; triagem sem seleção continua na ponte", () => {
    const semTelefone = { ...props, inicial: { itens: [{ ...item("a1"), contatoTelefone: "", grupo: true }], proximo: null } } as PropsInboxNovo;
    const no = painel(tela(semTelefone));
    expect(elementos(no.props.children as ReactNode).some(n => n.type === LinhaCampo || n.type === OptOutContato)).toBe(false);
    m.g = criarGanchos(); m.efeitos = [];
    const semSelecao = tela({ ...props, selecionado: null, triagem: [{ id: "t1" }] as PropsInboxNovo["triagem"], revisoes: [] });
    expect(elementos(semSelecao).filter(n => n.type === PainelTriagem)).toHaveLength(1);
    expect(elementos(semSelecao).some(n => n.type === PainelContato)).toBe(false);
  });
});
it("revalidação confirma seleção local e mescla50frescos sem descartar150/paginação nem vista após retorno/resize",async()=>{
 habilitarRota313();
 const itens=Array.from({length:150},(_,i)=>({...item("v"+i),ultimaMensagemEm:new Date(Date.UTC(2026,9,1,12)-i*1000).toISOString()}));const p={...props,selecionado:null,inicial:{itens:itens.slice(0,50),proximo:"cursor50"}} as PropsInboxNovo;
 let cursor=50;respostaLista=async()=>{const inicio=cursor;cursor+=50;return new Response(JSON.stringify({itens:itens.slice(inicio,cursor),proximo:cursor<150?"cursor100":null}))};marcar.mockImplementation(()=>new Promise(()=>{}));
 tela(p);coluna313(tela(p)).aoCarregarMais();await esvaziar();coluna313(tela(p)).aoCarregarMais();await esvaziar();expect(coluna313(tela(p)).itens).toHaveLength(150);coluna313(tela(p)).aoSelecionar("v35");const aberta=tela(p);(cabecalho(aberta) as unknown as {aoVoltar():void}).aoVoltar();m.modo="uma";tela(p);
 const fresca={...p,selecionado:"v35",contagens:{todas:151,minhas:3,naoLidas:4,prazo:2,fila:1},inicial:{itens:itens.slice(0,50).map((v,i)=>i===0?{...v,preview:"Snapshot atualizado"}:v),proximo:"cursor50"}} as PropsInboxNovo;
 let t=navegar313(fresca);expect(coluna313(t).itens).toHaveLength(150);expect(coluna313(t).proximo).toBeNull();expect(coluna313(t).itens[0].preview).toBe("Snapshot atualizado");expect(coluna313(t).contagens).toEqual(fresca.contagens);expect(coluna313(t).selecionado).toBe("v35");expect(elementos(t)[0].props["data-vista"]).toBe("lista");m.modo="duas";t=navegar313(fresca);m.modo="uma";t=navegar313(fresca);expect(coluna313(t).itens).toHaveLength(150);expect(coluna313(t).selecionado).toBe("v35");
});
it("ack da seleção local conserva Nova aberta; somente mudança externa real fecha",()=>{
 const p={...props,selecionado:null};tela(p);coluna313(tela(p)).aoSelecionar("a2");coluna313(tela(p)).aoNovaConversa();const ack={...p,selecionado:"a2"};expect(coluna313(navegar313(ack)).novaConversaAberta).toBe(true);expect(coluna313(navegar313({...ack,selecionado:"a1"})).novaConversaAberta).toBe(false);
});
function habilitarRota313(consulta="") {
 m.parametros313=consulta;const local={href:"http://localhost/inbox"+(consulta?"?"+consulta:"")};vi.stubGlobal("window",{innerWidth:390,location:local,history:{replaceState(_d:unknown,_t:string,url:URL|string){local.href=String(url);m.parametros313=new URL(local.href).search.slice(1);}}});
}
it.each(["","c="])("Link para Inbox(%s) fechaNova e limpa seleção mesmo com propnull igual ao SSR anterior",(consulta)=>{
 habilitarRota313();const p={...props,selecionado:null};tela(p);coluna313(tela(p)).aoSelecionar("a2");navegar313(p);coluna313(tela(p)).aoNovaConversa();expect(coluna313(tela(p)).novaConversaAberta).toBe(true);expect(m.parametros313).toBe("c=a2");m.parametros313=consulta;const t=navegar313(p);expect(coluna313(t).selecionado).toBeNull();expect(coluna313(t).novaConversaAberta).toBe(false);expect(elementos(t)[0].props["data-vista"]).toBe("lista");
});
it("URL avança para idnovo e snapshotSSRantigo não reverte seleção/página nem repete leitura antiga",async()=>{
 habilitarRota313("c=a1");let concluir!:(v:{ok:boolean})=>void;marcar.mockImplementationOnce(()=>new Promise(r=>{concluir=r;}));tela(props);m.parametros313="c=a2";const novo={...props,selecionado:"a2",inicial:{itens:[{...item("a2"),preview:"Novo snapshot"}],proximo:null}} as PropsInboxNovo;const t=navegar313(novo);expect(coluna313(t).selecionado).toBe("a2");const chamadas=marcar.mock.calls.length;
 const antiga={...props,inicial:{itens:[{...item("a1"),preview:"Antigo"}],proximo:null}} as PropsInboxNovo;navegar313(antiga);concluir({ok:false});await esvaziar();const atual=tela(antiga);expect(coluna313(atual).selecionado).toBe("a2");expect(coluna313(atual).itens.some(i=>i.preview==="Antigo")).toBe(false);expect(marcar.mock.calls.length).toBe(chamadas);
});
it("URLlocal confirma própria seleção antes de SSR e conservaNova/vista até propcorrespondente chegar",()=>{
 habilitarRota313();const p={...props,selecionado:null};tela(p);coluna313(tela(p)).aoSelecionar("a2");navegar313(p);coluna313(tela(p)).aoNovaConversa();const t=navegar313(p);expect(coluna313(t).selecionado).toBe("a2");expect(coluna313(t).novaConversaAberta).toBe(true);const ack=navegar313({...p,selecionado:"a2"});expect(coluna313(ack).novaConversaAberta).toBe(true);
});
it("Linkc→null compropnull igual invalida GET anterior da conversa selecionada",async()=>{
 habilitarRota313();const p={...props,selecionado:null};marcar.mockImplementation(()=>new Promise(()=>{}));let concluir!:(r:Response)=>void;respostaLista=()=>new Promise(r=>{concluir=r;});tela(p);coluna313(tela(p)).aoSelecionar("a2");navegar313(p);m.aoAviso!({tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""});await esvaziar();m.parametros313="";navegar313(p);concluir(new Response(JSON.stringify({itens:[{...item("a1"),preview:"Snapshot GET obsoleto"}],proximo:null})));await esvaziar();expect(coluna313(tela(p)).itens.some(i=>i.preview==="Snapshot GET obsoleto")).toBe(false);
});

describe("C1: recarga de lista e contagens em lote", () => {
  const aviso = { tipo: "resync" as const, atendimentoId: null, mensagemId: null, conversaId: "" };
  const render = (p: PropsInboxNovo = { ...props, selecionado: null }) => {
    m.posEfeito=0; return m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode,p);
  };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("C1 agrupa20avisos sem atrasar o aviso consumido pela thread", async () => {
    render();
    for(let n=0;n<20;n++)m.aoAviso!(aviso);
    render(); expect(m.avisoThread).toEqual(aviso);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(49); expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("contagens=1");
  });
  it.each([200,503])("C1 não inicia GET2 enquanto body1HTTP%s segue aberto",async status => {
    let controle!: ReadableStreamDefaultController<Uint8Array>;
    const corpo=new ReadableStream<Uint8Array>({start(c){controle=c;}});
    respostaLista=vi.fn().mockResolvedValueOnce(new Response(corpo,{status}))
      .mockResolvedValue(new Response(JSON.stringify({itens:[],proximo:null})));
    render();m.aoAviso!(aviso);await vi.advanceTimersByTimeAsync(50);
    m.aoAviso!(aviso);await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    controle.enqueue(new TextEncoder().encode(JSON.stringify({itens:[],proximo:null})));controle.close();
    await vi.advanceTimersByTimeAsync(50);expect(fetch).toHaveBeenCalledTimes(2);
  });
});


describe("C1: fronteiras de leitura e contexto", () => {
  const inicial={todas:90,minhas:4,naoLidas:8,prazo:2,fila:9};
  const aviso={tipo:"resync" as const,atendimentoId:null,mensagemId:null,conversaId:""};
  const render=(p:PropsInboxNovo)=>{m.posEfeito=0;return m.g!.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,p);};
  const resposta=(n:number)=>new Response(JSON.stringify({itens:props.inicial.itens,proximo:null,contagens:{...inicial,naoLidas:n}}));
  it.each([true,false])("conclusão leitura=%s exige GET fresco após body anterior mesmo quando snapshot é descartado",async ok=>{
    let ler!:(r:{ok:boolean})=>void;marcar.mockImplementation(()=>new Promise(r=>{ler=r;}));
    let controle!:ReadableStreamDefaultController<Uint8Array>;
    const corpo=new ReadableStream<Uint8Array>({start(c){controle=c;}});
    let resolverFresco!:(r:Response)=>void;
    respostaLista=vi.fn().mockResolvedValueOnce(new Response(corpo))
      .mockImplementation(()=>new Promise(r=>{resolverFresco=r;}));
    const p={...props,contagens:inicial};render(p);m.aoAviso!(aviso);await esvaziar();
    ler({ok});await esvaziar();
    const ack={...p,filtros:{...p.filtros}};render(ack); // ACK com identidade nova, mesmo contexto público
    expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("?contagens"))).toHaveLength(1);
    controle.enqueue(new TextEncoder().encode(JSON.stringify({itens:props.inicial.itens,proximo:null,contagens:{...inicial,naoLidas:60}})));controle.close();
    await esvaziar();render(ack);expect(m.contagens).toEqual(inicial);
    expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("?contagens"))).toHaveLength(2);
    resolverFresco(resposta(ok?0:8));await esvaziar();render(ack);
    expect(m.contagens).toEqual({...inicial,naoLidas:ok?0:8});
  });
  it("captura fase da leitura no início real do GET e une conclusão ao lote ainda não iniciado",async()=>{
    let ler!:(r:{ok:boolean})=>void;marcar.mockImplementation(()=>new Promise(r=>{ler=r;}));
    respostaLista=async()=>resposta(0);
    const p={...props,contagens:inicial};render(p);m.aoAviso!(aviso);
    await vi.advanceTimersByTimeAsync(10);ler({ok:true});
    await vi.advanceTimersByTimeAsync(40);render(p);
    expect(m.contagens).toEqual({...inicial,naoLidas:0});
    expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("?contagens"))).toHaveLength(1);
  });
  it("A→B→A descarta voo antigo, cancela timerB e usa somente filtroA vigente no trailing",async()=>{
    const a={...props,selecionado:null,filtros:{busca:"A"},contagens:inicial};
    const b={...a,filtros:{busca:"B"},contagens:{...inicial,todas:2}};
    let antigo!:(r:Response)=>void;
    respostaLista=vi.fn().mockImplementationOnce(()=>new Promise(r=>{antigo=r;})).mockResolvedValue(resposta(3));
    render(a);m.aoAviso!(aviso);await esvaziar();
    render(b);m.aoAviso!(aviso);render(a);m.aoAviso!(aviso);await esvaziar();
    expect(fetch).toHaveBeenCalledTimes(1);
    antigo(resposta(60));await esvaziar();render(a);
    expect(m.contagens).toEqual({...inicial,naoLidas:3});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.map(([u])=>String(u))).toEqual([
      "/api/inbox/atendimentos?busca=A&contagens=1","/api/inbox/atendimentos?busca=A&contagens=1"]);
  });
  it("desmontar cancela timer e invalida snapshot que termina após cleanup",async()=>{
    const p={...props,selecionado:null,contagens:inicial};
    let concluir!:(r:Response)=>void;respostaLista=()=>new Promise(r=>{concluir=r;});
    render(p);m.aoAviso!(aviso);await esvaziar();m.aoAviso!(aviso);
    for(const e of m.efeitos)if(typeof e.limpar==="function")e.limpar();
    concluir(resposta(70));await vi.advanceTimersByTimeAsync(1000);render(p);
    expect(m.contagens).toEqual(inicial);expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});


it("C1 objeto de filtros equivalente não cancela reconciliação pendente", async()=>{
  const p={...props,selecionado:null,filtros:{busca:"A"}};
  m.posEfeito=0;m.g!.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,p);
  m.aoAviso!({tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""});
  m.posEfeito=0;m.g!.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,{...p,filtros:{busca:"A"}});
  await esvaziar();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("busca=A");
});

it("C1 ACKlocal150 conserva páginas/cursor/vista/Nova e reconciliação após leitura com body antigo e filtro equivalente",async()=>{
  habilitarRota313();
  const itens=Array.from({length:150},(_,i)=>({...item("v"+i),ultimaMensagemEm:new Date(Date.UTC(2026,9,1,12)-i*1000).toISOString()}));
  const contagens={todas:150,minhas:100,naoLidas:75,prazo:100,fila:50};
  const p={...props,selecionado:null,contagens,inicial:{itens:itens.slice(0,50),proximo:"cursor50"}} as PropsInboxNovo;
  let cursor=50;
  respostaLista=async()=>{const inicio=cursor;cursor+=50;return new Response(JSON.stringify({itens:itens.slice(inicio,cursor),proximo:cursor<150?"cursor100":null}));};
  tela(p);coluna313(tela(p)).aoCarregarMais();await esvaziar();coluna313(tela(p)).aoCarregarMais();await esvaziar();
  expect(coluna313(tela(p)).itens).toHaveLength(150);
  let ler!:(r:{ok:boolean})=>void;marcar.mockImplementation(()=>new Promise(r=>{ler=r;}));
  coluna313(tela(p)).aoSelecionar("v35");const aberta=tela(p);
  (cabecalho(aberta) as unknown as {aoVoltar():void}).aoVoltar();tela(p);coluna313(tela(p)).aoNovaConversa();
  let controle!:ReadableStreamDefaultController<Uint8Array>;
  const corpo=new ReadableStream<Uint8Array>({start(c){controle=c;}});
  let fresco!:(r:Response)=>void;
  respostaLista=vi.fn().mockResolvedValueOnce(new Response(corpo)).mockImplementation(()=>new Promise(r=>{fresco=r;}));
  m.aoAviso!({tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""});await esvaziar();
  ler({ok:true});await esvaziar();
  const ack={...p,selecionado:"v35",filtros:{...p.filtros},inicial:{...p.inicial,itens:p.inicial.itens.map((x,i)=>i===0?{...x,preview:"SSR fresco"}:x)}};
  navegar313(ack);
  controle.enqueue(new TextEncoder().encode(JSON.stringify({itens:p.inicial.itens,proximo:"cursor50",contagens:{...contagens,naoLidas:99}})));controle.close();
  await esvaziar();
  fresco(new Response(JSON.stringify({itens:p.inicial.itens,proximo:"cursor50",contagens:{...contagens,naoLidas:0}})));
  await esvaziar();
  const t=tela(ack),c=coluna313(t);
  expect(c.itens).toHaveLength(150);expect(c.proximo).toBeNull();expect(c.selecionado).toBe("v35");
  expect(c.novaConversaAberta).toBe(true);expect(elementos(t)[0].props["data-vista"]).toBe("lista");
  expect(c.contagens).toEqual({...contagens,naoLidas:0});
  expect(vi.mocked(respostaLista)).toHaveBeenCalledTimes(2);
});
it("C1 navegação URLreal para null cancela lote ainda não iniciado sem alterar sincronização313",async()=>{
  habilitarRota313("c=a1");marcar.mockImplementation(()=>new Promise(()=>{}));
  const p={...props,contagens:{todas:2,minhas:1,naoLidas:1,prazo:0,fila:0}};
  tela(p);m.aoAviso!({tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""});
  m.parametros313="";const vazia={...p,selecionado:null};navegar313(vazia);await esvaziar();
  expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("/atendimentos?"))).toHaveLength(0);
  expect(coluna313(tela(vazia)).selecionado).toBeNull();expect(vi.getTimerCount()).toBe(0);
});

describe("C1 P2: snapshot invalidado por props equivalentes durante voo",()=>{
  const contagens={todas:2,minhas:1,naoLidas:2,prazo:0,fila:0};
  const aviso={tipo:"resync" as const,atendimentoId:null,mensagemId:null,conversaId:""};
  const render=(p:PropsInboxNovo)=>{m.posEfeito=0;return m.g!.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,p);};
  const dados=(n:number)=>({itens:props.inicial.itens,proximo:null,contagens:{...contagens,naoLidas:n}});
  it.each([false,true])("P2 props equivalentes durantebody exigem snapshot fresco, leituraPendente=%s",async leituraPendente=>{
    let ler!:(r:{ok:boolean})=>void;
    if(leituraPendente)marcar.mockImplementation(()=>new Promise(r=>{ler=r;}));
    let controle!:ReadableStreamDefaultController<Uint8Array>;
    const corpo=new ReadableStream<Uint8Array>({start(c){controle=c;}});
    respostaLista=vi.fn().mockResolvedValueOnce(new Response(corpo))
      .mockResolvedValueOnce(new Response(JSON.stringify(dados(3))))
      .mockResolvedValue(new Response(JSON.stringify(dados(0))));
    const p={...props,selecionado:leituraPendente?"a1":null,filtros:{busca:"A"},contagens};
    render(p);m.aoAviso!(aviso);await esvaziar();
    const ack={...p,filtros:{busca:"A"}};render(ack);
    controle.enqueue(new TextEncoder().encode(JSON.stringify(dados(3))));controle.close();
    await esvaziar();render(ack);
    if(!leituraPendente)expect(m.contagens).toEqual({...contagens,naoLidas:3});
    expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("/atendimentos?"))).toHaveLength(2);
    if(leituraPendente){
      expect(m.contagens).toEqual(contagens);
      ler({ok:true});await esvaziar();render(ack);
      expect(m.contagens).toEqual({...contagens,naoLidas:0});
      expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes("/atendimentos?"))).toHaveLength(3);
    }
  });
});


describe("319: painel falha versus vazio e recuperação",()=>{
 it("falha inicial aparece no painel com retry real e sem detalhes técnicos",async()=>{
  respostaPainel=()=>new Response("detalhe técnico privado",{status:500});tela();await esvaziar();
  const t=tela(),alerta=elementos(t).find(n=>n.props.role==="alert");expect(alerta).toBeDefined();
  const {texto}=await import("@/test/tela-sem-dom");expect(texto(alerta!.props.children)).toContain("Não foi possível carregar os detalhes.");expect(texto(alerta!.props.children)).not.toContain("técnico");
  expect(elementos(t).some(n=>n.type===PainelSetor&&n.props.painel===null)).toBe(false);
  const retry=elementos(alerta!.props.children as ReactNode).find(n=>texto(n.props.children)==="Tentar de novo")!;
  respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",oportunidade:null,pessoaId:null,podeEnviar:true}),{status:200});
  (retry.props.onClick as (e:unknown)=>void)({currentTarget:{closest:()=>null}});tela();await esvaziar();
  const pronto=tela();expect(elementos(pronto).some(n=>n.props.role==="alert")).toBe(false);expect(elementos(pronto).some(n=>n.type===AbaDetalhes&&n.props.dados!==null)).toBe(true);expect(chamadasPainel).toHaveLength(2);
 });
 it("resposta antiga de outro atendimento não substitui o painel selecionado",async()=>{
  let resolver!:(r:Response)=>void;respostaPainel=()=>new Promise<Response>(r=>{resolver=r;});tela();
  respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",oportunidade:null,pessoaId:null,podeEnviar:false}),{status:200});
  lista(tela()).aoSelecionar("a2");tela();await esvaziar();resolver(new Response(JSON.stringify({podeEnviar:true}),{status:200}));await esvaziar();
  expect(conversa(tela()).podeEnviar).toBe(false);
 });
});

it("319:retry do painel entrega foco antes de remover gatilho e não rouba foco tardio",async()=>{
 const {texto}=await import("@/test/tela-sem-dom"),{criarDomMinimo}=await import("@/test/dom-minimo");const dom=criarDomMinimo();
 const painel=dom.documento.createElement("aside"),botao=dom.documento.createElement("button"),fora=dom.documento.createElement("button");painel.setAttribute("id","painel-contato");painel.setAttribute("tabindex","-1");painel.appendChild(botao);dom.documento.body.appendChild(painel);dom.documento.body.appendChild(fora);
 respostaPainel=()=>new Response("",{status:500});tela();await esvaziar();const alerta=elementos(tela()).find(n=>n.props.role==="alert")!;
 const retry=elementos(alerta.props.children as ReactNode).find(n=>typeof n.props.onClick==="function"&&texto(n.props.children)==="Tentar de novo")!;
 let resolver!:(r:Response)=>void;respostaPainel=()=>new Promise<Response>(r=>{resolver=r;});botao.focus();
 (retry.props.onClick as (e:unknown)=>void)({currentTarget:botao});expect(dom.documento.activeElement===painel).toBe(true);tela();
 painel.removeChild(botao);fora.focus();resolver(new Response(JSON.stringify({podeEnviar:true}),{status:200}));await esvaziar();tela();expect(dom.documento.activeElement===fora).toBe(true);
});

it("composição324: slots recebem somente pessoa/capacidades autorizadas e CAS bruto do contato atual", async () => {
  const tags = [{ id: "t324", rotulo: "Noite", ia: true }];
  respostaPainel = () => new Response(JSON.stringify({ setor: "COMERCIAL", tags, podeEnviar: false,
    cabecalho: { pessoaId: "p324", tagsDisponiveis: [{ id: "t325", nome: "Nova" }], semNome: true, capacidades: { editarTags: false, criarTag: false } },
    acoes: { nomeSalvo: "  ", podeEditarNome: true } }));
  tela(); await esvaziar(); const t = tela(), painel = elementos(t).find(n => n.type === PainelContato)!;
  const tag = painel.props.slotTags as ReactElement, aviso = elementos(painel.props.slotAviso as ReactNode).find(n => n.type === ContatoSemNome)!;
  expect(tag.type).toBe(TagsContato); expect(tag.props).toMatchObject({ atendimentoId: "a1", tags, podeEditar: false, podeCriar: false });
  expect(aviso.type).toBe(ContatoSemNome); expect(aviso.props).toMatchObject({ atendimentoId: "a1", nomeAnterior: "  ", podeEditar: true });
  lista(t).aoSelecionar("a2"); const novo = elementos(tela()).find(n => n.type === PainelContato)!;
  expect(novo.props.slotTags).toBeUndefined(); expect(novo.props.slotAviso).toBeUndefined();
});
it("composição324: sem pessoa não monta editor de tags e sem capacidade não permite preencher nome", async () => {
  respostaPainel = () => new Response(JSON.stringify({ setor: "COMERCIAL", tags: [], cabecalho: { pessoaId: null, tagsDisponiveis: [], semNome: true, capacidades: { editarTags: true, criarTag: true } }, acoes: null }));
  tela(); await esvaziar(); const painel = elementos(tela()).find(n => n.type === PainelContato)!;
  expect(painel.props.slotTags).toBeUndefined(); expect(elementos(painel.props.slotAviso as ReactNode).find(n => n.type === ContatoSemNome)!.props).toMatchObject({ podeEditar: false, nomeAnterior: null });
});

it("composição324: 404 preserva leitura do snapshot no mesmoID e retira escrita das tags", async () => {
  const tags = [{ id: "historica324", rotulo: "Histórico recebido", ia: true }];
  respostaPainel = () => new Response(JSON.stringify({ setor: "COMERCIAL", tags, podeEnviar: true, acoes: { podeEditarNome: true },
    cabecalho: { pessoaId: "p324", tagsDisponiveis: [{ id: "opcao324", nome: "Nova" }], semNome: false, capacidades: { editarTags: true, criarTag: true } } }));
  tela(); await esvaziar(); const antes = elementos(tela()).find(n => n.type === PainelContato)!;
  expect((antes.props.slotTags as ReactElement).props).toMatchObject({ podeEditar: true, podeCriar: true });
  respostaPainel = () => new Response("", { status: 404 });
  m.aoAviso!({ tipo: "atendimento.atualizado", atendimentoId: "a1", conversaId: "cv1", mensagemId: null }); tela(); await esvaziar();
  const depois = elementos(tela()).find(n => n.type === PainelContato)!;
  expect(conversa(tela()).podeEnviar).toBe(false);
  expect(depois.props.contato).toMatchObject({ tags });
  expect((depois.props.slotTags as ReactElement).props).toMatchObject({ tags, podeEditar: false, podeCriar: false });
});

const cabecalho326 = (extra: object = {}) => ({ pessoaId: "p326", tagsDisponiveis: [], semNome: false, capacidades: { editarContato: true, editarTags: false, criarTag: false, verContato: true }, ...extra });
const editor326 = (t: ReactNode) => elementos(t).find(n => n.type === GavetaContato);
const painel326 = (t: ReactNode) => elementos(t).find(n => n.type === PainelContato)!.props as { aoEditar?: () => void };
it("326: lápis autorizado ativa uma aquisição de Detalhes, fecha na troca e não reabre ao voltar", async()=>{
 respostaPainel=()=>new Response(JSON.stringify({podeEnviar:true,acoes:{},cabecalho:cabecalho326()}),{status:200});tela();await esvaziar();expect(editor326(tela())).toBeUndefined();expect(painel326(tela()).aoEditar).toEqual(expect.any(Function));
 painel326(tela()).aoEditar!();tela();await esvaziar();expect(editor326(tela())?.props.atendimentoId).toBe("a1");const gets=vi.mocked(fetch).mock.calls.filter(c=>String(c[0]).endsWith("/painel/detalhes"));expect(gets).toHaveLength(1);
 lista(tela()).aoSelecionar("a2");tela();await esvaziar();expect(editor326(tela())).toBeUndefined();lista(tela()).aoSelecionar("a1");tela();await esvaziar();expect(editor326(tela())).toBeUndefined();
});
it.each(["sem pessoa","sem capacidade","sem ações"])("326: contexto %s não oferece nem mantém editor",async caso=>{
 const cabecalho=cabecalho326(caso==="sem pessoa"?{pessoaId:null}:caso==="sem capacidade"?{capacidades:{editarContato:false}}:{});respostaPainel=()=>new Response(JSON.stringify({podeEnviar:false,acoes:caso==="sem ações"?null:{},cabecalho}),{status:200});tela();await esvaziar();expect(painel326(tela()).aoEditar).toBeUndefined();expect(editor326(tela())).toBeUndefined();
});
it("326: revogação404 conserva snapshot de leitura e retira o editor novo",async()=>{
 respostaPainel=()=>new Response(JSON.stringify({podeEnviar:true,acoes:{},cabecalho:cabecalho326()}),{status:200});tela();await esvaziar();painel326(tela()).aoEditar!();tela();await esvaziar();expect(editor326(tela())).toBeDefined();
 respostaPainel=()=>new Response(null,{status:404});m.aoAviso!({tipo:"atendimento.atualizado",atendimentoId:"a1",conversaId:"cv1",mensagemId:null});tela();await esvaziar();const t=tela();expect(painel326(t).aoEditar).toBeUndefined();expect(editor326(t)).toBeUndefined();expect(conversa(t).podeEnviar).toBe(false);
});

it("326: gaveta mantém posse modal ao redimensionar vista móvel para sobreposição e devolve ao painel ao fechar", async () => {
  const p = { ...props, abrirPainelPadrao: true }; m.modo = "uma"; vi.stubGlobal("window", { innerWidth: 390 });
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true, acoes: {}, cabecalho: cabecalho326() }));
  tela(p); await esvaziar();
  (elementos(tela(p)).find(n => n.type === ConversaAberta)!.props.aoAlternarPainel as () => void)(); tela(p);
  painel326(tela(p)).aoEditar!(); tela(p); await esvaziar();
  const gaveta = editor326(tela(p))!;
  m.modo = "duas"; tela(p); const redimensionada = tela(p);
  expect(editor326(redimensionada)).toBeDefined();
  const painel = elementos(redimensionada).find(n => n.type === PainelContato)!;
  expect(painel.props.visivel).toBe(true); expect(painel.props.sobreposto).toBe(false);
  (gaveta.props.aoFechar as () => void)();
  const fechada = tela(p), painelFechado = elementos(fechada).find(n => n.type === PainelContato)!;
  expect({ visivel: painelFechado.props.visivel, sobreposto: painelFechado.props.sobreposto, editor: !!editor326(fechada), modo: m.modo }).toEqual({ visivel: true, sobreposto: true, editor: false, modo: "duas" });
});

it("326: componentes reais mantêm um único modal, foco e editor fora de inert no resize", async () => {
  const p = { ...props, abrirPainelPadrao: true }; m.modo = "uma"; vi.stubGlobal("window", { innerWidth: 390 });
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true, acoes: {}, cabecalho: cabecalho326() }));
  tela(p); await esvaziar();
  (elementos(tela(p)).find(n => n.type === ConversaAberta)!.props.aoAlternarPainel as () => void)(); tela(p);
  painel326(tela(p)).aoEditar!(); tela(p); await esvaziar();
  const antes = tela(p); m.modo = "duas"; tela(p); const depois = tela(p);
  const g = m.g; m.g = null; vi.useRealTimers();
  const { criarDomMinimo, desligarObservadores } = await import("@/test/dom-minimo");
  const dom = criarDomMinimo(), doc = dom.documento;
  const criar = doc.createElement.bind(doc);
  doc.createElement = tag => { const el = criar(tag); if (tag === "select") Object.defineProperty(el, "options", { get: () => el.querySelectorAll("option") }); return el; };
  const ouvintes: { alvo: object; tipo: string; f: (e: Event) => void }[] = [];
  for (const alvo of [doc, dom.janela]) Object.assign(alvo, {
    addEventListener: (tipo: string, f: (e: Event) => void) => ouvintes.push({ alvo, tipo, f }),
    removeEventListener: (tipo: string, f: (e: Event) => void) => { const i = ouvintes.findIndex(o => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); },
  });
  Object.assign(doc, { createElementNS: (_ns: string, tag: string) => doc.createElement(tag) });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = doc.createElement("div"); doc.body.appendChild(host);
  const { act, createElement, cloneElement } = await import("react"), { createRoot } = await import("react-dom/client");
  const root = createRoot(host as unknown as HTMLElement);
  function filhos(t: ReactNode) {
    const painel = elementos(t).find(n => n.type === PainelContato)! as unknown as ReactElement<Record<string, unknown>>;
    const gaveta = editor326(t)! as unknown as ReactElement<Record<string, unknown>>;
    return createElement("div", null, cloneElement(painel, { slotTags: undefined, slotAviso: undefined, children: null }), cloneElement(gaveta, { dados: { pessoa: { id: "p326", nome: "Pessoa fictícia", email: null, cidade: null, cargo: null, linkedin: null, origemCanal: null, telefone: null, empresa: null }, campos: [], b2b: null, oportunidade: null } }));
  }
  try {
    await act(async () => root.render(filhos(antes)));
    expect(host.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    const nome = host.querySelector('[name="nome"]')!; nome.focus();
    await act(async () => root.render(filhos(depois)));
    expect(host.querySelector('[name="nome"]') === nome).toBe(true);
    expect(nome.closest("[inert]") === null).toBe(true); expect(doc.activeElement === nome).toBe(true);
  } finally {
    await act(async () => root.unmount()); desligarObservadores(); m.g = g;
  }
});

async function abrirAba328(p:PropsInboxNovo){
  respostaPainel=()=>new Response(JSON.stringify({setor:'COMERCIAL',podeEnviar:false,cabecalho:{pessoaId:null,tagsDisponiveis:[],semNome:false,subtitulo:'Pessoa física',quadrado:false,capacidades:{veLead:true,verContato:false,editarContato:false,editarTags:false,criarTag:false,moverEtapa:false,tarefas:false,tarefasEquipe:false,desfazerAria:false,verEmpresa:false}},acoes:{},aria:{}}));
  const anterior=fetch;vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/painel/oportunidades')?new Response(JSON.stringify({atual:{id:'op328',titulo:'Curso328',produto:null,valor:null,moeda:null,etapa:'QUALIFICADO',temperatura:'MORNO',responsavel:null,dataExperimental:null,experimentalConfirmada:false,professorExperimental:null,motivoPerda:null},outras:[],pessoaId:null})):anterior(url)));
  tela(p);await esvaziar();const painel=elementos(tela(p)).find(n=>n.type===PainelContato)!;(painel.props.aoTrocarAba as (id:string)=>void)('oportunidades');tela(p);await esvaziar();return elementos(tela(p)).find(n=>n.type===AbaOportunidades)!;
}
it.each([
 ['VENDEDOR',null,false,null,'ABERTO_SEM_RESPONSAVEL',false,true],
 ['PROFESSOR',null,false,null,'ABERTO_SEM_RESPONSAVEL',false,false],
 ['GERENTE_COMERCIAL',null,true,'outro','ABERTO_SEM_RESPONSAVEL',false,true],
 ['VENDEDOR',null,true,'outro','ABERTO_SEM_RESPONSAVEL',false,false],
 ['VENDEDOR',null,true,'u1','ABERTO_SEM_RESPONSAVEL',false,true],
 ['VENDEDOR','outro',false,null,'EM_ATENDIMENTO',false,false],
 ['ADMINISTRADOR',null,false,null,'ABERTO_SEM_RESPONSAVEL',true,false],
 ['VENDEDOR',null,false,null,'ENCERRADO',false,false],
] as const)('328: assumir respeita contexto completo %s/%s/%s/%s/%s/grupo%s',async(papel,responsavelId,linhaComercial,numeroDonoId,status,grupo,esperado)=>{
 const p={...props,usuario:{id:'u1',papeis:[papel]},fuso:'Asia/Tokyo',fusoEscola:'America/Costa_Rica',inicial:{itens:[{...item('a1'),responsavelId,linhaComercial,numeroDonoId,status,grupo}],proximo:null}} as PropsInboxNovo;
 const aba=await abrirAba328(p);if(grupo){expect(aba).toBeUndefined();return;}expect(aba).toBeTruthy();expect(aba.props.podeAssumir).toBe(esperado);expect(aba.props.fusoEscola).toBe('America/Costa_Rica');expect(aba.props.capacidades).toMatchObject({moverEtapa:false});
});
it('328: callback de assumir captura somente ID do atendimento, sem oportunidade ou carteira',async()=>{assumir328Inbox.mockClear();const aba=await abrirAba328(props);expect(aba).toBeTruthy();lista(tela()).aoSelecionar('a2');tela();await esvaziar();await (aba.props.aoAssumir as ()=>Promise<unknown>)();expect(assumir328Inbox).toHaveBeenCalledOnce();expect(assumir328Inbox).toHaveBeenCalledWith('a1');});

it.each(['ausente', 'nulo', 'presente'] as const)('R1C3 oportunidades usa capacidades fechadas com cabecalho %s', async (caso) => {
 const capacidades = { veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: true, moverEtapa: true, tarefas: true, tarefasEquipe: true, desfazerAria: true, verEmpresa: true };
 const cabecalho = caso === 'ausente' ? undefined : caso === 'nulo' ? null : { pessoaId: 'p327', tagsDisponiveis: [], semNome: false, capacidades };
 vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/painel') ? { setor: 'COMERCIAL', podeEnviar: false, tags: [], acoes: null, cabecalho } : url.endsWith('/oportunidades') ? { atual: null, outras: [], pessoaId: null } : { pessoa: null, oportunidade: null, b2b: null, campos: [] }))));
 tela(); await esvaziar(); const painel = elementos(tela()).find(n => n.type === PainelContato)!; (painel.props.aoTrocarAba as (id: string) => void)('oportunidades'); tela(); await esvaziar();
 const aba = elementos(tela()).find(n => n.type === AbaOportunidades)!; expect(aba).toBeDefined(); expect(aba.props.capacidades).toEqual(caso === 'presente' ? capacidades : Object.fromEntries(Object.keys(capacidades).map(k => [k, false])));
});

async function abrirAba331(){
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:false,acoes:{},cabecalho:cabecalho326({capacidades:{tarefas:true,tarefasEquipe:false,editarContato:true,verContato:true}})}));
 const anterior=fetch;vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.startsWith("/api/inbox/atendimentos?")?new Response(JSON.stringify(props.inicial)):url.endsWith("/painel/oportunidades")?new Response(JSON.stringify({atual:null,outras:[],pessoaId:null,tarefas:[],fusoEscola:"America/Sao_Paulo"})):anterior(url)));
 tela();await esvaziar();const painel=elementos(tela()).find(n=>n.type===PainelContato)!;(painel.props.aoTrocarAba as (id:string)=>void)("oportunidades");tela();await esvaziar();return elementos(tela()).find(n=>n.type===AbaOportunidades)!;
}
it("331: callbacks reais abrem modal no atendimento e troca de seleção encerra sessão",async()=>{
 const aba=await abrirAba331();expect(aba.props.aoNovaTarefa).toEqual(expect.any(Function));(aba.props.aoNovaTarefa as ()=>void)();const aberta=elementos(tela()).find(n=>n.type===ModalTarefa)!;expect(aberta.props.atendimentoId).toBe("a1");expect(aberta.props.modo).toEqual({tipo:"nova"});const key=(aberta as unknown as ReactElement).key;expect((elementos(tela()).find(n=>n.type===ModalTarefa)! as unknown as ReactElement).key).toBe(key);
 lista(tela()).aoSelecionar("a2");tela();expect(elementos(tela()).some(n=>n.type===ModalTarefa)).toBe(false);
});
it("331: editar encaminha identidade/versão do alvo, e editor de contato fecha o modal",async()=>{
 const aba=await abrirAba331();(aba.props.aoEditarTarefa as (t:{id:string;versao:number})=>void)({id:"t331",versao:4});const aberta=elementos(tela()).find(n=>n.type===ModalTarefa)!;expect(aberta.props.modo).toEqual({tipo:"editar",tarefa:{id:"t331",versao:4}});painel326(tela()).aoEditar!();expect(elementos(tela()).some(n=>n.type===ModalTarefa)).toBe(false);
});

// #350: uma fonte de painel, sem prop antiga enquanto a seleção nova carrega.
it("sugestões da thread pertencem só ao painel atual, inclusive podeDecidir=false",async()=>{
 const a={podeDecidir:false,cartoes:[{id:"cartao-a"}]};respostaPainel=()=>new Response(JSON.stringify({podeEnviar:false,aria:a}));
 tela();await esvaziar();expect(cabecalho(tela()).aria).toEqual(a);
 let resolver!:(r:Response)=>void;respostaPainel=()=>new Promise(r=>{resolver=r;});
 lista(tela()).aoSelecionar("a2");expect(cabecalho(tela()).aria).toBeUndefined();
 resolver(new Response(JSON.stringify({podeEnviar:false,aria:{podeDecidir:true,cartoes:[{id:"cartao-b"}]}})));await esvaziar();
 expect(cabecalho(tela()).aria?.cartoes.map(s=>s.id)).toEqual(["cartao-b"]);
});

describe("346: resumo e snapshot pessoal",()=>{
 const resumo:NonNullable<PropsInboxNovo["resumo"]>={contagens:{todas:90,ia:3,aprovacao:2,handoff:1,humano:4,semResposta:2,naoAtribuidas:9},aria:{estado:"ATIVA",pausada:false,podeGerenciar:false}};
 const render=(p:PropsInboxNovo)=>{m.posEfeito=0;return m.g!.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,p);};
 const response=(ia:number)=>new Response(JSON.stringify({itens:props.inicial.itens,proximo:null,resumo:{...resumo,contagens:{...resumo.contagens,ia}}}));
 it.each([true,false])("não aplica resumo enquanto leitura está pendente e aceita o fresco após resultado %s",async ok=>{
  let ler!:(r:{ok:boolean})=>void;marcar.mockImplementation(()=>new Promise(r=>{ler=r;}));
  const resolvers:((r:Response)=>void)[]=[];respostaLista=()=>new Promise(r=>resolvers.push(r));
  const p={...props,resumo};render(p);m.aoAviso!({tipo:"resync",atendimentoId:null,mensagemId:null,conversaId:""});await esvaziar();
  resolvers[0](response(999));await esvaziar();expect(coluna313(render(p)).resumo).toEqual(resumo);
  ler({ok});await esvaziar();expect(resolvers).toHaveLength(2);resolvers[1](response(ok?0:8));await esvaziar();expect(coluna313(render(p)).resumo?.contagens.ia).toBe(ok?0:8);
 });
 it("paginação cursor não pede nem substitui resumo, mesmo com campo extra inesperado no retorno",async()=>{
  const p={...props,selecionado:null,resumo,inicial:{...props.inicial,proximo:"cursor-fixture"}};
  respostaLista=async()=>response(999);const coluna=coluna313(render(p));await coluna.aoCarregarMais();await esvaziar();expect(coluna313(render(p)).resumo).toEqual(resumo);
  const url=String(vi.mocked(fetch).mock.calls.find(([url])=>String(url).includes("cursor="))?.[0]);expect(url).toContain("cursor=cursor-fixture");expect(url).not.toContain("contagens=1");
 });
});
it("353 Detalhes não contém mais bloco Aria, mantendo a aquisição e refresh da conversa",async()=>{
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:true,aria:{pausada:true,motivo:"CELULAR",podeDevolver:true,podeDecidir:false,cartoes:[],handoff:null},acoes:{}}));
 tela();await esvaziar();const t=tela();expect(elementos(t).filter(n=>typeof n.type==="function"&&n.type.name==="PainelAria")).toHaveLength(0);
 const antes=chamadasPainel.length;const listasAntes=vi.mocked(fetch).mock.calls.filter(([u])=>String(u).startsWith("/api/inbox/atendimentos?")).length;const c=elementos(t).find(n=>n.type===ConversaAberta)!.props as {aoMudar():void};c.aoMudar();tela();await esvaziar();expect(chamadasPainel.length).toBe(antes+1);expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).startsWith("/api/inbox/atendimentos?")).length).toBe(listasAntes+1);
});
it("434 retry inicial depois404 mantém bloqueio em503; só200 fresco limpa",async()=>{
 respostaPainel=()=>new Response("",{status:404});tela();await esvaziar();const estado=()=>elementos(tela()).find(n=>n.type===ConversaAberta)!.props as {bloquearDecisoesAria?:boolean;falhaPermissao?():void};
 expect(estado().bloquearDecisoesAria).toBe(true);respostaPainel=()=>new Response("",{status:503});estado().falhaPermissao!();tela();await esvaziar();expect(estado().bloquearDecisoesAria).toBe(true);
 respostaPainel=()=>new Response(JSON.stringify({podeEnviar:false,aria:{pausada:false,motivo:null,podeDevolver:false,podeDecidir:false,cartoes:[],handoff:null}}));estado().falhaPermissao!();tela();await esvaziar();expect(estado().bloquearDecisoesAria).toBe(false);
});
it("332: fio oferece modal fora CRM sem permissão de envio e usa o alvo direto",async()=>{
 respostaPainel=()=>new Response(JSON.stringify({setor:"SECRETARIA",podeEnviar:false,acoes:{},tarefasNoFio:[{id:"direta332",versao:7,podeAgir:true}],cabecalho:cabecalho326({capacidades:{tarefas:true}})}));
 tela();await esvaziar();const fio=cabecalho(tela());expect(fio.aoCriarTarefa).toEqual(expect.any(Function));expect(fio.tarefasNoFio).toEqual([{id:"direta332",versao:7,podeAgir:true}]);
 (fio.aoEditarTarefa as (t:{id:string;versao:number})=>void)({id:"direta332",versao:7});const modal=elementos(tela()).find(n=>n.type===ModalTarefa)!;expect(modal.props.alvoDisponivel).toBe(true);expect(modal.props.modo).toEqual({tipo:"editar",tarefa:{id:"direta332",versao:7}});
});
it("332: nova leitura sem capacidade retira entrada e encerra modal do fio",async()=>{
 await abrirAba331();(cabecalho(tela()).aoCriarTarefa as ()=>void)();expect(elementos(tela()).some(n=>n.type===ModalTarefa)).toBe(true);
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:false,acoes:{},cabecalho:cabecalho326({capacidades:{tarefas:false}})}));cabecalho(tela()).aoMudar();tela();await esvaziar();expect(cabecalho(tela()).aoCriarTarefa).toBeUndefined();expect(elementos(tela()).some(n=>n.type===ModalTarefa)).toBe(false);
});
it("332: nota no painel solicita foco apenas para a conversa selecionada",async()=>{
 const aba=await abrirAba331();expect(aba.props.aoAdicionarNota).toEqual(expect.any(Function));(aba.props.aoAdicionarNota as ()=>void)();expect(cabecalho(tela()).pedidoNota).toBeGreaterThan(0);lista(tela()).aoSelecionar("a2");expect(cabecalho(tela()).pedidoNota).toBeUndefined();
});
it("332 pedido de nota consumido não ressuscita em A→B→A; próxima abertura tem token novo",async()=>{
 const aba=await abrirAba331();(aba.props.aoAdicionarNota as ()=>void)();const antigo=cabecalho(tela()).pedidoNota as number;lista(tela()).aoSelecionar("a2");tela();lista(tela()).aoSelecionar("a1");expect(cabecalho(tela()).pedidoNota).toBeUndefined();const nova=await abrirAba331();(nova.props.aoAdicionarNota as ()=>void)();expect(cabecalho(tela()).pedidoNota).toBeGreaterThan(antigo);
});
it.each(["COMERCIAL","SECRETARIA"])("333 Atividade usa produtor da aba %s sem restringir a CRM/envio",async setor=>{
 respostaPainel=()=>new Response(JSON.stringify({setor,podeEnviar:false,acoes:{},cabecalho:cabecalho326({capacidades:{tarefas:false}})}));const d={agendadas:[],recente:{ultimaInteracaoEm:null,conversas:2,tarefasAbertas:0,notas:[]}},anterior=fetch;vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith("/painel/atividade")?new Response(JSON.stringify(d)):anterior(url)));
 tela();await esvaziar();const p=elementos(tela()).find(n=>n.type===PainelContato)!;(p.props.aoTrocarAba as (id:string)=>void)("atividade");tela();await esvaziar();const aba=elementos(tela()).find(n=>n.type===AbaAtividade)!;expect(aba).toBeDefined();expect(aba.props.dados).toEqual(d);expect(aba.props.atendimentoId).toBe("a1");expect(aba.props.aoMudar).toEqual(expect.any(Function));lista(tela()).aoSelecionar("a2");expect(elementos(tela()).some(n=>n.type===AbaAtividade)).toBe(false);
});


async function abrirAba357(p:PropsInboxNovo,capacidade:boolean){
 assumir328Inbox.mockClear();assumir357Inbox.mockClear();
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:true,cabecalho:{pessoaId:null,tagsDisponiveis:[],semNome:false,subtitulo:"Fixture357",quadrado:false,capacidades:{veLead:true,verContato:false,editarContato:false,editarTags:false,criarTag:false,moverEtapa:false,tarefas:false,tarefasEquipe:false,desfazerAria:false,verEmpresa:false}},acoes:{},aria:{pausada:false,motivo:null,podeDecidir:false,podeDevolver:false,podeAssumirAria:capacidade,cartoes:[],handoff:null}}));
 const anterior=fetch;vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.startsWith("/api/inbox/atendimentos?")?new Response(JSON.stringify(p.inicial)):url.endsWith("/painel/oportunidades")?new Response(JSON.stringify({atual:{id:"op357",titulo:"Fixture357",produto:null,valor:null,moeda:null,etapa:"QUALIFICADO",temperatura:"MORNO",responsavel:null,dataExperimental:null,experimentalConfirmada:false,professorExperimental:null,motivoPerda:null},outras:[],pessoaId:null,tarefas:[],fusoEscola:"UTC"})):anterior(url)));
 tela(p);await esvaziar();const painel=elementos(tela(p)).find(n=>n.type===PainelContato)!;(painel.props.aoTrocarAba as(id:string)=>void)("oportunidades");tela(p);await esvaziar();return elementos(tela(p)).find(n=>n.type===AbaOportunidades)!;
}
const props357=()=>({...props,inicial:{itens:[{...item("a1"),estadoAria:"ia"},{...item("a2"),estadoAria:"ia"}],proximo:null}} as PropsInboxNovo);
it.each([true,false])("357 consumidor da Aba escolhe action nova só com capacidade fresca %s",async capacidade=>{
 assumir328Inbox.mockClear();assumir357Inbox.mockClear();const aba=await abrirAba357(props357(),capacidade);expect(aba.props.podeAssumir).toBe(capacidade);const r=await(aba.props.aoAssumir as()=>Promise<{ok:boolean}>)();
 if(capacidade){expect(r.ok).toBe(true);expect(assumir357Inbox).toHaveBeenCalledExactlyOnceWith("a1");}else{expect(r.ok).toBe(false);expect(assumir357Inbox).not.toHaveBeenCalled();}expect(assumir328Inbox).not.toHaveBeenCalled();
});
it("357 capacidade de assumir da Aba independe de decidir cartões e admite o responsável atual",async()=>{
 const p=props357();p.inicial.itens[0]={...p.inicial.itens[0],responsavelId:"u1",estadoAria:"aprovacao"};const aba=await abrirAba357(p,true);expect(aba.props.podeAssumir).toBe(true);await(aba.props.aoAssumir as()=>Promise<unknown>)();expect(assumir357Inbox).toHaveBeenCalledWith("a1");expect(assumir328Inbox).not.toHaveBeenCalled();
});
it("357 callback Aria retido não atravessa A-B-A",async()=>{
 const p=props357(),aba=await abrirAba357(p,true);lista(tela(p)).aoSelecionar("a2");tela(p);await esvaziar();lista(tela(p)).aoSelecionar("a1");tela(p);await esvaziar();await(aba.props.aoAssumir as()=>Promise<unknown>)();expect(assumir357Inbox).not.toHaveBeenCalled();expect(assumir328Inbox).not.toHaveBeenCalled();
});
it("357 404 limpa capacidade copiada e bloqueia callback antigo sem cair no legado",async()=>{
 const p=props357(),aba=await abrirAba357(p,true);respostaPainel=()=>new Response("",{status:404});(elementos(tela(p)).find(n=>n.type===ConversaAberta)!.props.aoMudar as()=>void)();tela(p);await esvaziar();const conversa=elementos(tela(p)).find(n=>n.type===ConversaAberta)!;expect((conversa.props.aria as{podeAssumirAria:boolean}).podeAssumirAria).toBe(false);await(aba.props.aoAssumir as()=>Promise<unknown>)();expect(assumir357Inbox).not.toHaveBeenCalled();expect(assumir328Inbox).not.toHaveBeenCalled();
});

it("377 abaInsights exigeveLead e recebe porta física somente da seleção atual",async()=>{
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:true,acoes:{},cabecalho:cabecalho326({capacidades:{veLead:true}})}));tela();await esvaziar();
 const painel=elementos(tela()).find(n=>n.type===PainelContato)!;expect((painel.props.abas as {id:string}[]).some(a=>a.id==="insights")).toBe(true);
 (painel.props.aoTrocarAba as(id:string)=>void)("insights");let t=tela();expect(elementos(t).some(n=>n.type===AbaInsights)).toBe(true);
 const porta={atendimentoId:"a1",textoAtual:"Rascunho377",revisao:"r377",podeUsar:true,usar:async()=>({ok:true as const})};
 (cabecalho(t).aoPortaRascunhoInsight as(p:unknown)=>void)(porta);t=tela();expect(elementos(t).find(n=>n.type===AbaInsights)!.props.rascunhoPorta).toBe(porta);
 lista(t).aoSelecionar("a2");t=tela();expect(elementos(t).some(n=>n.type===AbaInsights)).toBe(false);
});
it("377 semveLead nãoofereceabaInsights mesmoCOMERCIAL",async()=>{
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:false,acoes:{},cabecalho:cabecalho326({capacidades:{veLead:false}})}));tela();await esvaziar();const painel=elementos(tela()).find(n=>n.type===PainelContato)!;expect((painel.props.abas as {id:string}[]).some(a=>a.id==="insights")).toBe(false);
});

it("449 C1 agendamento recebe aplicabilidade do painel atual e revogação não conserva capacidade antiga",async()=>{
 expect(conversa(tela()).podeUsarInsights).toBe(false);
 respostaPainel=()=>new Response(JSON.stringify({setor:"COMERCIAL",podeEnviar:true,acoes:{},cabecalho:cabecalho326({capacidades:{veLead:true}})}));
 (conversa(tela()).aoMudar as()=>void)();tela();await esvaziar();expect(conversa(tela()).podeUsarInsights).toBe(true);
 respostaPainel=()=>new Response("",{status:404});(conversa(tela()).aoMudar as()=>void)();tela();await esvaziar();expect(conversa(tela()).podeUsarInsights).toBe(false);
 const painel=elementos(tela()).find(n=>n.type===PainelContato)!;expect((painel.props.abas as{id:string}[]).some(a=>a.id==="insights")).toBe(false);
});

it.each(["Atendimento transferido para Secretaria.", "Falha externa não deve virar aviso de sucesso"])("447 C1 confirmação local persiste após remover conversa e ignora texto externo: %s",async(texto)=>{
 tela();await esvaziar();const c=conversa(tela()) as {aoTransferirConcluido?:(texto:string)=>void};
 expect(c.aoTransferirConcluido).toBeTypeOf("function");c.aoTransferirConcluido!(texto);
 respostaLista=async()=>pagina([]);m.aoAviso!({tipo:"atendimento.atualizado",atendimentoId:"a1",conversaId:"cv1",mensagemId:null});await esvaziar();tela();
 const semSelecao={...props,selecionado:null};tela(semSelecao);await esvaziar();const final=tela(semSelecao);
 expect(elementos(final).some(n=>n.type===ConversaAberta)).toBe(false);
 const status=elementos(final).find(n=>typeof n.type==="function"&&n.type.name==="MensagemStatus");expect(status?.props.texto).toBe("Transferência concluída.");

});
