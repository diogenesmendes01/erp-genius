import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3: o editor de templates do WhatsApp avisa ao sair só com alteração não salva — abrir e
// fechar sem mexer, ou salvar, não deixa aviso ligado. O gancho é observado pelo valor de `sujo` a cada render
// (o beforeunload em si está em src/lib/aviso-ao-sair.test.ts). Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aviso: vi.fn(), salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ salvarTemplateWhatsApp: m.salvar, sincronizarTemplatesMeta: vi.fn(), submeterTemplateMeta: vi.fn() }));
vi.mock("@/lib/aviso-ao-sair", () => ({ useAvisoAoSair: m.aviso }));

import type { ReactNode } from "react";
import { TemplatesPainel } from "./TemplatesPainel";
import { TEMPLATE_VAZIO, templateAlterado } from "./template-alterado";
import { CampoTexto } from "@/components/CampoTexto";
import { clicar, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

const aprovado = { id: "t1", nome: "cobranca_vencida", corpo: "Olá {nome}", idioma: "es", categoria: "UTILITY", statusMeta: "RASCUNHO", metaTemplateId: null, atualizadoEm: "2026-10-01T00:00:00.000Z" };
const tela = () => m.ganchos!.renderizar(TemplatesPainel, { templates: [aprovado] });
const sujo = () => m.aviso.mock.calls.at(-1)?.[0];
const botaoComTexto = (t: ReactNode, rotulo: string) => elementos(t).find((n) => n.type === "button" && texto(n.props.children).trim() === rotulo)!;
const corpo = (t: ReactNode) => elementos(t).find((n) => n.type === CampoTexto)!;

describe("TemplatesPainel — aviso ao sair só com alteração", () => {
  it("sem editor aberto, ou aberto sem mexer (novo ou existente), não avisa", () => {
    tela();
    expect(sujo()).toBe(false);
    (botaoComTexto(tela(), "Novo template").props.onClick as () => void)();
    tela();
    expect(sujo()).toBe(false);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Fechar")!.props.onClick as () => void)();
    (botaoComTexto(tela(), "Editar").props.onClick as () => void)();
    tela();
    expect(sujo()).toBe(false);
  });

  it("alterar o corpo liga o aviso; salvar com sucesso fecha o editor e desliga", async () => {
    (botaoComTexto(tela(), "Editar").props.onClick as () => void)();
    (corpo(tela()).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Olá {nome}, sua parcela venceu." } });
    tela();
    expect(sujo()).toBe(true);
    m.salvar.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Salvar template");
    tela();
    expect(sujo()).toBe(false);
  });

  it("save recusado mantém o editor aberto e o aviso ligado", async () => {
    (botaoComTexto(tela(), "Editar").props.onClick as () => void)();
    (corpo(tela()).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Outro corpo" } });
    m.salvar.mockResolvedValueOnce({ ok: false, erro: "Nome inválido." });
    await clicar(tela(), "Salvar template");
    tela();
    expect(sujo()).toBe(true);
  });
});

describe("templateAlterado", () => {
  const t = { id: "t1", nome: "a", corpo: "b", idioma: "es", categoria: "UTILITY" };
  it("sem formulário: não; novo igual ao vazio: não; novo com algo: sim", () => {
    expect(templateAlterado(null, [t])).toBe(false);
    expect(templateAlterado({ ...TEMPLATE_VAZIO }, [t])).toBe(false);
    expect(templateAlterado({ ...TEMPLATE_VAZIO, nome: "x" }, [t])).toBe(true);
  });
  it("editando: compara com o template de origem (categoria como o formulário a mostra)", () => {
    expect(templateAlterado({ id: "t1", nome: "a", corpo: "b", idioma: "es", categoria: "utility" }, [t])).toBe(false);
    for (const campo of ["nome", "corpo", "idioma"] as const) expect(templateAlterado({ id: "t1", nome: "a", corpo: "b", idioma: "es", categoria: "utility", [campo]: "outro" }, [t]), campo).toBe(true);
    expect(templateAlterado({ id: "t1", nome: "a", corpo: "b", idioma: "es", categoria: "marketing" }, [t])).toBe(true);
  });
  it("template que sumiu da lista (apagado por outra pessoa) conta como alterado", () => {
    expect(templateAlterado({ id: "t9", nome: "a", corpo: "b", idioma: "es", categoria: "utility" }, [t])).toBe(true);
  });
});
