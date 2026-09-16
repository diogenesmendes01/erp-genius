import { AgendaParticularSchema } from "./agenda-particular-estado";
import { reservarAgendaParticularTx } from "./reserva-particular-tx";
import { conferirAlcadaPreparacao } from "./alcada-preparacao";
import { calcularAdiantamentoProposto } from "./adiantamento-proposto";
import { limitesAtuais } from "@/server/financeiro/politica";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";

const valor = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
export const CadastroInicialSchema = z.object({ primeiroNome: z.string().trim().min(1).max(100), sobrenome: z.string().trim().min(1).max(150).optional(), paisId: z.string().min(1), email: z.string().trim().email().max(254).optional() }).strict();
export const PreparacaoComercialSchema = z.object({ autorId: z.string().min(1), leadId: z.string().min(1), alunoId: z.string().min(1).optional(), novoCadastro: CadastroInicialSchema.optional(), produtoId: z.string().min(1), paisId: z.string().min(1), turmaId: z.string().min(1).optional(), agendaParticular: AgendaParticularSchema.extend({ estadoHash: z.string().regex(/^[a-f0-9]{64}$/), horariosAcordadosConferidos: z.literal(true) }).optional(),
  regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]), minutosAdiantamento: z.number().int().positive().max(2147483647).optional(), taxaProposta: valor, valorServicoProposto: valor, motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

/** Interna: o chamador deve identificar e autorizar a identidade alunoId antes de invocar.
 * Não é Server Action. Valores são propostas, não condições aprovadas ou cobranças.
 */
