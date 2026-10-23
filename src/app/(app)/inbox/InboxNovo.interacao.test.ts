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
  contagens: undefined as unknown,
  avisoThread: null as unknown,
  aoAviso: null as null | ((a: import("@/server/inbox/barramento").AvisoInbox) => void),
}));
const marcar = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
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
vi.mock("@/server/whatsapp/preferencias", () => ({ marcarAtendimentoLido: marcar, alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/inbox" }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { criarGanchos, elementos } from "@/test/tela-sem-dom";
import { ConversaAberta } from "./ConversaAberta";
import { ListaAtendimentos } from "./ListaAtendimentos";
import { PainelAria } from "./PainelAria";
import { AcoesContato } from "./AcoesContato";
import { InboxNovo, type PropsInboxNovo } from "./InboxNovo";

const item = (id: string) => ({
  id, numeroId: "n1", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: DriverWhatsApp.META_CLOUD, contatoId: `c-${id}`, contatoNome: id,
  contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: id === "a2" ? 2 : 0, ultimaMensagemEm: "2026-10-01T02:30:00.000Z", preview: "Oi",
  linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
});
const props = {
  inicial: { itens: [item("a1"), item("a2")], proximo: null }, filtros: {}, selecionado: "a1",
  usuario: { id: "u1", papeis: ["VENDEDOR"] }, fuso: null,
} as unknown as PropsInboxNovo;

let respostaPainel: () => Response;
let respostaLista: () => Promise<Response>;
const chamadasPainel: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  marcar.mockReset(); marcar.mockResolvedValue({ ok: true });
  vi.stubGlobal("document", { visibilityState: "visible" });
  m.g = criarGanchos(); m.efeitos = []; m.aoAviso = null; chamadasPainel.length = 0;
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true }), { status: 200 });
  respostaLista = async () => new Response(JSON.stringify({ itens: props.inicial.itens, proximo: null }), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/painel")) { chamadasPainel.push(url); return respostaPainel(); }
    return respostaLista();
  }));
});
afterEach(() => { for (const e of m.efeitos) if (typeof e.limpar === "function") e.limpar(); m.g = null; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const esvaziar = () => vi.advanceTimersByTimeAsync(50);
function tela(): ReactNode { m.posEfeito = 0; return m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode, props); }
const conversa = (t: ReactNode) => elementos(t).find((n) => n.type === ConversaAberta)!.props as { podeEnviar: boolean | null; falhaPermissao?: () => void };
const lista = (t: ReactNode) => elementos(t).find((n) => n.type === ListaAtendimentos)!.props as { itens: { id: string; naoLidas: number }[]; aoSelecionar(id: string): void };

it("painéis simultâneos do atendimento têm identidades React distintas", async () => {
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true, aria: {}, acoes: {} }), { status: 200 });
  tela(); await esvaziar();
  const paineis = elementos(tela()).filter((n) => n.type === PainelAria || n.type === AcoesContato) as ReactElement[];
  expect(paineis).toHaveLength(4); // painel desktop e Drawer
  for (let i = 0; i < paineis.length; i += 2) {
    expect(paineis[i].key).not.toBeNull();
    expect(paineis[i + 1].key).not.toBe(paineis[i].key);
  }
});
const pagina = (itens: ReturnType<typeof item>[]) => new Response(JSON.stringify({ itens, proximo: null }), { status: 200 });

describe("InboxNovo: leitura ao abrir", () => {
  it("marca o atendimento selecionado pelo deep link inicial", () => {
    tela();
    expect(marcar).toHaveBeenCalledExactlyOnceWith("a1");
  });
  it("ao abrir outra conversa, zera imediatamente o contador da lista", () => {
    const lista = (t: ReactNode) => elementos(t).find((n) => n.type === ListaAtendimentos)!.props as { itens: { id: string; naoLidas: number }[]; aoSelecionar(id: string): void };
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
    vi.stubGlobal("document", { visibilityState: "hidden" });
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
