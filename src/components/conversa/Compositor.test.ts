import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Duas formas de teste no mesmo arquivo, sem DOM: marcação (renderToStaticMarkup, React real) e interação
// (o componente chamado como função, com os ganchos de src/test/tela-sem-dom.ts; efeitos não rodam).
const m = vi.hoisted(() => ({ g: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
    useEffect: ((f: () => void, d?: unknown[]) => (m.g ? undefined : real.useEffect(f, d))) as unknown as typeof real.useEffect,
  };
});

import { Compositor, MOTIVO_SEM_ENVIO, AVISO_NOTA, type PropsCompositor } from "./Compositor";
import { SeletorEmoji, buscarEmoji, type EntradaEmoji } from "./SeletorEmoji";
import { AVISO_RECURSO_MOTOR } from "./recursos-canal";
import { criarGanchos, clicar, elementos } from "@/test/tela-sem-dom";

function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return {
    atendimentoId: "at1", modo: "responder", podeEnviar: true, driver: "META_CLOUD",
    aoEnviarTexto: vi.fn(async () => ({ ok: true as const })),
    aoEnviarMidia: vi.fn(async () => ({ ok: true as const })),
    aoNota: vi.fn(async () => ({ ok: true as const })),
    ...p,
  };
}
const html = (p: Partial<PropsCompositor> = {}) => renderToStaticMarkup(createElement(Compositor, props(p)));
const htmlSeletor = () => renderToStaticMarkup(createElement(SeletorEmoji, { driver: "META_CLOUD", aoEmoji: () => {}, aoFechar: () => {} }));

const armazenamento = new Map<string, string>();
beforeEach(() => {
  armazenamento.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => armazenamento.get(k) ?? null,
    setItem: (k: string, v: string) => void armazenamento.set(k, v),
    removeItem: (k: string) => void armazenamento.delete(k),
  });
});
afterEach(() => { m.g = null; vi.unstubAllGlobals(); });

function digitar(raiz: ReactNode, v: string) {
  const ta = elementos(raiz).find((n) => n.type === "textarea")!;
  (ta.props.onChange as (e: unknown) => void)({ target: { value: v } });
}
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

describe("Compositor", () => {
  it("modo nota mostra o aviso e nunca chama aoEnviarTexto", async () => {
    m.g = criarGanchos();
    const p = props({ modo: "nota" });
    const tela = () => m.g!.renderizar(Compositor, p);
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain(AVISO_NOTA);
    digitar(tela(), "combinar com a coordenação");
    clicar(tela(), "Enviar");
    await esvaziar();
    expect(p.aoNota).toHaveBeenCalledWith("combinar com a coordenação");
    expect(p.aoEnviarTexto).not.toHaveBeenCalled();
    expect(p.aoEnviarMidia).not.toHaveBeenCalled();
  });

  it("modo responder envia pelo aoEnviarTexto, limpa o campo e o rascunho", async () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    digitar(tela(), "  Olá  ");
    expect(armazenamento.get("conversa-rascunho:at1:responder")).toBe("  Olá  ");
    clicar(tela(), "Enviar");
    await esvaziar();
    expect(p.aoEnviarTexto).toHaveBeenCalledWith("Olá");
    expect(p.aoNota).not.toHaveBeenCalled();
    expect(armazenamento.has("conversa-rascunho:at1:responder")).toBe(false);
  });

  it("falha no envio mantém o texto e mostra o erro", async () => {
    m.g = criarGanchos();
    const p = props({ aoEnviarTexto: vi.fn(async () => ({ ok: false as const, erro: "Janela de 24h fechada." })) });
    const tela = () => m.g!.renderizar(Compositor, p);
    digitar(tela(), "Oi");
    clicar(tela(), "Enviar");
    await esvaziar();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Janela de 24h fechada.");
    expect(armazenamento.get("conversa-rascunho:at1:responder")).toBe("Oi");
  });

  it("sem podeEnviar: compositor bloqueado com motivo", () => {
    const h = html({ podeEnviar: false });
    expect(h).toContain(MOTIVO_SEM_ENVIO);
    expect(h).toContain("Você não pode enviar nesta conversa");
    expect(h).not.toContain("<textarea");
  });

  it("rascunho do atendimento reaparece na primeira pintura", () => {
    armazenamento.set("conversa-rascunho:at1:responder", "meio da frase");
    expect(html()).toContain("meio da frase");
    expect(html({ atendimentoId: "at2" })).not.toContain("meio da frase");
  });

  it("contato, enquete e localização ficam visíveis e desabilitados com o aviso do motor", () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Contato", "Enquete", "Localização"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${r}</button>`));
  });
});

describe("SeletorEmoji", () => {
  it("abas GIF e Figurinha desabilitadas com o aviso", () => {
    const h = htmlSeletor();
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    expect(h).toMatch(/<button[^>]* disabled=""[^>]*>GIFs<\/button>/);
    expect(h).toMatch(/<button[^>]* disabled=""[^>]*>Figurinhas<\/button>/);
    expect(h).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>Emojis<\/button>/);
  });
  it("lista o grupo inicial", () => { expect(htmlSeletor()).toContain("😀"); });
  it("busca sem acento e sem variantes de tom de pele", () => {
    const dados: EntradaEmoji[] = [
      { emoji: "😀", label: "rosto risonho", keywords: "feliz | riso", group: "Smileys & Emotion" },
      { emoji: "👋🏽", label: "mão acenando", keywords: "oi", group: "People & Body" },
      { emoji: "👋", label: "mão acenando", keywords: "oi", group: "People & Body" },
    ];
    expect(buscarEmoji(dados, "RISÔNHO", "Flags").map((e) => e.emoji)).toEqual(["😀"]);
    expect(buscarEmoji(dados, "", "People & Body").map((e) => e.emoji)).toEqual(["👋"]);
    expect(buscarEmoji(dados, "", "Flags")).toEqual([]);
  });
});
