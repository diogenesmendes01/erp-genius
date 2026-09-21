import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearContextoDiario } from "./locks";
import { carregarChamadaTx } from "./chamada-tx";
import { estadoDiario } from "./estado";
import { carregarAlunoParticularTx } from "./particular-contexto";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

/** Chamador adquire antes a trava institucional da agenda. */
export async function contextoConclusaoTx(tx: Prisma.TransactionClient, encontroId: string) {
  const inicial = await tx.encontroAgenda.findUnique({ where: { id: encontroId }, include: { diario: { include: { registros: true } } } });
  if (inicial?.finalidade !== "AULA") throw new ErroRegra("Recuperação não pode ser concluída como aula ministrada.");
  if (!inicial?.diario || (!inicial.turmaId && !inicial.matriculaId)) throw new ErroRegra("Registre o diário do encontro antes de solicitar conclusão.");
  if (inicial.turmaId) await bloquearContextoDiario(tx, inicial.turmaId, inicial.diario.registros.map((r) => r.alunoId));
  else await bloquearMatriculas(tx, [inicial.matriculaId!]);
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${encontroId} FOR UPDATE`;
  const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, include: { diario: { include: { registros: true } } } });
  if (!e.diario || e.turmaId !== inicial.turmaId || e.status !== "PREVISTO" || e.fim > new Date()) throw new ErroRegra("A conclusão exige encontro previsto já terminado e diário vinculado.");
  if (e.professorId !== e.diario.professorId) throw new ErroRegra("A autoria do diário precisa de regularização.");
  if (e.matriculaId !== inicial.matriculaId) throw new ErroRegra("O vínculo do encontro mudou.");
  const chamada = inicial.turmaId ? await carregarChamadaTx(tx, inicial.turmaId, e.inicio) : await carregarAlunoParticularTx(tx, inicial.matriculaId!, e.inicio);
  const ids = chamada.alunos.map((a) => a.alunoId).sort();
  const registrados = e.diario.registros.map((r) => r.alunoId).sort();
  if (chamada.exigeConferencia || !ids.length || JSON.stringify(ids) !== JSON.stringify(registrados)) throw new ErroRegra("Confira os vínculos e complete a chamada de todos os alunos antes de concluir.");
  if (!e.diario.conteudo.trim() || e.diario.registros.some((r) => r.presente === null)) throw new ErroRegra("Preencha conteúdo e todas as presenças antes de concluir.");
  if (e.matriculaId && e.diario.registros.some(r => r.presente !== true)) throw new ErroRegra("A falta na particular não comprova aula ministrada. A ocorrência cobrável deve seguir sua conferência própria.");
  return { encontroId: e.id, turmaId: e.turmaId, ...(e.matriculaId ? { matriculaId: e.matriculaId } : {}), professorId: e.professorId, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(),
    diarioId: e.diario.id, estadoDiario: estadoDiario(e.diario), alunos: ids };
}
