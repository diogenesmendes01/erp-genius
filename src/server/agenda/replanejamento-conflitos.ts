import type { Prisma } from "@prisma/client";
type EncontroProposto = { encontroId: string; turmaId: string; professorId: string | null; inicio: string; fim: string };

/** Horários antigos dos encontros remanejados são substituídos pelos propostos na conferência. */
export async function conferirConflitosReplanejamento(tx: Prisma.TransactionClient, propostos: EncontroProposto[]) {
 const ids = propostos.map((p) => p.encontroId);
 if (new Set(ids).size !== ids.length) throw new Error("Encontro repetido no conjunto proposto.");
 const intervalos = propostos.map((p) => ({ ...p, inicioMs: Date.parse(p.inicio), fimMs: Date.parse(p.fim) }));
 if (intervalos.some((p) => !Number.isFinite(p.inicioMs) || !Number.isFinite(p.fimMs) || p.fimMs <= p.inicioMs)) throw new Error("Intervalo inválido no conjunto proposto.");
 const professores = [...new Set(propostos.flatMap((p) => p.professorId ? [p.professorId] : []))];
 const turmas = [...new Set(propostos.map((p) => p.turmaId))];
 const inicio = new Date(Math.min(...intervalos.map((p) => p.inicioMs))), fim = new Date(Math.max(...intervalos.map((p) => p.fimMs)));
 const existentes = intervalos.length ? await tx.encontroAgenda.findMany({ where: { id: { notIn: ids }, status: { in: ["PREVISTO", "MINISTRADO"] },
   OR: [{ professorId: { in: professores } }, { turmaId: { in: turmas } }], inicio: { lt: fim }, fim: { gt: inicio } },
   select: { id: true, professorId: true, turmaId: true, inicio: true, fim: true }, orderBy: { id: "asc" } }) : [];
 const ausencias = professores.length ? await tx.indisponibilidadeDocente.findMany({ where: { professorId: { in: professores }, decisao: { aprovada: true }, inicio: { lt: fim }, fim: { gt: inicio } },
   select: { id: true, professorId: true, inicio: true, fim: true }, orderBy: { id: "asc" } }) : [];
 const aptos = professores.length ? await tx.usuario.findMany({ where: { id: { in: professores }, ativo: true, papeis: { has: "PROFESSOR" } }, select: { id: true } }) : [];
 const recurso = (a: EncontroProposto, b: { professorId: string | null; turmaId: string | null }) => a.turmaId === b.turmaId || (!!a.professorId && a.professorId === b.professorId);
 const internos: { primeiro: string; segundo: string }[] = [];
 for (let i = 0; i < intervalos.length; i++) for (let j = i + 1; j < intervalos.length; j++) {
  const a = intervalos[i], b = intervalos[j];
  if (recurso(a,b) && a.inicioMs < b.fimMs && b.inicioMs < a.fimMs) internos.push({ primeiro: a.encontroId, segundo: b.encontroId });
 }
 return {
  internos,
  externos: intervalos.flatMap((p) => existentes.filter((e) => recurso(p,e) && p.inicioMs < e.fim.getTime() && e.inicio.getTime() < p.fimMs)
    .map((e) => ({ encontroPropostoId: p.encontroId, encontroExistenteId: e.id }))),
  indisponibilidades: intervalos.flatMap((p) => ausencias.filter((a) => a.professorId === p.professorId && p.inicioMs < a.fim.getTime() && a.inicio.getTime() < p.fimMs)
    .map((a) => ({ encontroId: p.encontroId, indisponibilidadeId: a.id }))),
  semDocenteApto: intervalos.filter((p) => !aptos.some((a) => a.id === p.professorId)).map((p) => p.encontroId),
  reservasConferidas: false as const,
 };
}
