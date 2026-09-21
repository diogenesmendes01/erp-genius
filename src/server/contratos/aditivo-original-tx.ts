import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { gerarPdfOriginalAditivo } from "./pdf-previa";
import { PreservarOriginalAditivoSchema } from "./aditivo-original-schema";
import { carregarEstadoOriginalAditivoTx } from "./aditivo-original-estado";

const metadados = { id: true, propostaId: true, conferenciaId: true, pdfHash: true, baseHash: true, paginas: true, criadoEm: true } satisfies Prisma.ArtefatoAditivoContratualSelect;

/** Preserva uma única vez o original preparado a partir da conferência vigente. */
export async function preservarOriginalAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = PreservarOriginalAditivoSchema.parse(entrada);
  // O estado toma calendário, matrícula e processo fonte antes da leitura da conferência.
  const estado = await carregarEstadoOriginalAditivoTx(tx, d);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId);
  const existente = await tx.artefatoAditivoContratual.findUnique({ where: { conferenciaId: estado.conferencia.id }, select: metadados });
  if (existente) return existente;
  const projecao = estado.contexto.base;
  const gerado = await gerarPdfOriginalAditivo({ propostaId: estado.proposta.id, conferenciaId: estado.conferencia.id,
    conferenciaHash: estado.conferencia.revisaoHash, criadaEm: estado.conferencia.criadaEm, propostaHash: estado.proposta.entradaHash,
    modeloCodigo: projecao.base.modeloCodigo, modeloVersao: projecao.base.modeloVersao, versaoProposta: estado.proposta.versao,
    ambiente: projecao.base.ambiente as "SANDBOX" | "PRODUCAO", documento: estado.documento });
  if (!Buffer.isBuffer(gerado.bytes) || gerado.bytes.length < 5 || gerado.bytes.length > 10 * 1024 * 1024 || createHash("sha256").update(gerado.bytes).digest("hex") !== gerado.sha256)
    throw new ErroRegra("A geração do original de aditivo não passou na verificação de integridade.");
  const artefato = await tx.artefatoAditivoContratual.create({ data: { propostaId: estado.proposta.id, conferenciaId: estado.conferencia.id, autorId,
    pdf: gerado.bytes, pdfHash: gerado.sha256, baseHash: estado.baseHash, gerador: JSON.parse(JSON.stringify(gerado.gerador)) as Prisma.InputJsonObject,
    paginas: gerado.paginas, motivo: d.motivo }, select: metadados });
  await registrarEvento(tx, { tipo: "OriginalAditivoPreservado", agregadoTipo: "Matricula", agregadoId: estado.proposta.matriculaId, autorId,
    payload: { propostaId: estado.proposta.id, conferenciaId: estado.conferencia.id, artefatoId: artefato.id, pdfHash: artefato.pdfHash } });
  return artefato;
}
