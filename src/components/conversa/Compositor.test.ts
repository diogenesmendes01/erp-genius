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
import { CampoTexto } from "@/components/CampoTexto";
import { criarGanchos, clicarBotao, elementos } from "@/test/tela-sem-dom";

function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return {
    atendimentoId: "at1", modo: "responder", podeEnviar: true, capacidades: [],
    aoEnviarTexto: vi.fn(async () => ({ ok: true as const })),
    aoEnviarMidia: vi.fn(async () => ({ ok: true as const })),
    aoNota: vi.fn(async () => ({ ok: true as const })),
    ...p,
  };
}
const html = (p: Partial<PropsCompositor> = {}) => renderToStaticMarkup(createElement(Compositor, props(p)));
const htmlSeletor = () => renderToStaticMarkup(createElement(SeletorEmoji, { gif: false, figurinha: false, aoEmoji: () => {}, aoFechar: () => {} }));

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
  const ta = elementos(raiz).find((n) => n.type === CampoTexto)!;
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
    clicarBotao(tela(), "Enviar");
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
    clicarBotao(tela(), "Enviar");
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
    clicarBotao(tela(), "Enviar");
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

  it("trocar de atendimento ou de modo carrega o rascunho certo e limpa o erro da conversa anterior", async () => {
    armazenamento.set("conversa-rascunho:at2:responder", "rascunho do at2");
    armazenamento.set("conversa-rascunho:at2:nota", "nota do at2");
    m.g = criarGanchos();
    let p = props({ aoEnviarTexto: vi.fn(async () => ({ ok: false as const, erro: "Janela de 24h fechada." })) });
    const tela = () => m.g!.renderizar(Compositor, p);
    const texto = () => elementos(tela()).find((n) => n.type === CampoTexto)!.props.value;
    digitar(tela(), "Oi");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Janela de 24h fechada.");

    p = { ...p, atendimentoId: "at2" };
    tela(); // render da troca: ajusta o estado (o React refaria o render na hora)
    expect(texto()).toBe("rascunho do at2");
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).not.toContain("Janela de 24h fechada.");

    p = { ...p, modo: "nota" };
    tela();
    expect(texto()).toBe("nota do at2");

    p = { ...p, atendimentoId: "at1", modo: "responder" };
    tela();
    expect(texto()).toBe("Oi");
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

  it("contato, enquete e localização só ficam ativos quando estão nas capacidades da thread", () => {
    m.g = criarGanchos();
    const p = props({ capacidades: ["cartaoContato", "enquete", "localizacao"] });
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    expect(h).not.toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Contato", "Enquete", "Localização"]) expect(h).not.toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${r}</button>`));
  });

  // C2 da R1 do #217: anexar arquivo e gravar áudio (os do Inbox antigo) ficam no compositor novo.
  it("anexar: o arquivo escolhido sobe em /api/whatsapp/upload do atendimento e sai pelo aoEnviarMidia com a legenda", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: "/api/files/whatsapp-out/u1/doc.pdf" }) }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("FormData", class { campos: [string, unknown][] = []; append(k: string, v: unknown) { this.campos.push([k, v]); } });
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    const arquivo = { name: "contrato.pdf", size: 2048, type: "application/pdf" };
    const seletor = elementos(tela()).find((n) => n.type === "input" && n.props["aria-label"] === "Escolher arquivo")!;
    (seletor.props.onChange as (e: unknown) => void)({ target: { files: [arquivo], value: "x" } });
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("contrato.pdf");
    digitar(tela(), "segue o contrato");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(fetchMock).toHaveBeenCalledWith("/api/whatsapp/upload", expect.objectContaining({ method: "POST" }));
    const corpo = (fetchMock.mock.calls[0] as unknown as [string, { body: { campos: [string, unknown][] } }])[1].body.campos;
    expect(corpo).toEqual([["file", arquivo], ["atendimentoId", "at1"]]);
    expect(p.aoEnviarMidia).toHaveBeenCalledWith("/api/files/whatsapp-out/u1/doc.pdf", "segue o contrato");
    expect(p.aoEnviarTexto).not.toHaveBeenCalled();
  });

  it("anexar: arquivo acima de 10MB não sobe e mostra o motivo", () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    const seletor = elementos(tela()).find((n) => n.type === "input" && n.props["aria-label"] === "Escolher arquivo")!;
    (seletor.props.onChange as (e: unknown) => void)({ target: { files: [{ name: "grande.mp4", size: 11 * 1024 * 1024 }], value: "x" } });
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Arquivo vazio ou acima de 10MB.");
  });

  it("gravar áudio: a gravação vira o anexo mensagem-de-voz e sai pelo aoEnviarMidia", async () => {
    const fluxo = { getTracks: () => [{ stop: vi.fn() }] };
    let gravador: { start(): void; stop(): void; ondataavailable?: (e: unknown) => void; onstop?: () => void; mimeType: string; state: string } | null = null;
    class GravadorFalso {
      static isTypeSupported = (t: string) => t === "audio/ogg;codecs=opus";
      mimeType: string; state = "inactive"; ondataavailable?: (e: unknown) => void; onstop?: () => void;
      constructor(_f: unknown, o: { mimeType: string }) { this.mimeType = o.mimeType; gravador = this as never; }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: { size: 10 } }); this.onstop?.(); }
    }
    vi.stubGlobal("MediaRecorder", GravadorFalso);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => fluxo) } });
    vi.stubGlobal("Blob", class { constructor(public partes: unknown[], public o: unknown) {} });
    vi.stubGlobal("File", class { size = 10; constructor(_p: unknown[], public name: string, public o: { type: string }) {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url: "/api/files/whatsapp-out/u1/voz.ogg" }) })));
    vi.stubGlobal("FormData", class { append() {} });
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    await (elementos(tela()).find((n) => n.props["aria-label"] === "Gravar mensagem de voz")!.props.onClick as () => Promise<void>)();
    expect(gravador!.state).toBe("recording");
    (elementos(tela()).find((n) => n.props["aria-label"] === "Parar e revisar áudio")!.props.onClick as () => void)();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("mensagem-de-voz.ogg");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(p.aoEnviarMidia).toHaveBeenCalledWith("/api/files/whatsapp-out/u1/voz.ogg", "");
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
