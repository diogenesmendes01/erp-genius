import { DriverWhatsApp } from "@prisma/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Interação do InboxNovo sem DOM (src/test/tela-sem-dom.ts): o componente é chamado como função, com useState/useRef/
// useCallback dos ganchos de teste e um useEffect mínimo que roda o efeito quando as dependências mudam (o painel
// do atendimento é buscado num efeito). O aviso do SSE é capturado do useEventosInbox simulado.
const m = vi.hoisted(() => ({
  g: null as null | import("@/test/tela-sem-dom").Ganchos,
  efeitos: [] as { deps?: unknown[]; limpar?: void | (() => void) }[],
  posEfeito: 0,
  aoAviso: null as null | ((a: import("@/server/inbox/barramento").AvisoInbox) => void),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/inbox" }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));

import { criarGanchos, elementos } from "@/test/tela-sem-dom";
import { ConversaAberta } from "./ConversaAberta";
import { InboxNovo, type PropsInboxNovo } from "./InboxNovo";

const item = (id: string) => ({
  id, numeroId: "n1", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: DriverWhatsApp.META_CLOUD, contatoId: `c-${id}`, contatoNome: id,
  contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: "2026-10-01T02:30:00.000Z", preview: "Oi",
  linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
});
const props = {
  inicial: { itens: [item("a1"), item("a2")], proximo: null }, filtros: {}, selecionado: "a1",
  usuario: { id: "u1", papeis: ["VENDEDOR"] }, fuso: null,
} as unknown as PropsInboxNovo;

let respostaPainel: () => Response;
const chamadasPainel: string[] = [];
beforeEach(() => {
  m.g = criarGanchos(); m.efeitos = []; m.aoAviso = null; chamadasPainel.length = 0;
  respostaPainel = () => new Response(JSON.stringify({ podeEnviar: true }), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/painel")) { chamadasPainel.push(url); return respostaPainel(); }
    return new Response(JSON.stringify({ itens: props.inicial.itens, proximo: null }), { status: 200 });
  }));
});
afterEach(() => { m.g = null; vi.unstubAllGlobals(); });

const esvaziar = () => new Promise((r) => setTimeout(r, 0));
function tela(): ReactNode { m.posEfeito = 0; return m.g!.renderizar(InboxNovo as (p: PropsInboxNovo) => ReactNode, props); }
const conversa = (t: ReactNode) => elementos(t).find((n) => n.type === ConversaAberta)!.props as { podeEnviar: boolean | null; falhaPermissao?: () => void };

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
