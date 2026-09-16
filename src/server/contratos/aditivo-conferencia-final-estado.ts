import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { consultarEstadoAssinaturaAditivoTx } from "./aditivo-assinatura-estado";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { hashSubstituicao } from "./substituicao-estado";

export async function carregarEstadoConferenciaFinalAditivoTx(tx: Prisma.TransactionClient, entrada: { matriculaId: string; propostaId: string; conclusaoId: string }) {
  const c = await tx.conclusaoAssinaturaAditivo.findFirst({ where: { id: entrada.conclusaoId, processo: { propostaId: entrada.propostaId, proposta: { matriculaId: entrada.matriculaId } } }, include: { processo: { include: { proposta: true, artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } } } });
  if (!c) throw new ErroRegra("Conclusão de aditivo indisponível neste escopo.");
  const p = c.processo, envio = p.tentativas[0];
  if (!envio || p.estado !== "ENVIADO" || p.referenciaExterna !== c.referenciaExterna || createHash("sha256").update(p.artefato.pdf).digest("hex") !== p.artefato.pdfHash || createHash("sha256").update(c.pdfAssinado).digest("hex") !== c.pdfHash || createHash("sha256").update(c.evidencias).digest("hex") !== c.evidenciasHash) throw new ErroRegra("A integridade do recibo de assinatura diverge.");
  const assinaturas = ConclusaoAssinaturaSchema.shape.assinaturas.element.strip().array().parse(c.assinaturas);
  const validada = validarConclusaoAssinatura({ processoId: p.id, referenciaExterna: c.referenciaExterna, originalHash: c.originalHash, concluidaEm: c.concluidaEm.toISOString(), pdfAssinado: c.pdfAssinado, evidencias: c.evidencias, assinaturas }, p.artefato.conferencia.snapshot, envio.iniciadaEm);
  if (validada.entradaHash !== c.entradaHash) throw new ErroRegra("A conclusão preservada diverge de suas assinaturas.");
  const conferenciaAssinatura = await tx.conferenciaAssinaturaAditivo.findUnique({ where: { id: p.conferenciaId } });
  const revisao = await consultarEstadoAssinaturaAditivoTx(tx, { matriculaId: entrada.matriculaId, propostaId: entrada.propostaId, artefatoId: p.artefatoId });
  if (!conferenciaAssinatura || conferenciaAssinatura.artefatoId !== p.artefatoId || hashSubstituicao(conferenciaAssinatura.snapshot) !== conferenciaAssinatura.revisaoHash || revisao.revisaoHash !== conferenciaAssinatura.revisaoHash) throw new ErroRegra("A conferência interna do aditivo não é mais válida.");
  const dados = { matriculaId: entrada.matriculaId, propostaId: p.propostaId, propostaHash: p.proposta.entradaHash, conclusaoId: c.id, conclusaoHash: c.entradaHash, originalHash: c.originalHash, pdfHash: c.pdfHash, evidenciasHash: c.evidenciasHash, processoId: p.id, artefatoId: p.artefatoId, conferenciaAssinaturaId: p.conferenciaId, ambiente: p.ambiente, vigenciaInicio: p.proposta.vigenciaInicio.toISOString() };
  return { conclusao: c, dados, revisaoHash: hashSubstituicao(dados as Prisma.JsonObject) };
}
