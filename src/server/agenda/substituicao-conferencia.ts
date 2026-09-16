import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** A futura aplicação deve repetir esta leitura sob os bloqueios de escrita da agenda. */
export async function conferirSubstituicaoTx(tx: Prisma.TransactionClient, propostaId: string) {
  const p = await tx.propostaSubstituicaoDocente.findUnique({ where: { id: propostaId }, include: {
    decisao: true, substituto: { select: { ativo: true, papeis: true } }, itens: { include: { encontro: true }, orderBy: { encontroId: "asc" } },
  } });
  if (!p) throw new ErroRegra("Proposta de substituição não encontrada.");
  const pendencias: string[] = [];
  if (!p.substituto.ativo || !p.substituto.papeis.includes("PROFESSOR")) pendencias.push("O substituto precisa ser um professor ativo.");
  if (!p.itens.length) pendencias.push("A proposta não identifica encontros.");
  const agora = new Date();
  const itens = p.itens.map((i) => {
    const e = i.encontro;
    const atual = { professorId: e.professorId, turmaId: e.turmaId, matriculaId: e.matriculaId,
      inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem, status: e.status };
    return { encontroId: e.id, snapshot: i.snapshot, atual, alterado: !isDeepStrictEqual(i.snapshot, atual), iniciado: e.inicio <= agora };
  });
  if (itens.some((i) => i.alterado)) pendencias.push("Encontros alterados após a preparação; revise a proposta.");
  if (itens.some((i) => i.iniciado || i.atual.status !== "PREVISTO")) pendencias.push("Há encontros iniciados ou que não estão previstos.");
  if (itens.some((i) => i.atual.professorId === p.substitutoId)) pendencias.push("O substituto já está designado em um dos encontros.");
  const periodos = p.itens.map((i) => ({ inicio: { lt: i.encontro.fim }, fim: { gt: i.encontro.inicio } }));
  const concorrentes = periodos.length ? await tx.encontroAgenda.findMany({ where: {
    professorId: p.substitutoId, id: { notIn: itens.map((i) => i.encontroId) }, status: { in: ["PREVISTO", "MINISTRADO"] }, OR: periodos,
  }, select: { id: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] }) : [];
  const ausencias = periodos.length ? await tx.indisponibilidadeDocente.findMany({ where: { professorId: p.substitutoId, decisao: { aprovada: true }, OR: periodos },
    select: { id: true, inicio: true, fim: true }, orderBy: [{ inicio: "asc" }, { id: "asc" }] }) : [];
  const reservas = periodos.length ? await tx.horarioReservaParticular.findMany({ where: { professorId: p.substitutoId, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, OR: periodos }, select: { id: true, reservaId: true } }) : [];
  if (reservas.length) pendencias.push("O substituto possui horários particulares reservados no período.");
  const conflitos = p.itens.flatMap((i) => concorrentes.filter((c) => i.encontro.inicio < c.fim && c.inicio < i.encontro.fim)
    .map((c) => ({ encontroId: i.encontroId, concorrenteId: c.id, inicio: c.inicio.toISOString(), fim: c.fim.toISOString() })));
  const indisponibilidades = p.itens.flatMap((i) => ausencias.filter((a) => i.encontro.inicio < a.fim && a.inicio < i.encontro.fim)
    .map((a) => ({ encontroId: i.encontroId, indisponibilidadeId: a.id, inicio: a.inicio.toISOString(), fim: a.fim.toISOString() })));
  const conflitosInternos: { primeiroId: string; segundoId: string }[] = [];
  for (let i = 0; i < p.itens.length; i++) for (let j = i + 1; j < p.itens.length; j++) {
    const a = p.itens[i].encontro, b = p.itens[j].encontro;
    if (a.inicio < b.fim && b.inicio < a.fim) conflitosInternos.push({ primeiroId: a.id, segundoId: b.id });
  }
  if (conflitos.length || conflitosInternos.length) pendencias.push("O substituto possui encontros sobrepostos.");
  if (indisponibilidades.length) pendencias.push("O substituto possui indisponibilidade aprovada no período.");
  return { propostaId: p.id, preparadorId: p.preparadorId, substitutoId: p.substitutoId, motivo: p.motivo, itens, pendencias, reservas, conflitos, conflitosInternos, indisponibilidades,
    decisao: p.decisao ? { aprovada: p.decisao.aprovada, decisorId: p.decisao.decisorId, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null,
    aplicacaoAutorizada: false as const, verificacoesPendentes: ["Aprovação independente e aplicação transacional", "Atribuição de acesso limitada aos encontros"] };
}
