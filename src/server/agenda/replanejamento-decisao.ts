"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, executarAcao, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { AjustesReplanejamentoSchema } from "./replanejamento-ajustes";
import { estadoReplanejamento } from "./replanejamento-estado";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";
import { carregarReplanejamentoTx } from "./replanejamento-tx";
import { criarAvisosReplanejamentoConjuntoTx } from "./replanejamento-avisos-tx";

const Entrada = z.object({ calendarioId: z.string().min(1), revisaoId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000), excecoesAutorizadas: z.array(z.string().min(1)).max(1000).default([]) }).strict();
const autorizacoesCanonicas = (ids: readonly string[]) => [...new Set(ids)].sort();

/** Decide uma revisão inteira. A aprovação publica a versão do calendário e move
 * somente encontros PREVISTO futuros da própria revisão na mesma transação. */
export async function decidirEAplicarReplanejamentoConjunto(input: z.input<typeof Entrada>) {
 return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
  const d = Entrada.parse(input);
  return prisma.$transaction(async (tx) => {
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
   const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
   if (!usuario?.ativo || !usuario.papeis.some((p) => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
   const r = await tx.rascunhoReplanejamento.findFirst({ where: { id: d.revisaoId, calendarioId: d.calendarioId }, include: { calendario: { include: { decisao: true } }, decisaoConjunta: { include: { aplicacao: true } } } });
   if (!r) throw new ErroRegra("Revisão não encontrada neste calendário.");
   if (r.preparadorId === autor.id || r.calendario.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir: quem preparou o calendário ou a revisão não pode aprovar o conjunto.");
   const autorizacoes = autorizacoesCanonicas(d.excecoesAutorizadas);
   if (r.decisaoConjunta) {
    const anteriores = z.array(z.string()).safeParse(r.decisaoConjunta.excecoesAutorizadas);
    if (r.decisaoConjunta.decisorId === autor.id && r.decisaoConjunta.aprovada === d.aprovar && r.decisaoConjunta.motivo === d.motivo && anteriores.success && JSON.stringify(autorizacoesCanonicas(anteriores.data)) === JSON.stringify(autorizacoes))
      return { id: r.decisaoConjunta.id, aprovada: r.decisaoConjunta.aprovada, aplicada: !!r.decisaoConjunta.aplicacao };
    throw new ErroRegra("A revisão já possui decisão.");
   }
   if (!d.aprovar) {
    const decisao = await tx.decisaoReplanejamentoConjunto.create({ data: { rascunhoId: r.id, decisorId: autor.id, aprovada: false, motivo: d.motivo, estadoHash: r.estadoHash } });
    await registrarEvento(tx, { tipo: "ReplanejamentoConjuntoDecidido", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id, payload: { calendarioId: r.calendarioId, revisaoId: r.id, aprovada: false, motivo: d.motivo } });
    return { id: decisao.id, aprovada: false, aplicada: false };
   }
   if (r.calendario.decisao) throw new ErroRegra("O calendário já possui decisão; prepare outra versão.");
   const ultima = await tx.rascunhoReplanejamento.findFirst({ where: { calendarioId: r.calendarioId }, orderBy: { versao: "desc" }, select: { id: true } });
   if (ultima?.id !== r.id) throw new ErroRegra("Existe revisão mais recente deste calendário.");
   const snapshot = ReplanejamentoSnapshotSchema.safeParse(r.snapshot);
   const entrada = z.object({ ajustes: AjustesReplanejamentoSchema.default([]) }).safeParse(r.snapshot);
   if (!snapshot.success || !entrada.success || snapshot.data.calendarioId !== r.calendarioId) throw new ErroRegra("Conteúdo histórico incompleto; preparar nova revisão conferida.");
   const atual = await carregarReplanejamentoTx(tx, r.calendarioId, entrada.data.ajustes);
   if (estadoReplanejamento(atual) !== r.estadoHash) throw new ErroRegra("A agenda ou suas condições mudaram desde o registro; conferir e guardar nova revisão.");
   if (atual.recursos.internos.length || atual.recursos.externos.length || atual.recursos.indisponibilidades.length || atual.recursos.reservas.length || atual.recursos.semDocenteApto.length)
    throw new ErroRegra("Resolver conflitos, reservas ou indisponibilidades antes de aplicar o conjunto.");
   if (atual.revisoes.some((t) => !t.previsao || t.pendencias.some((p) => !p.startsWith("Encontro ajustado atinge dia não letivo"))) || atual.particulares.length || (atual.recuperacoes?.length ?? 0))
    throw new ErroRegra("Há impacto específico pendente; o conjunto não pode ignorar turmas, particulares ou recuperações afetadas.");
   const excecoes = snapshot.data.revisoes.flatMap((t) => t.previsao?.propostas.filter((p) => (p.periodosNaoLetivos?.length ?? 0) > 0) ?? []);
   const autorizadas = new Set(autorizacoes);
   if (excecoes.some((p) => !p.motivoAjuste || !autorizadas.has(p.encontroId)) || autorizadas.size !== excecoes.length)
    throw new ErroRegra("Cada encontro em dia não letivo exige justificativa e autorização explícita nesta decisão.");
   const propostas = atual.revisoes.flatMap((t) => t.previsao?.propostas.filter((p) => p.alterado) ?? []);
   const ids = propostas.map((p) => p.encontroId);
   if (ids.length) {
    await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const encontrados = await tx.encontroAgenda.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, inicio: true, fim: true } });
    if (encontrados.length !== ids.length || encontrados.some((e) => e.status !== "PREVISTO" || e.inicio <= new Date())) throw new ErroRegra("Um encontro deixou de ser futuro e previsto; confira novamente o conjunto.");
   }
   for (const p of propostas) {
    const alterado = await tx.encontroAgenda.updateMany({ where: { id: p.encontroId, status: "PREVISTO", inicio: new Date(p.inicioAnterior), fim: new Date(p.fimAnterior) }, data: { inicio: new Date(p.inicioProposto), fim: new Date(p.fimProposto), motivo: r.motivo } });
    if (alterado.count !== 1) throw new ErroRegra("A agenda mudou durante a aplicação; confira novamente o conjunto.");
   }
   const decisaoCalendario = await tx.decisaoCalendarioEscolar.create({ data: { calendarioId: r.calendarioId, decisorId: autor.id, aprovada: true, motivo: d.motivo } });
   const decisao = await tx.decisaoReplanejamentoConjunto.create({ data: { rascunhoId: r.id, decisorId: autor.id, aprovada: true, motivo: d.motivo, estadoHash: r.estadoHash, excecoesAutorizadas: autorizacoes } });
   await tx.aplicacaoReplanejamentoConjunto.create({ data: { rascunhoId: r.id, decisaoId: decisao.id, estadoHash: r.estadoHash } });
   const evento = await registrarEvento(tx, { tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id, payload: { aprovada: true, calendarioId: r.calendarioId, decisaoCalendarioId: decisaoCalendario.id, revisaoId: r.id, decisaoId: decisao.id, encontrosIds: ids, horarios: propostas.map((p) => ({ encontroId: p.encontroId, inicioAnterior: p.inicioAnterior, fimAnterior: p.fimAnterior, inicioProposto: p.inicioProposto, fimProposto: p.fimProposto })), excecoesAutorizadas: autorizacoes, motivo: d.motivo } });
   if (ids.length) await criarAvisosReplanejamentoConjuntoTx(tx, { eventoId: evento.id, rascunhoId: r.id });
   // Avalia já dentro do callback para que uma violação deferred retorne um erro
   // de negócio, sem parecer uma aplicação bem-sucedida ao chamador.
   await tx.$executeRawUnsafe('SET CONSTRAINTS "validar_aplicacao_replanejamento_material_167" IMMEDIATE');
   return { id: decisao.id, aprovada: true, aplicada: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
 });
}
