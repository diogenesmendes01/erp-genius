import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { AgendaParticularSchema, conferirAgendaParticularTx } from "./agenda-particular-estado";
import { reservarAgendaParticularTx } from "./reserva-particular-tx";
import { resolverReservaParticularAtual, vincularNovaReservaParticularTx } from "./reserva-particular-cadeia";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";
import { hashPrevia } from "@/server/contratos/previa-estado";

export const NovaReservaParticularSchema = z.object({ matriculaId: z.string().min(1), anteriorId: z.string().min(1), agenda: AgendaParticularSchema }).strict();

/** Chamador mantém esta revisão e a criação na mesma transação. */
export async function revisarNovaReservaParticularTx(tx: Prisma.TransactionClient, input: z.input<typeof NovaReservaParticularSchema>, autorId: string) {
  const d = NovaReservaParticularSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => p === "SECRETARIA_ACADEMICA" || p === "ADMINISTRADOR")) throw new ErroPermissao();
  const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, include: { preparacaoComercial: true,
    aluno: { select: { id: true, primeiroNome: true, sobrenome: true, documento: true, documentoValido: true, email: true, telefoneE164: true, rua: true, numero: true, cidade: true, regiao: true, cep: true, paisResidencia: true } },
    cobrancas: { orderBy: { id: "asc" }, select: { id: true, tipo: true, moeda: true, versao: true, valorNegociado: true, valorRecebido: true, saldo: true, status: true, vencimento: true,
      informes: { orderBy: { id: "asc" }, select: { id: true, status: true, versao: true } }, recebimentos: { orderBy: { id: "asc" }, select: { id: true } } } },
    pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 }, condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 } } });
  const inicialId = m?.preparacaoComercial?.reservaParticularId;
  if (!m || !inicialId || !m.secretariaAssumiuEm || !["RASCUNHO", "AGUARDANDO"].includes(m.status) || await resolverReservaParticularAtual(tx, inicialId) !== d.anteriorId) throw new ErroRegra("Confira a reserva atual da preparação assumida pela Secretaria.");
  const anterior = await tx.reservaAgendaParticular.findUniqueOrThrow({ where: { id: d.anteriorId } });
  if (!["EXPIRADA", "LIBERADA"].includes(anterior.status)) throw new ErroRegra("A reserva anterior precisa estar expirada ou liberada.");
  if (m.contratoOk || m.confirmacaoContratoEm || m.contratoDocumentoId || await tx.processoAssinaturaContratual.count({ where: { matriculaId: m.id } }) || await tx.documento.count({ where: { matriculaId: m.id, categoria: "CONTRATO" } })) throw new ErroRegra("Concilie o processo e os documentos contratuais antes de retomar. A integração dessa conferência ainda está pendente.");
  const pagador = m.pagadoresPreparacao[0], condicoes = m.condicoesEntradaPreparacao[0];
  if (!pagador || !condicoes) throw new ErroRegra("Confira pagador e condições de entrada.");
  const referencias = z.object({ pagadorRegistroId: z.string(), preparacaoId: z.string() }).parse(condicoes.dados);
  if (referencias.pagadorRegistroId !== pagador.id || referencias.preparacaoId !== m.preparacaoComercial!.id) throw new ErroRegra("As condições precisam acompanhar a preparação e o pagador atuais.");
  await exigirPrecoPreparacaoAutorizado(tx, m.id);
  const oferta = await tx.produtoPais.findUnique({ where: { id: d.agenda.ofertaId } });
  const formaOriginal = z.object({ formaAgenda: z.string() }).parse(anterior.snapshot).formaAgenda;
  if (!oferta || oferta.produtoId !== m.produtoId || oferta.paisId !== m.paisId || oferta.moeda !== m.moeda || oferta.formaAgenda !== formaOriginal) throw new ErroRegra("Mudança de oferta ou forma de agenda exige revisão contratual própria.");
  const agenda = await conferirAgendaParticularTx(tx, d.agenda);
  if (agenda.snapshot.impedimentos.length) throw new ErroRegra("Resolva os impedimentos da nova agenda.");
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.aluno.id} FOR SHARE`;
  const alunoAtual = await tx.aluno.findUniqueOrThrow({ where: { id: m.aluno.id }, select: { primeiroNome: true, sobrenome: true, documento: true, documentoValido: true, email: true, telefoneE164: true, rua: true, numero: true, cidade: true, regiao: true, cep: true, paisResidencia: true } });
  const snapshot = { anteriorId: anterior.id, anteriorStatus: anterior.status, preparacaoId: m.preparacaoComercial!.id, aluno: alunoAtual, cobrancas: m.cobrancas, pagador, condicoes, agenda: agenda.snapshot };
  return { snapshot, revisaoHash: hashPrevia(snapshot), agendaHash: agenda.estadoHash };
}

/** Executor interno. Não cobra, não assina e não ativa; chamada pública e
 * reconciliação de documentos/assinaturas ainda precisam ser integradas. */
export async function criarNovaReservaParticularTx(tx: Prisma.TransactionClient, input: z.input<typeof NovaReservaParticularSchema> & { autorId: string; revisaoHash: string; motivo: string; chaveIdempotencia: string; dadosConferidos: true }) {
  const d = NovaReservaParticularSchema.extend({ autorId: z.string().min(1), revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100), dadosConferidos: z.literal(true) }).strict().parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const autor = await tx.usuario.findUnique({ where: { id: d.autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => p === "SECRETARIA_ACADEMICA" || p === "ADMINISTRADOR")) throw new ErroPermissao();
  const entradaHash = hashPrevia(d);
  const existente = await tx.reservaAgendaParticular.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: d.autorId, chaveIdempotencia: d.chaveIdempotencia } }, include: { retomadaDestino: true } });
  if (existente) {
    const evento = await tx.evento.findFirst({ where: { tipo: "RetomadaParticularConfirmada", agregadoId: d.matriculaId, autorId: d.autorId, payload: { path: ["reservaId"], equals: existente.id } } });
    const memoria = z.object({ entradaHash: z.string() }).safeParse(evento?.payload);
    if (existente.matriculaId !== d.matriculaId || existente.retomadaDestino?.anteriorId !== d.anteriorId || !memoria.success || memoria.data.entradaHash !== entradaHash) throw new ErroRegra("Chave já usada em outra operação de reserva.");
    return { reservaId: existente.id, vinculoId: existente.retomadaDestino.id };
  }
  const revisao = await revisarNovaReservaParticularTx(tx, { matriculaId: d.matriculaId, anteriorId: d.anteriorId, agenda: d.agenda }, d.autorId);
  if (revisao.revisaoHash !== d.revisaoHash) throw new ErroRegra("A preparação ou disponibilidade mudou; confira novamente.");
  const nova = await reservarAgendaParticularTx(tx, { ...d.agenda, matriculaId: d.matriculaId, autorId: d.autorId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, estadoHash: revisao.agendaHash, horariosAcordadosConferidos: true });
  const vinculo = await vincularNovaReservaParticularTx(tx, { anteriorId: d.anteriorId, novaId: nova.id, autorId: d.autorId, motivo: d.motivo });
  await registrarEvento(tx, { tipo: "RetomadaParticularConfirmada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: d.autorId,
    payload: { reservaId: nova.id, vinculoId: vinculo.id, anteriorId: d.anteriorId, entradaHash, revisaoHash: revisao.revisaoHash, dadosConferidos: true } });
  return { reservaId: nova.id, vinculoId: vinculo.id };
}
