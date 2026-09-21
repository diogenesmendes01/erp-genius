import { describe, expect, it, vi } from "vitest";
import { carregarComprovacaoOfertaContinuidadeAgendaTx } from "./oferta-continuidade-agenda-tx";

const professor = { ativo: true, papeis: ["PROFESSOR"] };
const aula = (id: string, dia: string, grade: string, status = "PREVISTO") => ({ id, inicio: new Date(`${dia}T12:00:00Z`), fim: new Date(`${dia}T13:00:00Z`), status, finalidade: "AULA", matriculaId: null, propostaGradeId: grade, professorId: "p1", professor });
const turma = (id: string, grade: string, aulas: ReturnType<typeof aula>[]) => ({ id, status: "EM_ANDAMENTO", dataFim: null,
  propostasGrade: [{ id: grade, versao: 1, calendarioId: "cal", calendario: { versao: 4, fusoInstitucional: "UTC" } }], encontrosAgenda: aulas });
const executadaEm = new Date("2026-10-15T14:00:00Z");
const origem = (ajustes: Record<string, unknown> = {}) => ({ id: "aloc-antiga", turmaId: "t1", ativa: false, criadoEm: new Date("2026-01-01T12:00:00Z"), encerradaEm: executadaEm, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null,
  turma: turma("t1", "g1", [aula("a1", "2026-09-30", "g1", "MINISTRADO"), aula("a2", "2026-10-07", "g1", "MINISTRADO"), aula("a3", "2026-10-14", "g1", "MINISTRADO")]), ...ajustes });
const destino = (ajustes: Record<string, unknown> = {}) => ({ id: "aloc-nova", turmaId: "t2", ativa: true, criadoEm: executadaEm, encerradaEm: null, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null,
  turma: turma("t2", "g2", [aula("b1", "2026-10-16", "g2"), aula("b2", "2026-10-23", "g2"), aula("b3", "2026-11-02", "g2")]), ...ajustes });
const mudanca = (ajustes: Record<string, unknown> = {}) => ({ id: "mudanca", solicitanteId: "secretaria", aprovadorId: "gestora", executadoEm: executadaEm, alocacaoOrigem: origem(), ...ajustes });
const periodo = { matriculaId: "m", inicio: new Date("2026-10-01T00:00:00Z"), fim: new Date("2026-10-31T00:00:00Z") };

function tx(opcoes: { tardias?: unknown[]; mudancas?: unknown[] } = {}) {
  const findMany = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(opcoes.tardias ?? [destino()]);
  return { alocacaoTurma: { findMany }, solicitacaoMudancaAcademica: { findMany: vi.fn().mockResolvedValue(opcoes.mudancas ?? [mudanca()]) },
    indisponibilidadeDocente: { findMany: vi.fn().mockResolvedValue([]) }, versaoCalendarioEscolar: { findFirst: vi.fn().mockResolvedValue({ id: "cal", versao: 4 }) },
    impactoQuantidadeAulasModalidade: { findMany: vi.fn().mockResolvedValue([]) } };
}
const comprovar = (opcoes?: Parameters<typeof tx>[0]) => carregarComprovacaoOfertaContinuidadeAgendaTx(tx(opcoes) as never, periodo);

describe("Q161 — transferência aprovada no meio do ciclo", () => {
  it("comprova o período com a turma antiga até a transferência e a nova a partir dela", async () => {
    const r = await comprovar();
    expect(r).toMatchObject({ estado: "COMPROVADA_POR_AGENDA", memoria: { transferencia: { solicitacaoId: "mudanca" },
      fontes: [{ alocacaoId: "aloc-antiga", turmaId: "t1" }, { alocacaoId: "aloc-nova", turmaId: "t2" }] } });
  });

  it.each([
    ["sem transferência registrada", { mudancas: [] }, "VINCULO_AUSENTE"],
    ["autoaprovada", { mudancas: [mudanca({ aprovadorId: "secretaria" })] }, "VINCULO_AUSENTE"],
    ["com lacuna entre as alocações", { mudancas: [mudanca({ alocacaoOrigem: origem({ encerradaEm: new Date("2026-10-10T14:00:00Z") }) })] }, "VINCULO_AUSENTE"],
    ["origem criada depois do início da cobertura", { mudancas: [mudanca({ alocacaoOrigem: origem({ criadoEm: new Date("2026-10-05T12:00:00Z") }) })] }, "VINCULO_AUSENTE"],
    ["duas transferências candidatas", { mudancas: [mudanca(), mudanca({ id: "outra" })] }, "VINCULO_AUSENTE"],
    ["turma antiga sem aula no trecho", { mudancas: [mudanca({ alocacaoOrigem: origem({ turma: turma("t1", "g1", [aula("a1", "2026-09-30", "g1", "MINISTRADO")]) }) })] }, "AGENDA_INSUFICIENTE"],
    ["aula cancelada na turma nova", { tardias: [destino({ turma: turma("t2", "g2", [aula("b1", "2026-10-16", "g2", "CANCELADO"), aula("b3", "2026-11-02", "g2")]) })] }, "AULA_EXCEPCIONAL_NO_PERIODO"],
    ["turma nova sem alcançar o fim do período", { tardias: [destino({ turma: turma("t2", "g2", [aula("b1", "2026-10-16", "g2")]) })] }, "AGENDA_INSUFICIENTE"],
  ])("exige confirmação da gestão: %s", async (_nome, opcoes, motivo) => {
    expect(await comprovar(opcoes)).toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: [motivo], fontes: [] } });
  });

  it("a transferência entra no hash de contexto", async () => {
    const com = await comprovar(), outra = await comprovar({ mudancas: [mudanca({ id: "mudanca-2" })] });
    expect(com.memoria.contextoHash).not.toBe(outra.memoria.contextoHash);
  });
});
