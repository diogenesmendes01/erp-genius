import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ReplanejamentoSnapshotSchema } from "@/server/agenda/replanejamento-snapshot";

const Horario = z.object({ encontroId: z.string().min(1), inicioAnterior: z.string().datetime(), fimAnterior: z.string().datetime(), inicioProposto: z.string().datetime(), fimProposto: z.string().datetime() }).strict();
const Payload = z.object({ aprovada: z.literal(true), revisaoId: z.string().min(1), decisaoId: z.string().min(1), encontrosIds: z.array(z.string().min(1)).min(1), horarios: z.array(Horario).min(1) }).passthrough();
export type HorarioReplanejamento = z.infer<typeof Horario> & { fusoOrigem: string };

const cobre = (criadoEm: Date, encerradaEm: Date | null, instante: string) => criadoEm <= new Date(instante) && (!encerradaEm || encerradaEm > new Date(instante));

/** Fonte restrita a uma matrícula: não devolve nem renderiza encontros de outras
 * turmas. O vínculo histórico vale no horário original OU no proposto. */
export async function validarFonteReplanejamentoConjuntoTx(tx: Prisma.TransactionClient, entrada: { eventoId: string; matriculaId: string; encontrosIds: string[] }) {
  const evento = await tx.evento.findUnique({ where: { id: entrada.eventoId }, select: { tipo: true, agregadoTipo: true, agregadoId: true, payload: true } });
  const payload = Payload.safeParse(evento?.payload);
  if (!evento || evento.tipo !== "ReplanejamentoConjuntoAplicado" || evento.agregadoTipo !== "ConfiguracaoOperacional" || evento.agregadoId !== "escola" || !payload.success || new Set(payload.data.encontrosIds).size !== payload.data.encontrosIds.length || new Set(payload.data.horarios.map(h => h.encontroId)).size !== payload.data.horarios.length || payload.data.encontrosIds.length !== payload.data.horarios.length || !payload.data.horarios.every(h => payload.data.encontrosIds.includes(h.encontroId))) return null;
  const rascunho = await tx.rascunhoReplanejamento.findUnique({ where: { id: payload.data.revisaoId }, include: { decisaoConjunta: { include: { aplicacao: true } } } });
  const snapshot = ReplanejamentoSnapshotSchema.safeParse(rascunho?.snapshot);
  if (!rascunho || !snapshot.success || !rascunho.decisaoConjunta?.aprovada || !rascunho.decisaoConjunta.aplicacao || rascunho.decisaoConjunta.id !== payload.data.decisaoId) return null;
  const propostas = snapshot.data.revisoes.flatMap((r) => r.previsao?.propostas.filter((p) => p.alterado) ?? []);
  if (propostas.length !== payload.data.horarios.length || !payload.data.horarios.every((h) => propostas.some((p) => p.encontroId === h.encontroId && p.inicioAnterior === h.inicioAnterior && p.fimAnterior === h.fimAnterior && p.inicioProposto === h.inicioProposto && p.fimProposto === h.fimProposto))) return null;
  const solicitados = [...new Set(entrada.encontrosIds)];
  if (!solicitados.length || solicitados.some((id) => !payload.data.encontrosIds.includes(id))) return null;
  const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: solicitados }, matriculaId: null }, select: { id: true, turmaId: true, inicio: true, fim: true, fusoOrigem: true } });
  if (encontros.length !== solicitados.length) return null;
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { matriculaId: entrada.matriculaId, turmaId: { in: encontros.flatMap((e) => e.turmaId ? [e.turmaId] : []) } }, select: { turmaId: true, criadoEm: true, encerradaEm: true } });
  const horarios: (HorarioReplanejamento & { origem: "HORARIO_ORIGINAL" | "HORARIO_PROPOSTO" | "AMBOS" })[] = [];
  for (const encontro of encontros) {
    const h = payload.data.horarios.find((x) => x.encontroId === encontro.id);
    if (!h || !encontro.turmaId || encontro.inicio.toISOString() !== h.inicioProposto || encontro.fim.toISOString() !== h.fimProposto) return null;
    const original = alocacoes.some((a) => a.turmaId === encontro.turmaId && cobre(a.criadoEm, a.encerradaEm, h.inicioAnterior));
    const proposto = alocacoes.some((a) => a.turmaId === encontro.turmaId && cobre(a.criadoEm, a.encerradaEm, h.inicioProposto));
    if (!original && !proposto) return null;
    horarios.push({ ...h, fusoOrigem: encontro.fusoOrigem, origem: original && proposto ? "AMBOS" : original ? "HORARIO_ORIGINAL" : "HORARIO_PROPOSTO" });
  }
  const ordenados = horarios.sort((a, b) => a.encontroId.localeCompare(b.encontroId));
  return { horarios: ordenados.map(({ origem: _origem, ...h }) => h), origemPorEncontro: Object.fromEntries(ordenados.map((h) => [h.encontroId, h.origem])) };
}

export function renderizarHorariosReplanejamento(horarios: readonly HorarioReplanejamento[]) {
  if (!horarios.length) return null;
  const f = (v: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(v));
  return horarios.map((h) => `de ${f(h.inicioAnterior,h.fusoOrigem)}–${f(h.fimAnterior,h.fusoOrigem)} para ${f(h.inicioProposto,h.fusoOrigem)}–${f(h.fimProposto,h.fusoOrigem)} (${h.fusoOrigem})`).join("; ");
}
