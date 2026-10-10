import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/continuidade-fila", () => ({ consultarFilaContinuidadeMensal: mocks.consultar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ matriculaId: "matricula/a?", codigo: "MAT-608", alunoNome: "Ana", estado: "OFERTA_PENDENTE", motivo: "Confirmação de oferta aguarda decisão.", cobertura: { inicio: "2099-11-03", fim: "2099-12-02" }, vencimento: "2099-11-10" }],
  temAnterior: false, temProxima: true, anterior: null, proxima: "m-20",
  ...sobrescrever,
} });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("FilaContinuidadeMensalPage", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("interrompe no guard e não consulta a fila quando o acesso é negado", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ depois: "m-20" }) })).rejects.toThrow("acesso negado");

    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("exige Financeiro/Administração e apresenta os atalhos da matrícula sem emissão", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = await render({});

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({});
    expect(html).toContain("MAT-608 · Ana");
    expect(html).toContain("Oferta pendente");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/continuidade-mensal");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/disponibilidade-oferta");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/indisponibilidade-oferta");
    expect(html).toContain("não emite cobranças");
    expect(html).not.toContain("Emitir");
  });

  it("cursor nos dois sentidos: o início só com Próxima; Anterior e Próxima levam o cursor certo", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());
    const inicio = await render({});
    expect(inicio).not.toContain("Anterior");
    expect(inicio).toContain('href="/financeiro/continuidade?depois=m-20">Próxima');
    expect(inicio).not.toContain("pagina=");

    mocks.consultar.mockResolvedValue(resposta({ temAnterior: true, anterior: "m-21", proxima: "m-40" }));
    const meio = await render({ depois: "m-20" });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ depois: "m-20" });
    expect(meio).toContain('href="/financeiro/continuidade?antes=m-21">← Anterior');
    expect(meio).toContain('href="/financeiro/continuidade?depois=m-40">Próxima');

    mocks.consultar.mockResolvedValue(resposta({ temAnterior: true, temProxima: false, anterior: "m-41", proxima: null }));
    const ultima = await render({ depois: "m-40" });
    expect(ultima).toContain('href="/financeiro/continuidade?antes=m-41">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });

  it("distingue fila zerada (início), ponto da fila sem matrículas e falha de consulta", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({ itens: [], temProxima: false, proxima: null }));
    // Início sem itens: a fila está zerada — nada de "nesta página" nem link para si (docs/42, vazio paginado).
    const vazio = await render({});
    expect(mocks.consultar).toHaveBeenCalledWith({});
    expect(vazio).toContain("Nenhuma matrícula precisa de acompanhamento na continuidade mensal.");
    expect(vazio).not.toContain("nesta página");
    expect(vazio).not.toContain("Próxima");
    expect(vazio).not.toContain("Anterior");
    expect(vazio).not.toContain('href="/financeiro/continuidade"');

    // Cursor que não leva a nada: o vazio diz isso e leva de volta ao início.
    const alem = await render({ depois: "m-sumida" });
    expect(alem).toContain("Nenhuma matrícula a partir deste ponto da fila");
    expect(alem).not.toContain("na continuidade mensal.");
    expect(alem).toContain('href="/financeiro/continuidade">Ir para o início da fila');

    mocks.consultar.mockResolvedValue({ ok: false, erro: "Consulta indisponível agora." });
    const erro = await render({});
    expect(erro).toContain('role="alert"');
    expect(erro).toContain("Consulta indisponível agora.");
    expect(erro).not.toContain("Nenhuma matrícula precisa de acompanhamento");
  });
});
