import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { conferirParticipantesAditivo } from "./aditivo-participantes-schema";
import { ConferirParticipantesAditivoSchema } from "./aditivo-participantes-schema";
import { carregarContextoParticipantesAditivoTx } from "./aditivo-participantes-contexto";
import { ProjecaoAditivoSchema } from "./aditivo-projecao";
import { PlanoAssinaturasSchema } from "./exigencias-assinatura";
import { hashSubstituicao } from "./substituicao-estado";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const campos = ConferirParticipantesAditivoSchema.innerType().shape;
const ParticipanteConferidoSchema = campos.participantes.element.extend({
  etapa: z.enum(["CLIENTE", "ESCOLA"]), origem: z.enum(["ALUNO", "PAGADOR", "REPRESENTANTE_CONFERIDO"]),
});
const SnapshotConferenciaSchema = z.object({
  propostaId: z.string().min(1), propostaHash: HashSchema, decisaoId: z.string().min(1),
  maioridade: z.object({ classificacao: z.enum(["MAIOR", "MENOR"]), criterio: z.string().trim().min(5), evidenciaDocumentoId: z.string().min(1) }).nullable(),
  plano: PlanoAssinaturasSchema, participantes: z.array(ParticipanteConferidoSchema).min(1),
  documentos: z.array(z.object({ id: z.string().min(1), nome: z.string(), url: z.string(), categoria: z.string() }).strict()),
  assinaturasHerdadas: z.array(z.unknown()).length(0), identificacoesConferidas: z.literal(true),
}).passthrough();

/** Revalida a conferência preservada contra a fonte e os documentos ainda ativos. */
export async function carregarEstadoOriginalAditivoTx(tx: Prisma.TransactionClient, entrada: { propostaId: string; conferenciaId: string; conferenciaHash: string }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const contexto = await carregarContextoParticipantesAditivoTx(tx, entrada.propostaId);
  const proposta = contexto.proposta;
  const conferencia = await tx.conferenciaParticipantesAditivo.findFirst({ where: { id: entrada.conferenciaId, propostaId: proposta.id }, include: { decisao: true } });
  if (!conferencia) throw new ErroRegra("Conferência de signatários indisponível nesta proposta.");
  if (conferencia.revisaoHash !== entrada.conferenciaHash || hashSubstituicao(conferencia.snapshot) !== conferencia.revisaoHash)
    throw new ErroRegra("Confira a revisão exata dos signatários antes de preservar o original.");
  if (!conferencia.decisao.aprovada || conferencia.decisaoId !== proposta.decisao?.id || conferencia.propostaHash !== proposta.entradaHash)
    throw new ErroRegra("A conferência não corresponde à aprovação atual da proposta.");
  if (await tx.conferenciaParticipantesAditivo.count({ where: { propostaId: proposta.id, versao: { gt: conferencia.versao } } }))
    throw new ErroRegra("Existe conferência de signatários mais recente.");

  const snapshot = SnapshotConferenciaSchema.parse(conferencia.snapshot);
  if (snapshot.propostaId !== proposta.id || snapshot.propostaHash !== proposta.entradaHash || snapshot.decisaoId !== conferencia.decisaoId)
    throw new ErroRegra("O snapshot da conferência não corresponde à proposta aprovada.");
  const ids: string[] = [...new Set([...(snapshot.maioridade ? [snapshot.maioridade.evidenciaDocumentoId] : []), ...snapshot.participantes.flatMap(p => {
    const representacao = z.object({ evidenciaDocumentoId: z.string().min(1) }).passthrough().safeParse(p.representacao);
    return representacao.success ? [representacao.data.evidenciaDocumentoId] : [];
  })].filter((id): id is string => typeof id === "string"))].sort();
  if (ids.length) await tx.$queryRaw`SELECT id FROM "Documento" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
  const documentos = await tx.documento.findMany({ where: { id: { in: ids }, arquivado: false, OR: [{ matriculaId: proposta.matriculaId }, ...(contexto.matricula.leadId ? [{ matriculaId: null, leadId: contexto.matricula.leadId }] : [])] }, select: { id: true, nome: true, url: true, categoria: true } });
  if (documentos.length !== ids.length || documentos.some(d => !d.url.trim())) throw new ErroRegra("Uma evidência da conferência não está mais disponível.");
  const evidenciasSnapshot = new Map(snapshot.documentos.map(d => [d.id, d]));
  if (evidenciasSnapshot.size !== ids.length || ids.some(id => !evidenciasSnapshot.has(id)) || documentos.some(documento => {
    const preservado = evidenciasSnapshot.get(String(documento.id));
    return !preservado || preservado.nome !== documento.nome || preservado.url !== documento.url || preservado.categoria !== documento.categoria;
  })) throw new ErroRegra("A evidência atual diverge da conferência preservada.");
  let conferido: ReturnType<typeof conferirParticipantesAditivo>;
  try {
    conferido = conferirParticipantesAditivo({ regras: contexto.conteudo.assinaturas, contexto: { maioridade: snapshot.maioridade?.classificacao ?? null, pagador: contexto.tipoPagador },
      maioridade: snapshot.maioridade, participantes: snapshot.participantes, identidadesEsperadas: { aluno: contexto.identidadeAluno, pagador: contexto.dadosPagador },
      evidenciasDisponiveisIds: documentos.map(d => String(d.id)) as string[], assinaturasHerdadas: [] });
  } catch (e) { throw new ErroRegra(e instanceof Error ? e.message : "Confira os signatários do aditivo."); }
  const json = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.JsonValue;
  if (hashSubstituicao(json(conferido.plano)) !== hashSubstituicao(json(snapshot.plano)) || hashSubstituicao(json(conferido.participantes)) !== hashSubstituicao(json(snapshot.participantes)))
    throw new ErroRegra("Os participantes conferidos não correspondem mais ao plano atual.");
  return { contexto, proposta, conferencia, documento: ProjecaoAditivoSchema.parse(proposta.snapshot).documento,
    baseHash: hashSubstituicao({ propostaHash: proposta.entradaHash, conferenciaHash: conferencia.revisaoHash }) };
}
