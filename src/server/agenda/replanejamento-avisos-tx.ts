import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { criarAvisosAlteracaoAgendaTx } from "@/server/comunicacoes-agenda/avisos";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";

const HorarioSchema = z.object({ encontroId: z.string().min(1), inicioAnterior: z.string().datetime(), fimAnterior: z.string().datetime(), inicioProposto: z.string().datetime(), fimProposto: z.string().datetime() }).strict();
const EventoSchema = z.object({ aprovada: z.literal(true), revisaoId: z.string().min(1), decisaoId: z.string().min(1), encontrosIds: z.array(z.string().min(1)).min(1), horarios: z.array(HorarioSchema).min(1) }).passthrough();
type Horario = z.infer<typeof HorarioSchema>;
type Encontro = { id: string; turmaId: string | null; matriculaId: string | null; inicio: Date; fim: Date };
type Alocacao = { matriculaId: string | null; turmaId: string; criadoEm: Date; encerradaEm: Date | null };
export type AvisoReplanejamento = { matriculaId: string; encontrosIds: string[]; origem: "HORARIO_ORIGINAL" | "HORARIO_PROPOSTO" | "AMBOS" };

const cobre = (alocacao: Alocacao, instante: string) => alocacao.criadoEm <= new Date(instante) && (!alocacao.encerradaEm || alocacao.encerradaEm > new Date(instante));

/** A mudança alcança quem estava alocado no horário que existia OU no proposto.
 * A origem é derivada da fotografia canônica e mantém a razão da projeção. */
export function agruparAvisosReplanejamento(horarios: readonly Horario[], encontros: readonly Encontro[], alocacoes: readonly Alocacao[]): AvisoReplanejamento[] {
  const porEncontro = new Map(encontros.map((encontro) => [encontro.id, encontro]));
  const grupos = new Map<string, { encontrosIds: Set<string>; original: boolean; proposto: boolean }>();
  for (const horario of horarios) {
    const encontro = porEncontro.get(horario.encontroId);
    if (!encontro?.turmaId || encontro.matriculaId) continue;
    for (const alocacao of alocacoes) {
      if (!alocacao.matriculaId || alocacao.turmaId !== encontro.turmaId) continue;
      const original = cobre(alocacao, horario.inicioAnterior), proposto = cobre(alocacao, horario.inicioProposto);
      if (!original && !proposto) continue;
      const grupo = grupos.get(alocacao.matriculaId) ?? { encontrosIds: new Set<string>(), original: false, proposto: false };
      grupo.encontrosIds.add(encontro.id); grupo.original ||= original; grupo.proposto ||= proposto; grupos.set(alocacao.matriculaId, grupo);
    }
  }
  return [...grupos.entries()].map(([matriculaId, grupo]): AvisoReplanejamento => ({ matriculaId, encontrosIds: [...grupo.encontrosIds].sort(), origem: grupo.original && grupo.proposto ? "AMBOS" : grupo.original ? "HORARIO_ORIGINAL" : "HORARIO_PROPOSTO" })).sort((a, b) => a.matriculaId.localeCompare(b.matriculaId));
}

/** Cria apenas intenções PREPARADO no mesmo TX da aplicação; canais, consentimento e
 * transporte são revalidados pelo helper N01 após o commit. */
export async function criarAvisosReplanejamentoConjuntoTx(tx: Prisma.TransactionClient, entrada: { eventoId: string; rascunhoId: string }) {
  const evento = await tx.evento.findUnique({ where: { id: entrada.eventoId }, select: { agregadoTipo: true, agregadoId: true, tipo: true, payload: true } });
  const payload = EventoSchema.safeParse(evento?.payload);
  if (!evento || evento.agregadoTipo !== "ConfiguracaoOperacional" || evento.agregadoId !== "escola" || evento.tipo !== "ReplanejamentoConjuntoAplicado" || !payload.success || payload.data.revisaoId !== entrada.rascunhoId) throw new ErroRegra("Evento de replanejamento não é fonte canônica de avisos.");
  if (new Set(payload.data.encontrosIds).size !== payload.data.encontrosIds.length || new Set(payload.data.horarios.map((h) => h.encontroId)).size !== payload.data.horarios.length || payload.data.encontrosIds.length !== payload.data.horarios.length || !payload.data.horarios.every((h) => payload.data.encontrosIds.includes(h.encontroId))) throw new ErroRegra("Evento de replanejamento possui encontros duplicados ou incompletos.");
  const rascunho = await tx.rascunhoReplanejamento.findUnique({ where: { id: entrada.rascunhoId }, include: { decisaoConjunta: { include: { aplicacao: true } } } });
  if (!rascunho?.decisaoConjunta?.aprovada || !rascunho.decisaoConjunta.aplicacao || rascunho.decisaoConjunta.id !== payload.data.decisaoId) throw new ErroRegra("Decisão aplicada não corresponde ao evento de replanejamento.");
  const snapshot = ReplanejamentoSnapshotSchema.safeParse(rascunho.snapshot);
  const propostas = snapshot.success ? snapshot.data.revisoes.flatMap((revisao) => revisao.previsao?.propostas.filter((proposta) => proposta.alterado) ?? []) : [];
  if (!snapshot.success || propostas.length !== payload.data.horarios.length || !payload.data.horarios.every((horario) => propostas.some((proposta) => proposta.encontroId === horario.encontroId && proposta.inicioAnterior === horario.inicioAnterior && proposta.fimAnterior === horario.fimAnterior && proposta.inicioProposto === horario.inicioProposto && proposta.fimProposto === horario.fimProposto))) throw new ErroRegra("Fotografia da revisão não corresponde aos horários do evento.");
  const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: payload.data.encontrosIds } }, select: { id: true, turmaId: true, matriculaId: true, inicio: true, fim: true } });
  if (encontros.length !== payload.data.encontrosIds.length || !payload.data.horarios.every((h) => encontros.some((e) => e.id === h.encontroId && e.inicio.toISOString() === h.inicioProposto && e.fim.toISOString() === h.fimProposto))) throw new ErroRegra("Agenda atual não corresponde aos horários aplicados.");
  const turmasIds = [...new Set(encontros.flatMap((e) => e.turmaId ? [e.turmaId] : []))];
  const alocacoes = turmasIds.length ? await tx.alocacaoTurma.findMany({ where: { turmaId: { in: turmasIds } }, select: { matriculaId: true, turmaId: true, criadoEm: true, encerradaEm: true } }) : [];
  const grupos = agruparAvisosReplanejamento(payload.data.horarios, encontros, alocacoes);
  for (const grupo of grupos) await criarAvisosAlteracaoAgendaTx(tx, { eventoId: entrada.eventoId, matriculaId: grupo.matriculaId, encontrosIds: grupo.encontrosIds });
  return grupos;
}
