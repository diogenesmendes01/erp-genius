import { describe, expect, it, vi } from "vitest";

const { criarAvisos, validarFonte } = vi.hoisted(() => ({ criarAvisos: vi.fn(), validarFonte: vi.fn() }));
vi.mock("@/server/comunicacoes-agenda/avisos", () => ({ criarAvisosAlteracaoAgendaTx: criarAvisos }));
vi.mock("./quantidade-fonte", () => ({ validarFonteQuantidadeAulasTx: validarFonte }));
import { criarAvisosQuantidadeAulasTx } from "./quantidade-avisos-tx";

const antes = "2099-10-01T19:00:00.000Z";
const depois = "2099-10-08T19:00:00.000Z";

describe("criarAvisosQuantidadeAulasTx", () => {
  it("avisa apenas a matrícula coberta antes ou depois pelos encontros realmente aplicados", async () => {
    validarFonte.mockResolvedValue({ proposta: { id: "p1" }, porTurma: new Map([["t1", new Set(["movido", "novo"])]]), encontros: [] });
    criarAvisos.mockResolvedValue([]);
    const tx = {
      impactoQuantidadeAulasModalidade: { findMany: vi.fn().mockResolvedValue([{ turmaId: "t1", snapshot: { agendaAntes: [{ id: "movido", inicio: antes }, { id: "inalterado", inicio: "2099-10-03T19:00:00.000Z" }], agendaDepois: [{ id: "movido", inicio: depois }, { id: "inalterado", inicio: "2099-10-03T19:00:00.000Z" }, { id: null, inicio: "2099-10-15T19:00:00.000Z" }] } }]) },
      encontroAgenda: { findMany: vi.fn().mockResolvedValue([{ id: "movido", inicio: new Date(depois) }, { id: "novo", inicio: new Date("2099-10-15T19:00:00.000Z") }]) },
      alocacaoTurma: { findMany: vi.fn().mockResolvedValue([
        { matriculaId: "anterior", criadoEm: new Date("2099-09-01T00:00:00Z"), encerradaEm: new Date("2099-10-02T00:00:00Z"), ativa: false, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
        { matriculaId: "nova", criadoEm: new Date("2099-10-02T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
        { matriculaId: "fora", criadoEm: new Date("2099-10-20T00:00:00Z"), encerradaEm: null, ativa: true, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null },
      ]) },
    };
    await expect(criarAvisosQuantidadeAulasTx(tx as never, { eventoId: "e1", propostaId: "p1" })).resolves.toEqual([
      { matriculaId: "anterior", encontrosIds: ["movido"] }, { matriculaId: "nova", encontrosIds: ["movido", "novo"] },
    ]);
    expect(criarAvisos).toHaveBeenCalledTimes(2);
    expect(criarAvisos).toHaveBeenCalledWith(tx, { eventoId: "e1", matriculaId: "anterior", encontrosIds: ["movido"] });
  });

  it("recusa evento sem a proposta aplicada correspondente", async () => {
    validarFonte.mockResolvedValue(null);
    await expect(criarAvisosQuantidadeAulasTx({} as never, { eventoId: "forjado", propostaId: "p1" })).rejects.toThrow("fonte canônica");
  });
});
