import { describe, expect, it, vi } from "vitest";
import { carregarComprovacaoOfertaContinuidadeAgendaTx } from "./oferta-continuidade-agenda-tx";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const base = (ajustes: Record<string, unknown> = {}) => ({
  id: "alocacao", turmaId: "turma", criadoEm: d("2026-01-01"), encerradaEm: null,
  turma: {
    id: "turma", status: "EM_ANDAMENTO", dataFim: null,
    propostasGrade: [{ id: "grade-atual", versao: 2, calendarioId: "cal", calendario: { versao: 4, fusoInstitucional: "UTC" } }],
    encontrosAgenda: [
      { id: "a1", inicio: new Date("2026-10-01T12:00:00Z"), fim: new Date("2026-10-01T13:00:00Z"), status: "PREVISTO", finalidade: "AULA", matriculaId: null, propostaGradeId: "grade-atual", professorId: "p1", professor: { ativo: true, papeis: ["PROFESSOR"] } },
      { id: "a2", inicio: new Date("2026-10-31T12:00:00Z"), fim: new Date("2026-10-31T13:00:00Z"), status: "PREVISTO", finalidade: "AULA", matriculaId: null, propostaGradeId: "grade-atual", professorId: "p1", professor: { ativo: true, papeis: ["PROFESSOR"] } },
    ],
    ...ajustes,
  },
});
function tx(alocacoes: unknown[], ausencias: unknown[] = [], calendario: unknown = { id: "cal", versao: 4 }) {
  return { alocacaoTurma: { findMany: vi.fn().mockResolvedValue(alocacoes) }, indisponibilidadeDocente: { findMany: vi.fn().mockResolvedValue(ausencias) }, versaoCalendarioEscolar: { findFirst: vi.fn().mockResolvedValue(calendario) } };
}
const entrada = { matriculaId: "m1", inicio: new Date("2026-10-01T00:00:00Z"), fim: new Date("2026-10-31T00:00:00Z") };

describe("carregarComprovacaoOfertaContinuidadeAgendaTx", () => {
  it("comprova apenas agenda publicada da alocação da matrícula", async () => {
    const banco = tx([base()]);
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(banco as never, entrada)).resolves.toMatchObject({ estado: "COMPROVADA_POR_AGENDA", memoria: { fontes: [{ alocacaoId: "alocacao", gradeId: "grade-atual", calendarioId: "cal", encontros: [{ id: "a1" }, { id: "a2" }] }] } });
    expect(banco.alocacaoTurma.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ matriculaId: "m1" }) }));
  });
  it("não usa aula de outra grade, particular, recuperação ou rascunho como prova", async () => {
    for (const encontro of [
      { ...base().turma.encontrosAgenda[0], propostaGradeId: "grade-antiga" },
      { ...base().turma.encontrosAgenda[0], matriculaId: "m1" },
      { ...base().turma.encontrosAgenda[0], finalidade: "RECUPERACAO" },
      { ...base().turma.encontrosAgenda[0], status: "RASCUNHO" },
    ]) {
      const banco = tx([base({ encontrosAgenda: [encontro, base().turma.encontrosAgenda[1]] })]);
      await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(banco as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO" });
    }
  });
  it("não deixa cancelamento no período ou indisponibilidade docente provar oferta", async () => {
    const cancelada = { ...base().turma.encontrosAgenda[0], status: "CANCELADO" };
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base({ encontrosAgenda: [cancelada, base().turma.encontrosAgenda[1]] })]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["AULA_EXCEPCIONAL_NO_PERIODO"] } });
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base()], [{ id: "aus", professorId: "p1", inicio: new Date("2026-10-01T12:00:00Z"), fim: new Date("2026-10-01T13:00:00Z") }]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["DOCENTE_INDISPONIVEL"] } });
  });
  it("não infere vínculo e não deixa dataFim sozinha provar oferta", async () => {
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["VINCULO_AUSENTE"] } });
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base({ dataFim: new Date("2026-10-15T00:00:00Z") })]) as never, entrada)).resolves.toMatchObject({ estado: "COMPROVADA_POR_AGENDA" });
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base({ dataFim: new Date("2026-12-31T00:00:00Z"), encontrosAgenda: [] })]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["AGENDA_INSUFICIENTE"] } });
  });
});

it("confere o último dia inteiro no fuso da escola, inclusive depois da meia-noite UTC", async () => {
  const turma = base().turma;
  turma.propostasGrade[0].calendario.fusoInstitucional = "America/Sao_Paulo";
  turma.encontrosAgenda.push({ ...turma.encontrosAgenda[0], id: "cancelada-ultimo-dia", inicio: new Date("2026-11-01T01:00:00Z"), fim: new Date("2026-11-01T02:00:00Z"), status: "CANCELADO" });
  expect(await carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base(turma)]) as never, entrada)).toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["AULA_EXCEPCIONAL_NO_PERIODO"] } });
});

