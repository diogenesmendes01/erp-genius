import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/continuidade-fila", () => ({ consultarFilaContinuidadeMensal: mocks.consultar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ matriculaId: "matricula/a?", codigo: "MAT-608", alunoNome: "Ana", estado: "OFERTA_PENDENTE", motivo: "Confirmação de oferta aguarda decisão.", cobertura: { inicio: "2099-11-03", fim: "2099-12-02" }, vencimento: "2099-11-10" }],
  pagina: 1,
  temProxima: true,
  ...sobrescrever,
} });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("FilaContinuidadeMensalPage", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("interrompe no guard e não consulta a fila quando o acesso é negado", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ pagina: "2" }) })).rejects.toThrow("acesso negado");

    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("exige Financeiro/Administração e apresenta os atalhos da matrícula sem emissão", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = await render({});

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).toContain("MAT-608 · Ana");
    expect(html).toContain("Oferta pendente");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/continuidade-mensal");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/disponibilidade-oferta");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/indisponibilidade-oferta");
    expect(html).toContain("não emite cobranças");
    expect(html).not.toContain("Emitir");
  });

  it("paginação nos dois sentidos: primeira só com Próxima; no meio, as duas; Anterior aponta para a página certa", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());
    const primeira = await render({});
    expect(primeira).not.toContain("Anterior");
    expect(primeira).toContain('href="/financeiro/continuidade?pagina=2">Próxima');

    const meio = await render({ pagina: "3" });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ pagina: 3 });
    expect(meio).toContain('href="/financeiro/continuidade?pagina=2">← Anterior');
    expect(meio).toContain('href="/financeiro/continuidade?pagina=4">Próxima');

    mocks.consultar.mockResolvedValue(resposta({ pagina: 2, temProxima: false }));
    const ultima = await render({ pagina: "2" });
    expect(ultima).toContain('href="/financeiro/continuidade">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });

  it("distingue fila zerada (primeira página), página seguinte vazia e falha de consulta", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({ itens: [], temProxima: false }));
    // Primeira página sem itens: a fila está zerada — nada de "nesta página" (docs/42, vazio paginado).
    const vazio = await render({});
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 1 });
    expect(vazio).toContain("Nenhuma matrícula precisa de acompanhamento na continuidade mensal.");
    expect(vazio).not.toContain("nesta página");
    expect(vazio).not.toContain("Próxima");
    expect(vazio).not.toContain("Anterior");

    // Página seguinte vazia: o texto é de paginação e a volta para a anterior continua ao lado.
    const seguinte = await render({ pagina: "2" });
    expect(seguinte).toContain("Nenhuma matrícula precisa de acompanhamento nesta página.");
    expect(seguinte).not.toContain("na continuidade mensal.");
    expect(seguinte).toContain('href="/financeiro/continuidade">← Anterior');

    mocks.consultar.mockResolvedValue({ ok: false, erro: "Consulta indisponível agora." });
    const erro = await render({});
    expect(erro).toContain('role="alert"');
    expect(erro).toContain("Consulta indisponível agora.");
    expect(erro).not.toContain("Nenhuma matrícula precisa de acompanhamento");
  });
});
