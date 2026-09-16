import { describe, expect, it } from "vitest";
import { preverImpactoQuantidadeAulas } from "./modalidade-quantidade-preview";

const agora = "2026-09-16T12:00:00.000Z";
const turma = (turmaId: string, extras: Partial<{ quantidadeVigente: number; status: "PLANEJADA" | "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA"; publicada: boolean; primeiroEncontroOficial: string | null; diarioMaisRecente: string | null }> = {}) => ({
  turmaId, quantidadeVigente: 12, status: "ABERTA" as const, publicada: true, primeiroEncontroOficial: null, ...extras,
});

describe("preverImpactoQuantidadeAulas", () => {
  it("aumenta todas as não finalizadas, inclusive iniciada e rascunho sem publicar", () => {
    const r = preverImpactoQuantidadeAulas({ quantidadeAnterior: 12, quantidadeNova: 16, agora, turmas: [
      turma("finalizada", { status: "CONCLUIDA", primeiroEncontroOficial: "2026-08-01T10:00:00.000Z" }),
      turma("iniciada", { status: "EM_ANDAMENTO", primeiroEncontroOficial: "2026-09-01T10:00:00.000Z" }),
      turma("nao-iniciada"), turma("rascunho", { publicada: false }),
    ] });
    expect(r.impactos.map((i) => [i.turmaId, i.alcance, i.quantidadeNova, i.publicaAgenda, i.recalculaSomenteRascunho])).toEqual([
      ["finalizada", "FINALIZADA_PRESERVADA", 12, false, false],
      ["iniciada", "AUMENTO_INICIADA", 16, true, false],
      ["nao-iniciada", "AUMENTO_NAO_INICIADA", 16, true, false],
      ["rascunho", "AUMENTO_RASCUNHO", 16, false, true],
    ]);
    expect(r.requerAprovacaoConjunta).toBe(true);
  });

  it("reduz somente turmas não iniciadas e mantém finalizadas e iniciadas", () => {
    const r = preverImpactoQuantidadeAulas({ quantidadeAnterior: 16, quantidadeNova: 12, agora, turmas: [
      turma("finalizada", { quantidadeVigente: 16, status: "CONCLUIDA" }), turma("iniciada", { quantidadeVigente: 16, primeiroEncontroOficial: "2026-09-15T10:00:00.000Z" }),
      turma("futuro", { quantidadeVigente: 16, primeiroEncontroOficial: "2026-09-18T10:00:00.000Z" }), turma("rascunho", { quantidadeVigente: 16, publicada: false }),
    ] });
    expect(r.impactos.map((i) => [i.turmaId, i.alcance, i.quantidadeNova])).toEqual([
      ["finalizada", "FINALIZADA_PRESERVADA", 16], ["futuro", "REDUCAO_NAO_INICIADA", 12],
      ["iniciada", "REDUCAO_INICIADA_PRESERVADA", 16], ["rascunho", "REDUCAO_RASCUNHO", 12],
    ]);
  });

  it("usa encontro oficial passado em vez do status para definir início", () => {
    const r = preverImpactoQuantidadeAulas({ quantidadeAnterior: 10, quantidadeNova: 8, agora, turmas: [turma("aberta-mas-iniciada", { quantidadeVigente: 10, status: "ABERTA", primeiroEncontroOficial: "2026-09-10T10:00:00.000Z" })] });
    expect(r.impactos[0]).toMatchObject({ alcance: "REDUCAO_INICIADA_PRESERVADA", quantidadeNova: 10 });
  });

  it("não reduz meta histórica superior numa turma iniciada após redução anterior", () => {
    const r = preverImpactoQuantidadeAulas({ quantidadeAnterior: 25, quantidadeNova: 28, agora, turmas: [turma("meta-30", { quantidadeVigente: 30, primeiroEncontroOficial: "2026-09-10T10:00:00.000Z" })] });
    expect(r.impactos[0]).toMatchObject({ alcance: "AUMENTO_INICIADA", quantidadeVigente: 30, quantidadeNova: 30, preservada: true, publicaAgenda: false, recalculaSomenteRascunho: false, causa: "Meta vigente da turma já atende ou supera a nova meta." });
  });

  it("considera iniciado exatamente no instante atual e não pelo diário atrasado", () => {
    const r = preverImpactoQuantidadeAulas({ quantidadeAnterior: 12, quantidadeNova: 10, agora, turmas: [turma("marco-exato", { publicada: false, primeiroEncontroOficial: agora, diarioMaisRecente: "2026-09-10T10:00:00.000Z" })] });
    expect(r.impactos[0]).toMatchObject({ alcance: "REDUCAO_INICIADA_PRESERVADA", quantidadeNova: 12, dadosIncoerentes: [expect.any(String)] });
  });
});