it("usa os intervalos noturnos publicados no fuso da escola, sem recorrer ao dataFim legado", async () => {
  const turma = base({ dataFim: new Date("2026-10-02T00:00:00Z") }).turma;
  turma.propostasGrade[0].calendario.fusoInstitucional = "Pacific/Kiritimati";
  turma.encontrosAgenda = [
    { ...turma.encontrosAgenda[0], inicio: new Date("2026-09-30T22:00:00Z"), fim: new Date("2026-09-30T23:00:00Z") },
    { ...turma.encontrosAgenda[1], inicio: new Date("2026-10-30T22:00:00Z"), fim: new Date("2026-10-30T23:00:00Z") },
  ];
  await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base(turma)]) as never, entrada)).resolves.toMatchObject({ estado: "COMPROVADA_POR_AGENDA" });
});

it("rejeita instante como data civil antes de consultar vínculos", async () => {
  const banco = tx([base()]);
  await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(banco as never, { ...entrada, inicio: new Date("2026-10-01T01:00:00Z") })).rejects.toThrow();
  expect(banco.alocacaoTurma.findMany).not.toHaveBeenCalled();
});

it("aulas distantes fora do período não comprovam sozinhas oferta no intervalo", async () => {
  const turma = base().turma;
  turma.encontrosAgenda[0].inicio = new Date("2026-09-01T12:00:00Z");
  turma.encontrosAgenda[0].fim = new Date("2026-09-01T13:00:00Z");
  turma.encontrosAgenda[1].inicio = new Date("2026-12-01T12:00:00Z");
  turma.encontrosAgenda[1].fim = new Date("2026-12-01T13:00:00Z");
  expect(await carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base(turma)]) as never, entrada)).toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["AGENDA_INSUFICIENTE"] } });
});


it("não usa meia-noite como aula do último dia da cobertura", async () => {
  const turma = base().turma;
  turma.encontrosAgenda[1] = { ...turma.encontrosAgenda[1], inicio: new Date("2026-10-30T23:00:00Z"), fim: new Date("2026-10-31T00:00:00Z") };
  await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base(turma)]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["AGENDA_INSUFICIENTE"] } });
});

it("exige nova confirmação quando calendário vigente não é o publicado na grade", async () => {
  const banco = tx([base()], [], { id: "cal-novo", versao: 5 });
  await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(banco as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["CALENDARIO_DIVERGENTE"] } });
});

it("preserva mudança de horário mesmo quando a agenda continua insuficiente", async () => {
  const parcial = { ...base().turma.encontrosAgenda[0], inicio: new Date("2026-10-15T12:00:00Z"), fim: new Date("2026-10-15T13:00:00Z") };
  const anterior = await carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base({ encontrosAgenda: [parcial] })]) as never, entrada);
  const posterior = await carregarComprovacaoOfertaContinuidadeAgendaTx(tx([base({ encontrosAgenda: [{ ...parcial, inicio: new Date("2026-10-15T14:00:00Z"), fim: new Date("2026-10-15T15:00:00Z") }] })]) as never, entrada);
  expect(anterior.memoria.motivos).toEqual(["AGENDA_INSUFICIENTE"]);
  expect(posterior.memoria.motivos).toEqual(anterior.memoria.motivos);
  expect(posterior.memoria.contextoHash).not.toBe(anterior.memoria.contextoHash);
});

it("exige cobertura histórica integral mesmo quando a importação é posterior", async () => {
  const migrada = { ...base(), ativa: true, provenienciaVinculo: "MIGRACAO", criadoEm: new Date("2026-11-01T00:00:00Z"), inicioVigencia: new Date("2026-10-01T00:00:00Z"), fimVigencia: new Date("2026-11-01T00:00:00Z") };
  await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([migrada]) as never, entrada)).resolves.toMatchObject({ estado: "COMPROVADA_POR_AGENDA" });
  for (const mudanca of [{ inicioVigencia: new Date("2026-10-02T00:00:00Z") }, { fimVigencia: new Date("2026-10-31T00:00:00Z") }, { inicioVigencia: null }]) {
    await expect(carregarComprovacaoOfertaContinuidadeAgendaTx(tx([{ ...migrada, ...mudanca }]) as never, entrada)).resolves.toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["VINCULO_AUSENTE"] } });
  }
});
