import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateConfig } from "@/server/whatsapp/consultas";

// Editar template aprovado (docs/42 L2518): o aviso sobe para o topo do formulário e o Salvar só abre o
// ConfirmarAcao ("será revertido para rascunho; os degraus que o usam ficam sem template aprovado");
// template que não está aprovado salva direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ salvarTemplateWhatsApp: m.salvar, sincronizarTemplatesMeta: vi.fn(), submeterTemplateMeta: vi.fn() }));

import { TemplatesPainel } from "./TemplatesPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const aprovado: TemplateConfig = { id: "t1", nome: "cobranca_vencida", corpo: "Olá {nome}, sua cobrança venceu.", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: "m1", atualizadoEm: "2026-01-01T00:00:00.000Z" };
const rascunho: TemplateConfig = { ...aprovado, id: "t2", nome: "lembrete", statusMeta: "RASCUNHO", metaTemplateId: null };
const tela = (): ReactNode => m.ganchos!.renderizar(TemplatesPainel, { templates: [aprovado, rascunho] });
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
/** Botões "Editar" na ordem da lista (um por template). */
const editar = (indice: number) => {
  const botoes = elementos(tela()).filter((n) => n.type === "button" && texto(n.props.children).trim() === "Editar");
  (botoes[indice].props.onClick as () => void)();
};
const AVISO = "Este template está aprovado pela Meta.";

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.salvar.mockResolvedValue({ ok: true, dado: { id: "t1" } });
});

describe("TemplatesPainel — editar template aprovado passa pela confirmação", () => {
  it("o aviso aparece no topo do formulário do aprovado; Salvar não salva; a confirmação diz o efeito", async () => {
    editar(0);
    expect(texto(tela())).toContain(AVISO);
    await clicar(tela(), "Salvar template");
    expect(m.salvar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe(`Salvar o template aprovado "cobranca_vencida" e devolvê-lo a rascunho?`);
    expect(texto(c.props.children)).toContain("Este template está aprovado e será revertido para rascunho. Os degraus que o usam ficam sem template aprovado.");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.salvar).toHaveBeenCalledWith({ id: "t1", nome: "cobranca_vencida", corpo: aprovado.corpo, idioma: "es", categoria: "utility" });
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(texto(t)).not.toContain(AVISO); // o formulário fechou
    expect(doTipo(t, FeedbackAcao).at(-1)!.props.sucesso).toBe("Template salvo — voltou a rascunho; submeta à Meta de novo.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("template em rascunho: sem aviso e o Salvar grava direto", async () => {
    editar(1);
    expect(texto(tela())).not.toContain(AVISO);
    await clicar(tela(), "Salvar template");
    expect(m.salvar).toHaveBeenCalledTimes(1);
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });

  it("voltar não salva e mantém o formulário aberto", async () => {
    editar(0);
    await clicar(tela(), "Salvar template");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(texto(t)).toContain(AVISO);
    expect(m.salvar).not.toHaveBeenCalled();
  });
});
