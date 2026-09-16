import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirPagamentosEntradaParticular } from "@/server/matricula/entrada-particular-pagamentos";
import { carregarRevisaoAssinatura } from "./assinatura-estado";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { hashPrevia } from "./previa-estado";

export async function conferirConclusaoParaAceite(tx: Prisma.TransactionClient, matriculaId: string, conclusaoId: string) {
  const c = await tx.conclusaoAssinaturaContratual.findFirst({ where: { id: conclusaoId, processo: { matriculaId } }, include: {
    processo: { include: { artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } },
  } });
  if (!c) throw new ErroRegra("Conclusão indisponível nesta matrícula.");
  const [conflito] = await tx.$queryRaw<{ existe: boolean }[]>`SELECT fonte_assinada_substituicao_218(${c.processoId}) AS existe`;
  if (conflito.existe) throw new ErroRegra("Contrato anterior assinado exige conferência Q117 antes do aceite.");
  const p = c.processo, a = p.artefato, envio = p.tentativas[0];
  if (p.ambiente !== "PRODUCAO") throw new ErroRegra("Evidência de teste não permite confirmar o aceite contratual.");
  if (p.estado !== "ENVIADO" || !envio || c.referenciaExterna !== p.referenciaExterna || c.originalHash !== a.pdfHash || createHash("sha256").update(a.pdf).digest("hex") !== a.pdfHash) throw new ErroRegra("Confira a integridade e o vínculo do original com o envio concluído.");
  const validada = validarConclusaoAssinatura({ processoId: p.id, referenciaExterna: c.referenciaExterna, originalHash: c.originalHash,
    concluidaEm: c.concluidaEm.toISOString(), pdfAssinado: c.pdfAssinado, evidencias: c.evidencias,
    assinaturas: ConclusaoAssinaturaSchema.shape.assinaturas.element.strip().array().parse(c.assinaturas) }, a.conferencia.snapshot, envio.iniciadaEm);
  if (validada.entradaHash !== c.entradaHash || validada.pdfHash !== c.pdfHash || validada.evidenciasHash !== c.evidenciasHash) throw new ErroRegra("As evidências divergem da conclusão preservada.");
  return c;
}

export async function carregarRevisaoAceite(tx: Prisma.TransactionClient, matriculaId: string, conclusaoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  const c = await conferirConclusaoParaAceite(tx, matriculaId, conclusaoId);
  const revisao = await carregarRevisaoAssinatura(tx, matriculaId, c.processo.artefatoId);
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId }, include: {
    condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 }, cobrancas: { orderBy: { id: "asc" } },
    emissoesEntrada: { include: { itens: { select: { cobrancaId: true } }, conferenciaInicial: { select: { id: true } } } },
  } });
  const condicoes = m.condicoesEntradaPreparacao[0], emissao = m.emissoesEntrada[0];
  if (!condicoes || !emissao?.conferenciaInicial || m.emissoesEntrada.length !== 1 || emissao.condicoesId !== condicoes.id) throw new ErroRegra("Confira a emissão inicial correspondente ao original.");
  // A consistência financeira é exigida; pagamento inicial para ativar não é exigência adicional de assinatura.
  const entrada = conferirPagamentosEntradaParticular(condicoes.dados, emissao.memoria, m.cobrancas, emissao.itens.map(i => i.cobrancaId));
  if (m.cobrancas.some(i => i.status === "CANCELADA")) throw new ErroRegra("Regularize as cobranças canceladas antes de confirmar o aceite.");
  const condicoesMensais = { referenciaCobertura: m.referenciaCobertura, dataReferenciaCobertura: m.dataReferenciaCobertura?.toISOString() ?? null, diaVencimento: m.diaVencimento,
    mensalidades: m.cobrancas.filter(i => i.tipo === "MENSALIDADE").map(i => ({ id: i.id, versao: i.versao, coberturaInicio: i.coberturaInicio?.toISOString() ?? null, coberturaFim: i.coberturaFim?.toISOString() ?? null, vencimento: i.vencimento.toISOString(), valorNegociado: i.valorNegociado.toString(), moeda: i.moeda })) };
  const snapshot = { matriculaId, conclusaoId, conclusaoHash: c.entradaHash, originalHash: c.originalHash, artefatoId: c.processo.artefatoId,
    condicoesId: condicoes.id, pagadorRegistroId: z.object({ pagadorRegistroId: z.string() }).parse(condicoes.dados).pagadorRegistroId,
    revisaoAssinaturaHash: revisao.revisaoHash, entrada, condicoesMensais };
  return { snapshot, revisaoHash: hashPrevia(snapshot), dados: { matriculaId, conclusaoId, artefatoId: c.processo.artefatoId,
    versaoCondicoes: condicoes.versao, participantes: revisao.dados.participantes.map(p => ({ nome: p.nome, papel: p.papel })), entrada } };
}

/** Chamado pelo guard de ativação, que já bloqueou a matrícula. Não substitui os demais requisitos. */
export async function exigirAceiteIntegrado(tx: Prisma.TransactionClient, m: { id: string; contratoDocumentoId: string | null; confirmacaoContratoEm: Date | null; confirmacaoContratoPorId: string | null }) {
  if (!await tx.preparacaoComercialMatricula.count({ where: { matriculaId: m.id } })) return null;
  const aceite = await tx.aceiteOriginalContratual.findUnique({ where: { matriculaId: m.id }, include: { documento: true } });
  if (!aceite) throw new ErroRegra("Esta contratação exige aceite do original assinado pelo fluxo integrado.");
  const c = await conferirConclusaoParaAceite(tx, m.id, aceite.conclusaoId);
  const s = z.object({ condicoesId: z.string(), pagadorRegistroId: z.string(), conclusaoHash: z.string(), originalHash: z.string() }).parse(aceite.snapshot);
  const atual = await tx.condicoesEntradaPreparacao.findFirst({ where: { matriculaId: m.id }, orderBy: { versao: "desc" }, select: { id: true } });
  const pagador = await tx.pagadorPreparacaoMatricula.findFirst({ where: { matriculaId: m.id }, orderBy: { versao: "desc" }, select: { id: true } });
  const d = aceite.documento;
  if (s.condicoesId !== atual?.id || s.pagadorRegistroId !== pagador?.id || s.conclusaoHash !== c.entradaHash || s.originalHash !== c.originalHash
    || m.contratoDocumentoId !== d.id || m.confirmacaoContratoPorId !== aceite.autorId || m.confirmacaoContratoEm?.getTime() !== aceite.criadaEm.getTime()
    || d.matriculaId !== m.id || d.arquivado || d.categoria !== "CONTRATO" || d.url !== `/api/matriculas/${m.id}/assinaturas/${c.id}/pdf`) throw new ErroRegra("O aceite integrado diverge das condições ou do documento vigente. Solicite revisão contratual.");
  return d.id;
}
