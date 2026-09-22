import { describe, expect, it, vi } from "vitest";
import { carregarOfertasAgendaDestinoTx } from "./destino-agenda";

const h = "h".repeat(64), q = "q".repeat(64), agora = new Date("2026-10-05T00:00:00Z");
const professor = { ativo: true, papeis: ["PROFESSOR"] };
const aula = (id: string, dia: string, status = "PREVISTO") => ({ id, turmaId: "turma", propostaGradeId: "grade", inicio: new Date(`${dia}T12:00:00Z`), fim: new Date(`${dia}T13:00:00Z`), status, professorId: "p1", professor });
const iso = (e: ReturnType<typeof aula>) => ({ id: e.id as string | null, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status });
// A aula passada não foi realizada: só a agenda futura participa da conferência do destino.
const passada = aula("a0", "2026-10-01", "NAO_REALIZADO"), futura = aula("a1", "2026-10-08"), nova = aula("a2", "2026-10-15");
const revisao = { id: "rascunho", estadoHash: h, decisaoConjunta: { id: "decisao", aprovada: true, estadoHash: h }, aplicacaoConjunta: { id: "aplicacao", estadoHash: h, aplicadaEm: new Date("2026-09-21T00:00:00Z") },
  snapshot: { calendarioId: "cal-novo", conferidoEm: "2026-09-20T12:00:00.000Z", pendencias: [], recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
    revisoes: [{ turmaId: "turma", codigo: "T-1", fusoOrigem: "UTC", pendencias: [], previsao: { previsaoTermino: "2026-10-08T13:00:00.000Z",
      preservados: [], propostas: [passada, futura].map((e) => ({ encontroId: e.id, inicioAnterior: e.inicio.toISOString(), fimAnterior: e.fim.toISOString(), inicioProposto: e.inicio.toISOString(), fimProposto: e.fim.toISOString(), alterado: false })) } }] } };
const impacto = (ajustes: Record<string, unknown> = {}) => ({ turmaId: "turma",
  snapshot: { agendaAntes: [{ ...iso(passada), status: "PREVISTO" }, iso(futura)], agendaDepois: [{ ...iso(passada), status: "PREVISTO" }, iso(futura), { ...iso(nova), id: null }] },
  proposta: { id: "quantidade", estadoHash: q, decisao: { id: "decisao-q", aprovada: true, estadoHash: q }, aplicacao: { id: "aplicacao-q", estadoHash: q, aplicadaEm: new Date("2026-09-25T00:00:00Z") }, ...ajustes } });
const tx = (encontros: unknown[], impactos: unknown[]) => ({
  versaoCalendarioEscolar: { findFirst: vi.fn().mockResolvedValue({ id: "cal-novo", versao: 2 }) },
  propostaGradeTurma: { findMany: vi.fn().mockResolvedValue([{ id: "grade", turmaId: "turma", versao: 1, calendarioId: "cal-antigo", calendario: { versao: 1 } }]) },
  rascunhoReplanejamento: { findMany: vi.fn().mockResolvedValue([revisao]) },
  impactoQuantidadeAulasModalidade: { findMany: vi.fn().mockResolvedValue(impactos) },
  encontroAgenda: { findMany: vi.fn().mockResolvedValue(encontros) },
  indisponibilidadeDocente: { findMany: vi.fn().mockResolvedValue([]) },
});
const oferta = async (encontros: unknown[], impactos: unknown[] = []) => (await carregarOfertasAgendaDestinoTx(tx(encontros, impactos) as never, ["turma"], agora)).get("turma");

describe("carregarOfertasAgendaDestinoTx após replanejamento", () => {
  it("mantém a cadeia direta quando a agenda futura é a replanejada", async () => {
    const r = await oferta([passada, futura]);
    expect(r).toMatchObject({ disponivel: true, fotografia: { cadeiaCalendario: { tipo: "REPLANEJAMENTO_APLICADO", rascunhoId: "rascunho" } } });
    expect(r!.fotografia!.cadeiaCalendario).not.toHaveProperty("alteracoesQuantidade");
  });

  it("torna a turma elegível quando uma alteração de quantidade aplicada explica a agenda futura", async () => {
    expect(await oferta([passada, futura, nova])).toEqual({ disponivel: false, fotografia: null });
    expect(await oferta([passada, futura, nova], [impacto()])).toMatchObject({ disponivel: true, fotografia: { cadeiaCalendario: {
      tipo: "REPLANEJAMENTO_APLICADO", alteracoesQuantidade: [{ propostaId: "quantidade", decisaoId: "decisao-q", aplicacaoId: "aplicacao-q", estadoHash: q }] } } });
  });

  it("continua indisponível com alteração não aplicada ou encontro futuro sem explicação", async () => {
    expect(await oferta([passada, futura, nova], [impacto({ aplicacao: null })])).toEqual({ disponivel: false, fotografia: null });
    expect(await oferta([passada, futura, nova, aula("intruso", "2026-10-22")], [impacto()])).toEqual({ disponivel: false, fotografia: null });
  });
});
