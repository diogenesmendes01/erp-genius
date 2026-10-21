import { formatarAgendaParticular } from "./agenda-particular-texto";
import { resolverReservaParticularAtual } from "@/server/matricula/reserva-particular-cadeia";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";

/** Fontes da reserva histórica; não reclassifica o contrato pela oferta editada depois. */
export async function carregarAgendaParticularContratual(tx: Prisma.TransactionClient, matriculaId: string, reservaId: string) {
  const atualId = await resolverReservaParticularAtual(tx, reservaId);
  const r = await tx.reservaAgendaParticular.findFirst({ where: { id: atualId, matriculaId }, include: { horarios: { include: { professor: { select: { id: true, nome: true, ativo: true, papeis: true } } }, orderBy: [{ inicio: "asc" }, { id: "asc" }] } } });
  if (!r || !["ATIVA", "MANTIDA_PENDENCIA"].includes(r.status) || (r.status === "ATIVA" && r.expiraEm <= new Date())) throw new ErroRegra("Regularize a reserva particular antes da prévia contratual.");
  const base = z.object({ formaAgenda: z.enum(["PARTICULAR_GRADE_FIXA", "PARTICULAR_FLEXIVEL"]), professorId: z.string(), fusoOrigem: FusoInstitucionalSchema,
    encontros: z.array(z.object({ inicio: z.string().datetime(), fim: z.string().datetime() })).min(1) }).parse(r.snapshot);
  if (r.horarios.length !== base.encontros.length || r.horarios.some((h) => h.professorId !== base.professorId || h.fusoOrigem !== base.fusoOrigem || !base.encontros.some((e) => e.inicio === h.inicio.toISOString() && e.fim === h.fim.toISOString()))) throw new ErroRegra("Os horários divergem da reserva conferida.");
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  if (!calendario || calendario.fusoInstitucional !== config?.fusoInstitucional) throw new ErroRegra("Confira o calendário institucional da reserva.");
  const periodos = PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim }));
  if (r.horarios.some((h) => h.inicio <= new Date() || !h.professor.ativo || !h.professor.papeis.includes("PROFESSOR"))) throw new ErroRegra("Confira o professor e os horários futuros desta reserva.");
  if (r.horarios.some((h) => conferirDiasNaoLetivos({ inicio: h.inicio.toISOString(), fim: h.fim.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos }).periodosAfetados.length)) throw new ErroRegra("A reserva atinge período não letivo. Regularize a agenda ou sua exceção aprovada.");
  const intervalos = r.horarios.map((h) => ({ inicio: { lt: h.fim }, fim: { gt: h.inicio } }));
  if (await tx.indisponibilidadeDocente.count({ where: { professorId: base.professorId, decisao: { aprovada: true }, OR: intervalos } })) throw new ErroRegra("Professor com indisponibilidade aprovada. Resolva a reserva antes do contrato.");
  if (await tx.encontroAgenda.count({ where: { professorId: base.professorId, status: { in: ["PREVISTO", "MINISTRADO"] }, OR: intervalos } }) || await tx.horarioReservaParticular.count({ where: { professorId: base.professorId, reservaId: { not: r.id }, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, OR: intervalos } })) throw new ErroRegra("Há conflito nos horários particulares. Regularize antes do contrato.");
  const texto = formatarAgendaParticular({ formaAgenda: base.formaAgenda, fusoOrigem: base.fusoOrigem, horarios: r.horarios.map((h) => ({ inicio: h.inicio.toISOString(), fim: h.fim.toISOString(), professorNome: h.professor.nome })) });
  return { texto, snapshot: { reservaId: r.id, status: r.status, expiraEm: r.expiraEm.toISOString(), formaAgenda: base.formaAgenda, fusoOrigem: base.fusoOrigem,
    calendarioId: calendario.id, calendarioVersao: calendario.versao, horarios: r.horarios.map((h) => ({ id: h.id, professorId: h.professorId, professorNome: h.professor.nome, inicio: h.inicio.toISOString(), fim: h.fim.toISOString() })) } };
}
