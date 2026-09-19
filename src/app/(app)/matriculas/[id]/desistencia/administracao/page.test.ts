import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-administrativa", () => ({ consultarDecisaoAdministrativaDesistencia: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./DecisaoFormulario", () => ({ DecisaoFormulario: ({ podeAprovar }: { podeAprovar: boolean }) => createElement("div", { "data-decisao": "true", "data-aprovar": String(podeAprovar) }) }));
import Page from "./page";
const pedido = { id: "id-interno", versao: 2, motivo: "Cliente pediu desistência", evidenciaPedido: "Atendimento conferido", registradorNome: "Secretaria", estadoHash: "a".repeat(64), atual: true, decisao: null, podeDecidir: true, podeAprovar: true };
const dado = { matricula: { id: "m", codigo: "MAT-597" }, exigeAprovacaoAdministrativa: true, pendencias: ["Conferir o tratamento financeiro."], pedidos: [pedido] };
describe("decisão administrativa da desistência", () => {
  beforeEach(() => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  afterEach(() => vi.clearAllMocks());

  it("exibe conferência e decisão elegível sem confundir aprovação com efetivação", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m/a?" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "m/a?" });
    expect(html).toContain("MAT-597"); expect(html).toContain("Conferir o tratamento financeiro.");
    expect(html).toContain('data-aprovar="true"'); expect(html).toContain("não efetiva a desistência");
    expect(html).toContain("/matriculas/m%2Fa%3F/desistencia");
    expect(html).not.toContain("id-interno"); expect(html).not.toContain("aaaaaaaa");
  });
  it("oferece apenas rejeição para versão obsoleta e conserva decisão anterior", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, pedidos: [
      { ...pedido, atual: false, podeAprovar: false },
      { ...pedido, id: "historico", versao: 1, atual: false, podeDecidir: false, decisao: { aprovada: false, motivo: "Condições não conferidas", decisorNome: "Administração", dataISO: "2026-09-16T12:00:00.000Z" } },
    ] } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain('data-aprovar="false"'); expect(html).not.toContain('data-aprovar="true"');
    expect(html).toContain("Rejeitado por Administração"); expect(html).toContain("Condições não conferidas");
  });
  it("mantém somente leitura quando a consulta não concede decisão", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, pedidos: [{ ...pedido, podeDecidir: false, podeAprovar: false }] } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).not.toContain("data-decisao"); expect(html).toContain("Somente outra pessoa da Administração");
  });
  it("não exibe pedidos quando há erro de acesso", async () => {
    mocks.consulta.mockResolvedValue({ ok: false, erro: "Acesso negado." });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain('role="alert"'); expect(html).not.toContain("Cliente pediu desistência");
    expect(html).not.toContain("data-decisao");
  });

  it("apresenta a decisão histórica na preferência pessoal sem alterar pedido ou alçada", async () => {
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, pedidos: [{
      ...pedido,
      decisao: { aprovada: true, motivo: "Condições confirmadas", decisorNome: "Administração", dataISO: "2026-01-01T02:30:00.000Z" },
    }] } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "contrato-a" }) }));

    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html).toContain("Cliente pediu desistência");
    expect(html).not.toContain('data-decisao="true"');
    expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "contrato-a" });
  });

  it("recorre a UTC e não lê preferência ou contrato depois de guarda negada", async () => {
    mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: null } });
    mocks.consulta.mockResolvedValueOnce({ ok: true, dado: { ...dado, pedidos: [{
      ...pedido,
      decisao: { aprovada: false, motivo: "Pendência", decisorNome: "Administração", dataISO: "2026-01-01T02:30:00.000Z" },
    }] } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "contrato-a" }) }));

    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");

    mocks.sessao.mockRejectedValueOnce(new Error("Acesso negado."));
    await expect(Page({ params: Promise.resolve({ id: "contrato-b" }) })).rejects.toThrow("Acesso negado.");
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(mocks.consulta).toHaveBeenCalledTimes(1);
  });
});
