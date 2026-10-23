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
    useCallback: ((f: unknown, d: unknown[]) => (m.g ? f : real.useCallback(f as never, d))) as unknown as typeof real.useCallback,
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
vi.mock("@/components/conversa/useConversa", () => ({ useConversa: () => ({ mensagens: [] }) }));
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
let regiaoConversaVisivel: boolean;
const chamadasPainel: string[] = [];
beforeEach(() => {
  regiaoConversaVisivel = true;
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
afterEach(() => { m.g = null; vi.unstubAllGlobals(); });

const esvaziar = () => new Promise((r) => setTimeout(r, 0));
function tela(): ReactNode {
  m.posEfeito = 0;
  const t = m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode, props);
  const secao = elementos(t).find((n) => n.type === "section" && n.props["aria-label"] === "Conversa");
  const ref = (secao as { ref?: { current: unknown } } | undefined)?.ref;
  if (ref) ref.current = { getClientRects: () => regiaoConversaVisivel ? [{}] : [] };
  return t;
}
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
    const t = tela(); await esvaziar(); marcar.mockClear();
    (conversa(t) as unknown as { aoAbrirPainel(): void }).aoAbrirPainel();
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
    vi.stubGlobal("document", { visibilityState: "hidden" }); concluir(); await esvaziar();
    expect(marcar).toHaveBeenCalledTimes(1);
  });
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
    marcar.mockResolvedValue({ ok: false });
    m.aoAviso!({ tipo: "mensagem.nova", atendimentoId: "a1", mensagemId: "m1", conversaId: "cv1" });
    await esvaziar(); // a leitura v2 falha; a consulta de reconciliação também falha
    expect(consultas).toBe(3);
    expect(lista(tela()).itens.find((i) => i.id === "a1")?.naoLidas).toBe(1);
    concluirAntigo(pagina([item("a1"), item("a2")]));
    await esvaziar();
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
  it("inicializa do servidor e aceita só a resposta mais recente de SSE; não calcula pelo tamanho da página", async () => {
    const resolver: ((r: Response) => void)[] = [];
    respostaLista = () => new Promise((ok) => resolver.push(ok));
    render(); expect(m.contagens).toEqual(inicial);
    const aviso = { tipo: "resync" as const, atendimentoId: null, mensagemId: null, conversaId: "" };
    m.aoAviso!(aviso); m.aoAviso!(aviso);
    resolver[1](resposta(3)); await esvaziar(); render(); expect(m.contagens).toEqual({ ...inicial, naoLidas: 3 });
    resolver[0](resposta(20)); await esvaziar(); render(); expect(m.contagens).toEqual({ ...inicial, naoLidas: 3 });
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).includes("contagens=1"))).toBe(true);
  });
  it("troca de filtros preserva os agregados novos mesmo se o GET antigo terminar depois", async () => {
    let concluir!: (r: Response) => void; respostaLista = () => new Promise((ok) => { concluir = ok; });
    render(); m.aoAviso!({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    const p = { ...props, selecionado: null, filtros: { busca: "novo" }, contagens: { ...inicial, todas: 2 } };
    render(p); render(p); concluir(resposta(30)); await esvaziar(); render(p);
    expect(m.contagens).toEqual(p.contagens);
  });
  it.each([true, false])("leitura em voo não aceita agregado antigo e reconcilia após resultado %s", async (ok) => {
    let ler!: (r: { ok: boolean }) => void; marcar.mockImplementation(() => new Promise((resolve) => { ler = resolve; }));
    const resolver: ((r: Response) => void)[] = []; respostaLista = () => new Promise((resolve) => resolver.push(resolve));
    const p = { ...props, contagens: inicial };
    render(p); m.aoAviso!({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
    resolver[0](resposta(60)); await esvaziar(); render(p); expect(m.contagens).toEqual(inicial);
    ler({ ok }); await esvaziar(); expect(resolver).toHaveLength(2);
    resolver[1](resposta(ok ? 0 : 8)); await esvaziar(); render(p);
    expect(m.contagens).toEqual({ ...inicial, naoLidas: ok ? 0 : 8 });
  });
});