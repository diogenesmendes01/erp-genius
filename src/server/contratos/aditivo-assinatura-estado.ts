import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { carregarEstadoOriginalAditivoTx } from "./aditivo-original-estado";
import { hashSubstituicao } from "./substituicao-estado";

const GeradorSchema = z.object({ versao: z.literal("aditivo-original-1"), fontes: z.array(z.object({ nome: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1) }).passthrough();

/** Estado que a equipe confere internamente; não qualifica alçadas e não envia o documento. */
export async function consultarEstadoAssinaturaAditivoTx(tx: Prisma.TransactionClient, entrada: { matriculaId: string; propostaId: string; artefatoId: string }) {
  const artefatoInicial = await tx.artefatoAditivoContratual.findFirst({ where: { id: entrada.artefatoId, propostaId: entrada.propostaId, proposta: { matriculaId: entrada.matriculaId } }, include: { conferencia: true } });
  if (!artefatoInicial) throw new ErroRegra("Original de aditivo indisponível nesta matrícula e proposta.");
  const estado = await carregarEstadoOriginalAditivoTx(tx, { propostaId: entrada.propostaId, conferenciaId: artefatoInicial.conferenciaId, conferenciaHash: artefatoInicial.conferencia.revisaoHash });
  if (estado.proposta.matriculaId !== entrada.matriculaId || estado.proposta.id !== entrada.propostaId) throw new ErroRegra("Original de aditivo fora do escopo solicitado.");
  const artefato = await tx.artefatoAditivoContratual.findUnique({ where: { id: entrada.artefatoId }, include: { conferencia: true } });
  if (!artefato || artefato.propostaId !== estado.proposta.id || artefato.conferenciaId !== estado.conferencia.id) throw new ErroRegra("Original de aditivo não corresponde à conferência atual.");
  if (artefato.baseHash !== estado.baseHash || createHash("sha256").update(artefato.pdf).digest("hex") !== artefato.pdfHash || !artefato.pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new ErroRegra("A integridade do original de aditivo diverge. Ele não será regenerado.");
  GeradorSchema.parse(artefato.gerador);
  const participantes = (estado.conferencia.snapshot as { participantes?: unknown }).participantes;
  const ParticipantesSchema = z.array(z.object({ papel: z.string(), etapa: z.enum(["CLIENTE", "ESCOLA"]), identidade: z.object({ nome: z.string(), email: z.string().email(), documento: z.string() }).strict() }).passthrough()).min(1);
  const conferidos = ParticipantesSchema.parse(participantes);
  let encontrouEscola = false;
  for (const participante of conferidos) {
    if (participante.etapa === "ESCOLA") encontrouEscola = true;
    else if (encontrouEscola) throw new ErroRegra("O plano de participantes não preserva a ordem cliente e escola.");
  }
  const decisaoId = estado.proposta.decisao?.id;
  if (!decisaoId) throw new ErroRegra("A proposta exige decisão administrativa aprovada.");
  const dados = { propostaId: estado.proposta.id, versaoProposta: estado.proposta.versao, artefatoId: artefato.id, pdfHash: artefato.pdfHash,
    baseHash: artefato.baseHash, conferenciaId: estado.conferencia.id, conferenciaVersao: estado.conferencia.versao,
    ambiente: estado.contexto.base.base.ambiente, modelo: { codigo: estado.contexto.base.base.modeloCodigo, versao: estado.contexto.base.base.modeloVersao },
    vigenciaInicio: estado.proposta.vigenciaInicio.toISOString(), participantes: conferidos.map(p => ({ papel: p.papel, etapa: p.etapa, identidade: p.identidade })) };
  const snapshot = { ...dados, propostaHash: estado.proposta.entradaHash, conferenciaHash: estado.conferencia.revisaoHash, decisaoId };
  return { snapshot, revisaoHash: hashSubstituicao(snapshot as Prisma.JsonObject), dados };
}
