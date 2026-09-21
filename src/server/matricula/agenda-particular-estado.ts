import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataCivilSchema } from "./cobertura";
import { instanteDaGrade } from "@/server/agenda/grade";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";

export const AgendaParticularSchema = z.object({
  ofertaId: z.string().min(1), versaoOferta: z.number().int().nonnegative(),
  professorId: z.string().min(1), fusoOrigem: FusoInstitucionalSchema,
  encontros: z.array(z.object({ data: DataCivilSchema,
    horario: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    duracaoMinutos: z.number().int().positive().max(1440),
  }).strict()).min(1).max(1000),
}).strict();

/** Interna. O chamador autoriza o acesso à oferta/contratação.
 * A leitura não reserva horários. O futuro executor deve revalidar na mesma
 * transação que persistir a reserva, usando o bloqueio compartilhado da agenda. */
export async function conferirAgendaParticularTx(tx: Prisma.TransactionClient, input: z.input<typeof AgendaParticularSchema>) {
  const d = AgendaParticularSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "ProdutoPais" WHERE id = ${d.ofertaId} FOR SHARE`;
  const oferta = await tx.produtoPais.findUnique({ where: { id: d.ofertaId }, include: { pais: { select: { status: true, moedaLocal: true } } } });
  if (!oferta?.oferecido || oferta.pais.status !== "ATIVO" || oferta.moeda !== oferta.pais.moedaLocal) throw new ErroRegra("Oferta indisponível ou moeda inconsistente.");
  if (oferta.versaoEntrada !== d.versaoOferta) throw new ErroRegra("A oferta mudou. Confira a forma de agenda novamente.");
  if (oferta.formaAgenda !== "PARTICULAR_GRADE_FIXA" && oferta.formaAgenda !== "PARTICULAR_FLEXIVEL") throw new ErroRegra("Configure a forma de agenda da particular antes de conferir horários.");
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const operacao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  if (!calendario || operacao?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("Confira o calendário aprovado e o fuso institucional antes da reserva.");
  const periodos = PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim }));
  const professor = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true } });
  const agora = new Date();
  const encontros = d.encontros.map((e, indice) => {
    let inicio: Date;
    try { inicio = instanteDaGrade(e.data, e.horario, d.fusoOrigem); }
    catch { throw new ErroRegra(`Confira o horário do encontro ${indice + 1}: horário inexistente ou ambíguo no fuso informado.`); }
    const fim = new Date(inicio.getTime() + e.duracaoMinutos * 60000);
    const calendarioEncontro = conferirDiasNaoLetivos({ inicio: inicio.toISOString(), fim: fim.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos });
    return { indice, ...e, inicio: inicio.toISOString(), fim: fim.toISOString(), periodosNaoLetivos: calendarioEncontro.periodosAfetados };
  });
  const inicio = new Date(Math.min(...encontros.map((e) => Date.parse(e.inicio))));
  const fim = new Date(Math.max(...encontros.map((e) => Date.parse(e.fim))));
  const existentes = await tx.encontroAgenda.findMany({ where: { professorId: d.professorId, status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: fim }, fim: { gt: inicio } },
    select: { id: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] });
  const ausencias = await tx.indisponibilidadeDocente.findMany({ where: { professorId: d.professorId, decisao: { aprovada: true }, inicio: { lt: fim }, fim: { gt: inicio } },
    select: { id: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] });
  const reservados = await tx.horarioReservaParticular.findMany({ where: { professorId: d.professorId, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, inicio: { lt: fim }, fim: { gt: inicio } }, select: { id: true, reservaId: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] });
  const sobrepoe = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(b.inicio) < Date.parse(a.fim);
  const conflitos = encontros.flatMap((e) => existentes.filter((outro) => sobrepoe(e, { inicio: outro.inicio.toISOString(), fim: outro.fim.toISOString() })).map((outro) => ({ indice: e.indice, encontroId: outro.id })));
  const indisponibilidades = encontros.flatMap((e) => ausencias.filter((outra) => sobrepoe(e, { inicio: outra.inicio.toISOString(), fim: outra.fim.toISOString() })).map((outra) => ({ indice: e.indice, indisponibilidadeId: outra.id })));
  const reservasConflitantes = encontros.flatMap((e) => reservados.filter((r) => sobrepoe(e, { inicio: r.inicio.toISOString(), fim: r.fim.toISOString() })).map((r) => ({ indice: e.indice, reservaId: r.reservaId, horarioId: r.id })));
  const conflitosInternos = encontros.flatMap((e, i) => encontros.slice(i + 1).filter((outro) => sobrepoe(e, outro)).map((outro) => ({ primeiro: e.indice, segundo: outro.indice })));
  const impedimentos: string[] = [];
  if (!professor?.ativo || !professor.papeis.includes("PROFESSOR")) impedimentos.push("PROFESSOR_INAPTO");
  if (encontros.some((e) => Date.parse(e.inicio) <= agora.getTime())) impedimentos.push("HORARIO_PASSADO");
  if (encontros.some((e) => e.periodosNaoLetivos.length)) impedimentos.push("EXCECAO_NAO_LETIVA_NECESSARIA");
  if (reservasConflitantes.length) impedimentos.push("HORARIO_RESERVADO");
  if (conflitos.length) impedimentos.push("CONFLITO_AGENDA");
  if (indisponibilidades.length) impedimentos.push("INDISPONIBILIDADE_DOCENTE");
  if (conflitosInternos.length) impedimentos.push("CONFLITO_ENTRE_HORARIOS_PROPOSTOS");
  const snapshot = { ofertaId: oferta.id, versaoOferta: oferta.versaoEntrada, formaAgenda: oferta.formaAgenda,
    professorId: d.professorId, professorApto: !!professor?.ativo && professor.papeis.includes("PROFESSOR"),
    calendarioId: calendario.id, calendarioVersao: calendario.versao, fusoEscola: calendario.fusoInstitucional,
    fusoOrigem: d.fusoOrigem, encontros, conflitos, reservasConflitantes, indisponibilidades, conflitosInternos, impedimentos };
  return { snapshot, estadoHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), conferidoEm: agora.toISOString(),
    reservaEfetuada: false as const, verificacoesPendentes: ["Conjunto de horários acordados no contrato", "Persistência e ciclo da reserva"] };
}
