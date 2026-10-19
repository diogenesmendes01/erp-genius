import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Desativar idioma e preço (docs/42 L2340; fatia B, issue #169): os botões só abrem o ConfirmarAcao, que nomeia
// o impacto (produtos do idioma; combinação sem preço de referência); só a confirmação chama a action; erro e
// incerto ficam no diálogo. Ativar o idioma e reativar o preço continuam diretos.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  idioma: vi.fn(), preco: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/catalogo/acoes", () => ({ criarIdioma: vi.fn(), definirIdiomaAtivo: m.idioma, criarPreco: vi.fn(), definirPrecoAtivo: m.preco }));

import { IdiomasPainel, type IdiomaRow } from "./IdiomasPainel";
import { PrecosPainel, type PrecoRow } from "./PrecosPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const botaoDe = (t: ReactNode, rotulo: string): No => elementos(t).find((n: No) => n.type === "button" && texto(n.props.children).trim() === rotulo)!;
const sucessos = (t: ReactNode) => elementos(t).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.sucesso);

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.idioma.mockResolvedValue({ ok: true });
  m.preco.mockResolvedValue({ ok: true });
});

describe("IdiomasPainel — desativar passa pela confirmação", () => {
  const idiomas: IdiomaRow[] = [
    { id: "ing", nome: "Inglês", ativo: true, niveis: [{ id: "n1", codigo: "A1", ordem: 1 }, { id: "n2", codigo: "A2", ordem: 2 }], _count: { produtos: 4 } },
    { id: "fra", nome: "Francês", ativo: false, niveis: [], _count: { produtos: 1 } },
  ];
  const tela = (): ReactNode => m.ganchos!.renderizar(IdiomasPainel, { idiomas });

  it("clicar não desativa; a confirmação nomeia o idioma e conta os produtos; só confirmar desativa, uma vez", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    expect(m.idioma).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Desativar Inglês?");
    expect(c.props.confirmacao).toBe("desativação do idioma");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("4 produtos usam este idioma (2 níveis).");
    expect(m.idioma).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.idioma).toHaveBeenCalledTimes(1);
    expect(m.idioma).toHaveBeenCalledWith("ing", false);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(sucessos(t)).toContain("Idioma desativado.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não desativa", () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.idioma).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    m.idioma.mockResolvedValueOnce({ ok: false, erro: "Idioma não encontrado." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Idioma não encontrado.", confirmarDisponivel: true });
    m.idioma.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO);
    expect(confirmacoes(tela())).toHaveLength(1);
  });

  it("ativar continua direto", async () => {
    await (botaoDe(tela(), "Ativar").props.onClick as () => Promise<void>)();
    expect(m.idioma).toHaveBeenCalledWith("fra", true);
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});

describe("PrecosPainel — desativar passa pela confirmação", () => {
  const preco = (over: Partial<PrecoRow>): PrecoRow => ({
    id: "p", valor: 120, moeda: "BRL", ativo: true, tipoCobranca: "MENSALIDADE", versaoEstudo: null,
    pais: { nome: "Brasil" }, produto: { idioma: { nome: "Inglês" }, modalidade: { nome: "Regular" } }, ...over,
  });
  let precos: PrecoRow[];
  const tela = (): ReactNode => m.ganchos!.renderizar(PrecosPainel, { precos, paises: [], produtos: [] });

  beforeEach(() => {
    precos = [preco({ id: "p-ativo" }), preco({ id: "p-antigo", ativo: false, valor: 100 })];
  });

  it("clicar não desativa; a confirmação nomeia a combinação e avisa que não resta preço ativo; só confirmar desativa", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    expect(m.preco).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Desativar o preço de Inglês · Regular em Brasil?");
    expect(c.props.confirmacao).toBe("desativação do preço");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("passa ao histórico");
    expect(consequencia).toContain("Não resta outro preço ativo para Brasil × Inglês · Regular");
    expect(consequencia).toContain("novas matrículas desse produto ficam sem preço de referência");
    expect(m.preco).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.preco).toHaveBeenCalledTimes(1);
    expect(m.preco).toHaveBeenCalledWith("p-ativo", false);
    (c.props.aoConcluir as () => void)();
    const t = tela();
    expect(confirmacoes(t)).toHaveLength(0);
    expect(sucessos(t)).toContain("Preço desativado.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("com outro preço ativo da mesma combinação, a confirmação diz que ele continua valendo", () => {
    precos = [preco({ id: "p-ativo" }), preco({ id: "p-outro", valor: 130 })];
    (elementos(tela()).filter((n: No) => n.type === "button" && texto(n.props.children).trim() === "Desativar")[0].props.onClick as () => void)();
    const consequencia = texto(confirmacoes(tela())[0].props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Outro preço ativo da mesma combinação continua valendo.");
    expect(consequencia).not.toContain("Não resta outro preço ativo");
  });

  it("voltar não desativa", () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.preco).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    (botaoDe(tela(), "Desativar").props.onClick as () => void)();
    m.preco.mockResolvedValueOnce({ ok: false, erro: "Preço não encontrado." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Preço não encontrado.", confirmarDisponivel: true });
    m.preco.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO);
    expect(confirmacoes(tela())).toHaveLength(1);
  });

  it("reativar continua direto", async () => {
    await (botaoDe(tela(), "Reativar").props.onClick as () => Promise<void>)();
    expect(m.preco).toHaveBeenCalledWith("p-antigo", true);
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});
