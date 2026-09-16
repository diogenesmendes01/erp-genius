import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/continuidade-fila", () => ({ consultarFilaContinuidadeMensal: mocks.consultar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ matriculaId: "matricula/a?", codigo: "MAT-608", alunoNome: "Ana", estado: "OFERTA_PENDENTE", motivo: "Confirmação de oferta aguarda decisão.", cobertura: { inicio: "2099-11-03", fim: "2099-12-02" }, vencimento: "2099-11-10" }],
  proximoCursor: "cursor &/",
  ...sobrescrever,
} });

describe("FilaContinuidadeMensalPage", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("interrompe no guard e não consulta a fila quando o acesso é negado", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ cursor: "nao-deve-chegar" }) })).rejects.toThrow("acesso negado");

    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("exige Financeiro/Administração e apresenta navegação codificada sem emissão", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({ cursor: "anterior" });
    expect(html).toContain("MAT-608 · Ana");
    expect(html).toContain("Oferta pendente");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/continuidade-mensal");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/disponibilidade-oferta");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/indisponibilidade-oferta");
    expect(html).toContain("cursor=cursor%20%26%2F");
    expect(html).toContain("Voltar ao início");
    expect(html).toContain("não emite cobranças");
    expect(html).not.toContain("Emitir");
  });

  it("distingue página vazia da falha de consulta", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({ itens: [], proximoCursor: null }));
    const vazio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.consultar).toHaveBeenCalledWith({ cursor: undefined });
    expect(vazio).toContain("Nenhuma matrícula precisa de acompanhamento nesta página.");
    expect(vazio).not.toContain("Próxima página");

    mocks.consultar.mockResolvedValue({ ok: false, erro: "Cursor de fila inválido." });
    const erro = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(erro).toContain('role="alert"');
    expect(erro).toContain("Cursor de fila inválido.");
    expect(erro).not.toContain("Nenhuma matrícula precisa de acompanhamento");
  });
});
