import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { ConferirParticipantesAditivoSchema, conferirParticipantesAditivo } from "./aditivo-participantes-schema";
import { carregarContextoParticipantesAditivoTx } from "./aditivo-participantes-contexto";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));
export async function conferirParticipantesAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = ConferirParticipantesAditivoSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId);
  const entradaHash = hashSubstituicao(json(d) as Prisma.JsonObject);
  const repetida = await tx.conferenciaParticipantesAditivo.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra conferência de aditivo.");
    return { id: repetida.id, versao: repetida.versao, revisaoHash: repetida.revisaoHash };
  }
  const contexto = await carregarContextoParticipantesAditivoTx(tx, d.propostaId), p = contexto.proposta;
  if (p.entradaHash !== d.propostaHashEsperado) throw new ErroRegra("Confira a versão exata da proposta de aditivo.");
  const ultima = await tx.conferenciaParticipantesAditivo.findFirst({ where: { propostaId: p.id }, orderBy: { versao: "desc" }, select: { versao: true } });
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Os signatários receberam outra conferência. Atualize a revisão.");
  const m = contexto.matricula;
  const ids = [...new Set([...(d.maioridade ? [d.maioridade.evidenciaDocumentoId] : []), ...d.participantes.flatMap(p => p.representacao ? [p.representacao.evidenciaDocumentoId] : [])])].sort();
  if (ids.length) await tx.$queryRaw`SELECT id FROM "Documento" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
  const documentos = await tx.documento.findMany({ where: { id: { in: ids }, arquivado: false,
    OR: [{ matriculaId: p.matriculaId }, ...(m.leadId ? [{ matriculaId: null, leadId: m.leadId }] : [])] }, select: { id: true, nome: true, url: true, categoria: true } });
  if (documentos.some(d => !d.url.trim())) throw new ErroRegra("Documento de evidência indisponível.");
  let conferido: ReturnType<typeof conferirParticipantesAditivo>;
  try {
    conferido = conferirParticipantesAditivo({ regras: contexto.conteudo.assinaturas, contexto: { maioridade: d.maioridade?.classificacao ?? null, pagador: contexto.tipoPagador },
      maioridade: d.maioridade, participantes: d.participantes, identidadesEsperadas: { aluno: contexto.identidadeAluno, pagador: contexto.dadosPagador },
      evidenciasDisponiveisIds: documentos.map(d => d.id), assinaturasHerdadas: [] });
  } catch (e) { throw new ErroRegra(e instanceof Error ? e.message : "Confira os signatários do aditivo."); }
  const decisao = p.decisao;
  if (!decisao) throw new ErroRegra("A proposta exige decisão administrativa.");
  const snapshot = json({ propostaId: p.id, propostaHash: p.entradaHash, decisaoId: decisao.id, maioridade: d.maioridade,
    ...conferido, documentos, identificacoesConferidas: true });
  const revisaoHash = hashSubstituicao(snapshot as Prisma.JsonObject);
  const c = await tx.conferenciaParticipantesAditivo.create({ data: { propostaId: p.id, decisaoId: decisao.id, autorId,
    versao: d.versaoEsperada + 1, propostaHash: p.entradaHash, snapshot, revisaoHash, entradaHash, chaveIdempotencia: d.chaveIdempotencia, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: "ParticipantesAditivoConferidos", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId,
    payload: { propostaId: p.id, conferenciaId: c.id, versao: c.versao, papeis: conferido.participantes.map(p => p.papel) } });
  return { id: c.id, versao: c.versao, revisaoHash };
}
