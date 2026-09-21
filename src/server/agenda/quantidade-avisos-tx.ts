import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { criarAvisosAlteracaoAgendaTx } from "@/server/comunicacoes-agenda/avisos";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";
import { validarFonteQuantidadeAulasTx } from "./quantidade-fonte";

type Agenda = { id: string | null; inicio: string };
const instantesAfetados = (antes: Agenda[], depois: Agenda[], ids: Set<string>) => {
  const porIdAntes = new Map(antes.flatMap((e) => e.id ? [[e.id, e] as const] : []));
  const porIdDepois = new Map(depois.flatMap((e) => e.id ? [[e.id, e] as const] : []));
  return [...ids].flatMap((id) => [porIdAntes.get(id), porIdDepois.get(id)].filter((e): e is Agenda => e !== undefined)).map((e) => new Date(e.inicio));
};

/** Agrupa somente encontros efetivamente mudados, para alocações vigentes antes ou depois da alteração. */
export async function criarAvisosQuantidadeAulasTx(tx: Prisma.TransactionClient, entrada: { eventoId: string; propostaId: string }) {
  const fonte = await validarFonteQuantidadeAulasTx(tx, { eventoId: entrada.eventoId });
  if (!fonte || fonte.proposta.id !== entrada.propostaId) throw new ErroRegra("Evento de quantidade não é fonte canônica de avisos.");
  const grupos = new Map<string, Set<string>>();
  const impactos = await tx.impactoQuantidadeAulasModalidade.findMany({ where: { propostaId: entrada.propostaId, publicada: true }, select: { turmaId: true, snapshot: true } });
  for (const impacto of impactos) {
    const ids = fonte.porTurma.get(impacto.turmaId);
    if (!ids?.size) continue;
    const foto = impacto.snapshot as { agendaAntes?: Agenda[]; agendaDepois?: Agenda[] };
    if (!Array.isArray(foto.agendaAntes) || !Array.isArray(foto.agendaDepois)) throw new ErroRegra("Impacto de quantidade sem fotografia de agenda válida.");
    const atuais = await tx.encontroAgenda.findMany({ where: { id: { in: [...ids] }, turmaId: impacto.turmaId }, select: { id: true, inicio: true } });
    if (atuais.length !== ids.size) throw new ErroRegra("Encontro aplicado diverge da fonte canônica.");
    const instantes = [...instantesAfetados(foto.agendaAntes, foto.agendaDepois, ids), ...atuais.map((e) => e.inicio)];
    const alocacoes = await tx.alocacaoTurma.findMany({ where: { turmaId: impacto.turmaId, matriculaId: { not: null } }, select: { matriculaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } });
    for (const alocacao of alocacoes) if (alocacao.matriculaId) for (const atual of atuais) {
      const instantesDoEncontro = [...instantesAfetados(foto.agendaAntes, foto.agendaDepois, new Set([atual.id])), atual.inicio];
      if (instantesDoEncontro.some((inicio) => alocacaoCobreAula(alocacao, inicio))) { const grupo = grupos.get(alocacao.matriculaId) ?? new Set<string>(); grupo.add(atual.id); grupos.set(alocacao.matriculaId, grupo); }
    }
  }
  for (const [matriculaId, encontros] of grupos) await criarAvisosAlteracaoAgendaTx(tx, { eventoId: entrada.eventoId, matriculaId, encontrosIds: [...encontros].sort() });
  return [...grupos.entries()].map(([matriculaId, encontros]) => ({ matriculaId, encontrosIds: [...encontros].sort() }));
}
