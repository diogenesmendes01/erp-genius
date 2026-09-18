import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ carregar: vi.fn() }));
vi.mock("@/server/contratos/aditivo-aplicacao-campos-tx", () => ({ carregarAplicacoesCamposTx: m.carregar }));
import { carregarReferenciaAditivoCoberturaAplicadaTx } from "./continuidade-aditivo-cobertura-tx";

const v = (versao: number, vigencia: string, politica: unknown, completa = true) => ({
  id: `v${versao}`, versao, vigenciaInicio: new Date(`${vigencia}T00:00:00.000Z`),
  alteracoes: [{ origem: "COBERTURA_INICIO" }, { origem: "COBERTURA_FIM" }],
  conjuntoCoberturaCompleto: completa ? { id: `c${versao}`, decisaoId: `d${versao}`, politica, aplicadaEm: `2026-0${versao}-02T10:00:00.000Z` } : null,
});
const entrada = { matriculaId: "m", inicioCobertura: new Date("2026-04-01T00:00:00.000Z"), regraContratada: { referencia: "MES_CIVIL" } };

describe("referência de continuidade provada por aditivo", () => {
  it("PRESERVAR mantém o último ciclo mudado e não restaura o ciclo original", async () => {
    m.carregar.mockResolvedValue([
      v(1, "2026-01-01", { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-06" }),
      v(2, "2026-03-01", { escolha: "PRESERVAR_REFERENCIA" }),
    ]);
    await expect(carregarReferenciaAditivoCoberturaAplicadaTx({} as never, entrada)).resolves.toMatchObject({
      referencia: { conjuntoId: "c2", versaoCondicoesId: "v2", decisaoId: "d2", regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-06" } },
    });
  });
  it("não antecipa MUDAR antes da vigência e exige prova integral vigente", async () => {
    m.carregar.mockResolvedValue([v(1, "2026-05-01", { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2026-05-06" })]);
    await expect(carregarReferenciaAditivoCoberturaAplicadaTx({} as never, entrada)).resolves.toBeNull();
    m.carregar.mockResolvedValue([v(1, "2026-03-01", { escolha: "PRESERVAR_REFERENCIA" }, false)]);
    await expect(carregarReferenciaAditivoCoberturaAplicadaTx({} as never, entrada)).rejects.toThrow(/aplicação integral/);
  });
});