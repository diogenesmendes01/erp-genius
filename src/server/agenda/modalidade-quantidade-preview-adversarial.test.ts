import { expect, it } from "vitest";
import { preverImpactoQuantidadeAulas } from "./modalidade-quantidade-preview";

it("preserva metas individuais já superiores e altera somente turmas ainda na meta global", () => {
  const previa = preverImpactoQuantidadeAulas({
    quantidadeAnterior: 25,
    quantidadeNova: 28,
    agora: "2026-09-16T12:00:00.000Z",
    turmas: [
      {
        turmaId: "iniciada-meta-30",
        quantidadeVigente: 30,
        status: "EM_ANDAMENTO",
        publicada: true,
        primeiroEncontroOficial: "2026-09-01T10:00:00.000Z",
        excecoesQ37: [],
      },
      {
        turmaId: "iniciada-meta-25",
        quantidadeVigente: 25,
        status: "EM_ANDAMENTO",
        publicada: true,
        primeiroEncontroOficial: "2026-09-01T10:00:00.000Z",
        excecoesQ37: [],
      },
      {
        turmaId: "rascunho-meta-30",
        quantidadeVigente: 30,
        status: "PLANEJADA",
        publicada: false,
        primeiroEncontroOficial: null,
        excecoesQ37: [],
      },
    ],
  });

  expect(previa.impactos).toEqual([
    expect.objectContaining({
      turmaId: "iniciada-meta-25",
      alcance: "AUMENTO_INICIADA",
      quantidadeVigente: 25,
      quantidadeNova: 28,
      preservada: false,
      publicaAgenda: true,
    }),
    expect.objectContaining({
      turmaId: "iniciada-meta-30",
      alcance: "AUMENTO_INICIADA",
      quantidadeVigente: 30,
      quantidadeNova: 30,
      preservada: true,
      publicaAgenda: false,
    }),
    expect.objectContaining({
      turmaId: "rascunho-meta-30",
      alcance: "AUMENTO_RASCUNHO",
      quantidadeVigente: 30,
      quantidadeNova: 30,
      preservada: true,
      recalculaSomenteRascunho: false,
    }),
  ]);
});