export async function prepararContratacaoTx(tx: Prisma.TransactionClient, input: z.input<typeof PreparacaoComercialSchema>) {
  const d = PreparacaoComercialSchema.refine((d) => !!d.alunoId !== !!d.novoCadastro, "Informe cadastro existente ou pessoa nova.").parse(input), entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  if (!!d.turmaId === !!d.agendaParticular) throw new ErroRegra("Informe turma ou agenda particular, exclusivamente.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${d.leadId} FOR UPDATE`;
  const autor = await tx.usuario.findUnique({ where: { id: d.autorId }, select: { id: true, nome: true, ativo: true, papeis: true } });
  const papeis: Papel[] = [Papel.ADMINISTRADOR, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA];
  if (!autor?.ativo || !autor.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
  const operacional = autor.papeis.includes(Papel.ADMINISTRADOR) || autor.papeis.includes(Papel.SECRETARIA_ACADEMICA);
  const lead = await tx.lead.findFirst({ where: { AND: [{ id: d.leadId }, operacional ? {} : await escopoComercialAtual(autor, tx)] }, select: { id: true, telefoneE164: true, vendedorDonoId: true, matricula: { select: { id: true } } } });
  if (!lead) throw new ErroPermissao();
  const repetida = await tx.preparacaoComercialMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra preparação.");
    return { id: repetida.id, matriculaId: repetida.matriculaId, reservaId: repetida.reservaId ?? repetida.reservaParticularId!, tipoReserva: repetida.reservaParticularId ? "PARTICULAR" : "TURMA" };
  }
  if (lead.matricula) throw new ErroRegra("Negociação já possui matrícula; confira sua preparação.");
  if (!lead.vendedorDonoId) throw new ErroRegra("Defina o responsável da negociação antes de preparar a contratação.");
  let aluno: { id: string } | null;
  if (d.novoCadastro) {
    if (!lead.telefoneE164 || !/^\+[1-9]\d{7,14}$/.test(lead.telefoneE164)) throw new ErroRegra("Confira o contato da negociação antes de cadastrar.");
    if (await tx.aluno.count({ where: { OR: [{ telefoneE164: lead.telefoneE164 }, ...(d.novoCadastro.email ? [{ email: { equals: d.novoCadastro.email, mode: "insensitive" as const } }] : [])] } })) throw new ErroRegra("Existe cadastro com esse contato. Confira a identidade antes de criar outra pessoa.");
    if (!await tx.pais.findUnique({ where: { id: d.novoCadastro.paisId }, select: { id: true } })) throw new ErroRegra("País do cadastro não encontrado.");
    aluno = await tx.aluno.create({ data: { ...d.novoCadastro, telefoneE164: lead.telefoneE164 }, select: { id: true } });
  } else aluno = await tx.aluno.findUnique({ where: { id: d.alunoId }, select: { id: true } });
  if (!aluno) throw new ErroRegra("Identifique o cadastro do aluno antes de preparar.");
  const pais = await tx.pais.findUnique({ where: { id: d.paisId }, select: { status: true, moedaLocal: true } });
  await tx.$queryRaw`SELECT id FROM "ProdutoPais" WHERE "produtoId" = ${d.produtoId} AND "paisId" = ${d.paisId} FOR SHARE`;
  const oferta = await tx.produtoPais.findUnique({ where: { produtoId_paisId: { produtoId: d.produtoId, paisId: d.paisId } }, select: { id: true, oferecido: true, moeda: true, formaAgenda: true, versaoEntrada: true, taxaPreviaAssinatura: true, adiantamentoHoraExigido: true } });
  if (!pais || pais.status !== "ATIVO" || !oferta?.oferecido || oferta.moeda !== pais.moedaLocal) throw new ErroRegra("Confira a oferta e a moeda do país antes de preparar.");
  // Uma vaga de turma não comprova os horários individuais exigidos por Q111.
  const particular = oferta.formaAgenda === "PARTICULAR_GRADE_FIXA" || oferta.formaAgenda === "PARTICULAR_FLEXIVEL";
  if (particular && !d.agendaParticular) throw new ErroRegra("Esta oferta exige reserva de horários particulares. O fluxo de reserva individual ainda precisa ser concluído; uma vaga de turma não o substitui.");
  if (oferta.formaAgenda === "TURMA" && d.regime === "HORA_PARTICULAR") throw new ErroRegra("A oferta está configurada para turma. Confira a forma de agenda da particular antes de contratar por hora.");
  if (d.agendaParticular && (!particular || d.agendaParticular.ofertaId !== oferta.id)) throw new ErroRegra("Confira a oferta da agenda particular.");
  const adiantamentoProposto = calcularAdiantamentoProposto(d.regime, d.minutosAdiantamento, d.valorServicoProposto, oferta.adiantamentoHoraExigido);
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const operacao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { exigirPrimeiraMensalidade: true } });
  const referencias = await tx.precoReferencia.findMany({ where: { paisId: d.paisId, produtoId: d.produtoId, ativo: true, tipoCobranca: { in: ["MATRICULA", d.regime] } }, orderBy: { id: "asc" }, select: { id: true, tipoCobranca: true, valor: true, moeda: true } });
  const limites = await limitesAtuais(tx, autor);
  const alcada = conferirAlcadaPreparacao({ regime: d.regime, moeda: pais.moedaLocal, taxa: d.taxaProposta, servico: d.valorServicoProposto, limiteTaxa: limites.limiteDescontoTaxaPct, limiteMensalidade: limites.limiteDescontoMensalidadePct, referencias });
  const matricula = await tx.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: d.produtoId, paisId: d.paisId, moeda: pais.moedaLocal, status: "RASCUNHO" } });
  const origemReserva = { matriculaId: matricula.id, autorId: autor.id, motivo: d.motivo, chaveIdempotencia: createHash("sha256").update(`preparacao:${autor.id}:${d.chaveIdempotencia}`).digest("hex") };
  const reserva = d.agendaParticular ? await reservarAgendaParticularTx(tx, { ...d.agendaParticular, ...origemReserva }) : await reservarVagaMatriculaTx(tx, { ...origemReserva, turmaId: d.turmaId! });
  const preparacao = await tx.preparacaoComercialMatricula.create({ data: { matriculaId: matricula.id, reservaId: particular ? null : reserva.id, reservaParticularId: particular ? reserva.id : null, preparadorId: autor.id, regime: d.regime,
    taxaProposta: d.taxaProposta, valorServicoProposto: d.valorServicoProposto, moeda: pais.moedaLocal, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
    referencias: { adiantamentoProposto, politicaEntrada: { formaAgenda: oferta.formaAgenda, exigirPrimeiraMensalidade: operacao?.exigirPrimeiraMensalidade ?? null, ofertaId: oferta.id, versao: oferta.versaoEntrada, taxaPreviaAssinatura: oferta.taxaPreviaAssinatura, adiantamentoHoraExigido: oferta.adiantamentoHoraExigido }, exigeDirecao: autor.papeis.includes(Papel.GERENTE_COMERCIAL) || autor.papeis.includes(Papel.ADMINISTRADOR), alcada, vendedorResponsavelId: lead.vendedorDonoId, condicoesAprovadas: false, precos: referencias.map((r) => ({ ...r, valor: r.valor.toString() })) } } });
  await registrarEvento(tx, { tipo: "ContratacaoPreparada", agregadoTipo: "Matricula", agregadoId: matricula.id, autorId: autor.id,
    payload: { preparacaoId: preparacao.id, reservaId: reserva.id, tipoReserva: particular ? "PARTICULAR" : "TURMA", leadId: lead.id, regime: d.regime, cadastroReutilizado: !d.novoCadastro } });
  return { id: preparacao.id, matriculaId: matricula.id, reservaId: reserva.id, tipoReserva: particular ? "PARTICULAR" : "TURMA" };
}
