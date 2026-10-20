import { describe, expect, it, vi } from "vitest";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { capturarFonteDisponibilidadeOfertaTx, conferirDisponibilidadeOfertaTx } from "./disponibilidade-oferta-tx";

const periodo = { matriculaId: "m1", inicio: new Date("2026-10-01T00:00:00.000Z"), fim: new Date("2026-10-31T00:00:00.000Z") };
const banco = (calendario: { id: string; versao: number } | null) => ({
  versaoCalendarioEscolar: { findFirst: vi.fn().mockResolvedValue(calendario) },
  impactoQuantidadeAulasModalidade: { findMany: vi.fn().mockResolvedValue([]) },
  registroIndisponibilidadeOfertaMatricula: { findMany: vi.fn().mockResolvedValue([]) },
  alocacaoTurma: { findMany: vi.fn().mockResolvedValue([]) },
  indisponibilidadeDocente: { findMany: vi.fn() },
});

describe("capturarFonteDisponibilidadeOfertaTx", () => {
  it("guarda o calendário vigente mesmo sem vínculo, para invalidar confirmação quando ele muda", async () => {
    const v2 = await capturarFonteDisponibilidadeOfertaTx(banco({ id: "cal-2", versao: 2 }) as never, periodo);
    const v3 = await capturarFonteDisponibilidadeOfertaTx(banco({ id: "cal-3", versao: 3 }) as never, periodo);
    expect(v2).toMatchObject({ agenda: { estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { motivos: ["VINCULO_AUSENTE"] } }, calendarioVigente: { id: "cal-2", versao: 2 } });
    expect(v3).toMatchObject({ calendarioVigente: { id: "cal-3", versao: 3 } });
    expect(v3).not.toEqual(v2);
  });
});

it("não consome confirmação antiga se mudar uma fonte ainda insuficiente", async () => {
  const alocacao = { id: "a", turmaId: "t", turma: { id: "t", status: "RASCUNHO", dataFim: null, propostasGrade: [], encontrosAgenda: [] } };
  const anterior = banco(null);
  anterior.alocacaoTurma.findMany.mockResolvedValue([alocacao]);
  const origem = await capturarFonteDisponibilidadeOfertaTx(anterior as never, periodo);
  const atual = banco(null);
  atual.alocacaoTurma.findMany.mockResolvedValue([{ ...alocacao, turma: { ...alocacao.turma, dataFim: new Date("2026-10-10T00:00:00Z") } }]);
  const completo = { ...atual, propostaDisponibilidadeOfertaMatricula: { findMany: vi.fn().mockResolvedValue([{ id: "proposta", matriculaId: "m1", inicio: periodo.inicio, fim: periodo.fim, versao: 1, origemHash: hashSubstituicao(origem), decisao: { aprovada: true, decididaEm: new Date("2026-09-01T00:00:00Z") } }]) } };
  expect(await conferirDisponibilidadeOfertaTx(completo as never, { matriculaId: "m1", inicio: "2026-10-01", fim: "2026-10-31" })).toMatchObject({ consumivel: false, aprovacao: null });
});
