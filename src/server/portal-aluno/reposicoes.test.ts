import { describe, expect, it } from "vitest";
import { prazoEtapaEntregaPortalAluno } from "./reposicoes";

describe("prazo da etapa exibida no portal", () => {
  it("mantém aberta a resposta de correção mesmo quando o prazo inicial já acabou", () => {
    const etapa = prazoEtapaEntregaPortalAluno(
      new Date("2026-09-15T10:00:00.000Z"),
      [
        // A pausa começou antes da correção; só o trecho posterior a ela conta.
        { inicio: new Date("2026-09-15T10:30:00.000Z"), fim: new Date("2026-09-15T11:30:00.000Z") },
      ],
      [],
      {
        criadaEm: new Date("2026-09-15T11:00:00.000Z"),
        prazoAte: new Date("2026-09-15T12:00:00.000Z"),
        prorrogacoes: [],
      },
    );

    expect(etapa.etapaEntrega).toBe("CORRECAO");
    expect(etapa.prazoAte?.toISOString()).toBe("2026-09-15T12:30:00.000Z");
  });

  it("usa o prazo da primeira entrega enquanto não existe correção pendente", () => {
    const etapa = prazoEtapaEntregaPortalAluno(
      new Date("2026-09-15T12:00:00.000Z"),
      [],
      [{ novoPrazo: new Date("2026-09-15T12:45:00.000Z"), autorizadaEm: new Date("2026-09-15T11:00:00.000Z"), versao: 1 }],
      null,
    );

    expect(etapa).toEqual({
      etapaEntrega: "PRIMEIRA_ENTREGA",
      prazoAte: new Date("2026-09-15T12:45:00.000Z"),
    });
  });

  it("mostra a correção prorrogada e a pausa posterior à autorização", () => {
    const etapa = prazoEtapaEntregaPortalAluno(
      null,
      [{ inicio: new Date("2026-09-15T12:10:00.000Z"), fim: new Date("2026-09-15T12:40:00.000Z") }],
      [],
      {
        criadaEm: new Date("2026-09-15T10:00:00.000Z"),
        prazoAte: new Date("2026-09-15T12:00:00.000Z"),
        prorrogacoes: [{ novoPrazo: new Date("2026-09-15T13:00:00.000Z"), autorizadaEm: new Date("2026-09-15T11:30:00.000Z"), versao: 1 }],
      },
    );

    expect(etapa).toEqual({
      etapaEntrega: "CORRECAO",
      prazoAte: new Date("2026-09-15T13:30:00.000Z"),
    });
  });
});
