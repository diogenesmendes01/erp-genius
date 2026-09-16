import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { pagamentoConfirmado } from "@/server/financeiro/regras";
import { conferirContinuidadeReserva } from "@/server/matricula/excecao-admissao-estado";
import { planejarCobrancasEntrada } from "@/server/matricula/plano-cobrancas-entrada";
import { conferirBaseOriginalAtual } from "./original-estado";
import { carregarAgendaParticularContratual } from "./agenda-particular";
import { hashPrevia } from "./previa-estado";

/** Revalidar novamente imediatamente antes de um futuro envio externo.
 * Um registro anterior desta conferência não é autorização duradoura de envio. */
export async function carregarRevisaoAssinatura(tx: Prisma.TransactionClient, matriculaId: string, artefatoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  const a = await tx.artefatoContratual.findFirst({ where: { id: artefatoId, previa: { matriculaId } }, include: { previa: true } });
  if (!a) throw new ErroRegra("Original indisponível nesta matrícula.");
  if (createHash("sha256").update(a.pdf).digest("hex") !== a.pdfHash) throw new ErroRegra("Integridade do original divergente. Confira o arquivo preservado.");
  const participantes = await tx.conferenciaParticipantesContratuais.findFirst({ where: { previaId: a.previaId }, orderBy: { versao: "desc" } });
  if (!participantes || hashPrevia({ previaHash: a.previa.conteudoHash, conferencia: participantes.snapshot }) !== a.baseHash) throw new ErroRegra("Os participantes mudaram. Preserve o original correspondente à conferência atual.");
  const { base, participantes: pessoas } = await conferirBaseOriginalAtual(tx, a.previa, participantes);
  const inicial = await tx.conferenciaEmissaoInicial.findUnique({ where: { matriculaId }, include: { emissao: true } });
  if (!inicial || inicial.emissao.condicoesId !== base.condicoesId) throw new ErroRegra("Conclua a conferência da Secretaria e a emissão inicial das condições deste contrato.");
  const politica = z.object({ politicaEntrada: z.object({ taxaPreviaAssinatura: z.boolean() }) }).parse(base.snapshot.condicoes).politicaEntrada;
  const planoTaxa = planejarCobrancasEntrada(base.snapshot.condicoes).find((p) => p.tipo === "MATRICULA")!;
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${matriculaId} ORDER BY id FOR SHARE`;
  const taxas = await tx.itemEmissaoEntrada.findMany({ where: { emissaoId: inicial.emissaoId, matriculaId, cobranca: { tipo: "MATRICULA" } }, include: { cobranca: true } });
  if (taxas.length !== 1) throw new ErroRegra("Confira a taxa vinculada à emissão inicial deste contrato.");
  const taxa = taxas[0].cobranca;
  if (taxa.status === "CANCELADA" || taxa.moeda !== planoTaxa.moeda || !taxa.valorNegociado.equals(planoTaxa.valor)) throw new ErroRegra("A taxa emitida difere das condições do original. Concilie antes da assinatura.");
  const confirmada = pagamentoConfirmado(taxa);
  if (politica.taxaPreviaAssinatura && !confirmada) throw new ErroRegra("Esta oferta exige taxa integralmente recebida e confirmada pelo Financeiro antes da assinatura. Informe a conferir não comprova pagamento.");
  const vinculo = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: { reservaParticularId: true } });
  const disponibilidadeAtual = await (async () => {
    if (vinculo?.reservaParticularId) {
      const particular = await carregarAgendaParticularContratual(tx, matriculaId, vinculo.reservaParticularId);
      const r = particular.snapshot;
      return { reserva: { id: r.reservaId, turmaId: null, status: r.status, expiraEm: r.expiraEm }, janela: null, excecaoAdmissaoId: null,
        agenda: r.horarios, agendaParticular: particular.texto };
    }
    const reservas = await tx.reservaVagaMatricula.findMany({ where: { matriculaId, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, include: { turma: true } });
    if (reservas.length !== 1) throw new ErroRegra("Regularize a reserva desta contratação antes da assinatura.");
    const reserva = reservas[0];
    if (reserva.status === "ATIVA" && reserva.expiraEm <= new Date()) throw new ErroRegra("O prazo da reserva venceu. Regularize a reserva antes da assinatura.");
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${reserva.turmaId} FOR UPDATE`;
    const disponibilidade = await conferirContinuidadeReserva(tx, reserva.id);
    if (!disponibilidade.conferencia.elegivel) throw new ErroRegra(`A turma não atende à admissão: ${disponibilidade.conferencia.impedimentos.join(", ")}. Regularize a agenda ou a autorização aplicável.`);
    const agenda = await tx.encontroAgenda.findMany({ where: { turmaId: reserva.turmaId, status: "PREVISTO", inicio: { gt: disponibilidade.agora } }, orderBy: { id: "asc" }, select: { id: true, inicio: true, fim: true, professorId: true, propostaGradeId: true } });
    return { reserva: { id: reserva.id, turmaId: reserva.turmaId, status: reserva.status, expiraEm: reserva.expiraEm.toISOString() }, janela: disponibilidade.janela, excecaoAdmissaoId: disponibilidade.excecaoId, agenda, agendaParticular: null as string | null };
  })();
  // Projeção explícita: não envia PDF, URLs de evidências ou dados de outras contratações à tela.
  const dados = { matriculaId, artefatoId: a.id, previaId: a.previaId, pdfHash: a.pdfHash, baseHash: a.baseHash,
    conferenciaParticipantesId: participantes.id, conferenciaInicialId: inicial.id, condicoesId: base.condicoesId,
    regraTaxa: politica.taxaPreviaAssinatura ? "CONFIRMACAO_PREVIA_EXIGIDA" as const : "SEM_PAGAMENTO_PREVIO" as const,
    taxa: { id: taxa.id, valor: taxa.valorNegociado.toFixed(2), moeda: taxa.moeda, status: taxa.status, recebida: taxa.valorRecebido?.toFixed(2) ?? null, pagoEm: taxa.pagoEm?.toISOString() ?? null, confirmada },
    ...disponibilidadeAtual,
    participantes: pessoas.map((p) => ({ papel: p.papel, etapa: p.etapa, nome: p.identidade.nome, email: p.identidade.email })) };
  const snapshot = JSON.parse(JSON.stringify(dados)) as Prisma.InputJsonObject;
  return { dados, snapshot, revisaoHash: hashPrevia(snapshot) };
}
