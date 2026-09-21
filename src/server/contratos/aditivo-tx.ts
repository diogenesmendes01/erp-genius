import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarBaseAditivoTx } from "./aditivo-estado";
import { bloquearFontePropostaTx } from "./fonte-contratual-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { DecidirAditivoContratualSchema, PrepararAditivoContratualSchema } from "./aditivo-schema";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));
async function conferirAtor(tx: Prisma.TransactionClient, id: string, decidir = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${id} FOR SHARE`;
  await conferirAutor(tx, id, decidir);
}

/** Serviços internos. Identidade vem da sessão; aprovação administrativa não
 * substitui alçadas específicas, assinaturas, conferência ou aplicação. */
export async function prepararAditivoContratualTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = PrepararAditivoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await conferirAtor(tx, autorId);
  const anterior = await tx.propostaAditivoContratual.findUnique({ where: { preparadaPorId_chaveIdempotencia: { preparadaPorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    const s = anterior.snapshot as Prisma.JsonObject;
    if (!s.entrada || hashSubstituicao(s.entrada) !== hashSubstituicao(json(d) as Prisma.JsonObject)) throw new ErroRegra("Chave já utilizada com outra proposta de aditivo.");
    return { id: anterior.id, versao: anterior.versao, propostaHash: anterior.entradaHash };
  }
  const contexto = await carregarBaseAditivoTx(tx, d);
  const agenda = d.alteracoes.find(a => a.origem === "AGENDA_PARTICULAR")?.valorEstruturado;
  const propostaAgendaId = agenda?.tipo === "AGENDA" ? agenda.propostaAgendaId : undefined;
  const ultima = await tx.propostaAditivoContratual.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
  const versao = (ultima?.versao ?? 0) + 1;
  const snapshot = json({ ...contexto, versao, preparadaPorId: autorId, motivo: d.motivo, entrada: d });
  const entradaHash = hashSubstituicao(snapshot as Prisma.JsonObject);
  const proposta = await tx.propostaAditivoContratual.create({ data: {
    matriculaId: d.matriculaId, conclusaoOriginalId: contexto.conclusaoOriginalId, origemHistoricaId: contexto.origemHistoricaId, modeloId: d.modeloId,
    versao, preparadaPorId: autorId, vigenciaInicio: new Date(contexto.vigenciaInicio), motivo: d.motivo,
    baseHash: contexto.baseHash, alteracoesHash: contexto.alteracoesHash, snapshot, entradaHash, chaveIdempotencia: d.chaveIdempotencia, propostaAgendaId,
  } });
  await registrarEvento(tx, { tipo: "AditivoContratualProposto", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId,
    payload: { propostaId: proposta.id, versao, propostaHash: entradaHash, motivo: d.motivo } });
  return { id: proposta.id, versao, propostaHash: entradaHash };
}

export async function decidirAditivoContratualTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = DecidirAditivoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const p = await tx.propostaAditivoContratual.findUnique({ where: { id: d.propostaId }, include: { decisao: true } });
  if (!p) throw new ErroRegra("Proposta de aditivo não encontrada.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${p.matriculaId} FOR UPDATE`;
  await bloquearFontePropostaTx(tx, p);
  await conferirAtor(tx, autorId, true);
  if (autorId === p.preparadaPorId) throw new ErroRegra("Outra pessoa da Administração deve decidir esta proposta.");
  if (p.entradaHash !== d.propostaHashEsperado || hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A decisão não corresponde à proposta revisada.");
  if (p.decisao) {
    if (p.decisao.decisorId !== autorId || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo) throw new ErroRegra("A proposta já recebeu outra decisão.");
    return { id: p.decisao.id, aprovada: p.decisao.aprovada };
  }
  if (d.aprovada) {
    if (await tx.propostaAditivoContratual.count({ where: { matriculaId: p.matriculaId, versao: { gt: p.versao } } })) throw new ErroRegra("Existe proposta de aditivo mais recente.");
    const s = p.snapshot as Prisma.JsonObject;
    const contexto = await carregarBaseAditivoTx(tx, s.entrada, p.versao);
    const esperado = json({ ...contexto, versao: p.versao, preparadaPorId: p.preparadaPorId, motivo: p.motivo, entrada: s.entrada });
    if (hashSubstituicao(esperado as Prisma.JsonObject) !== p.entradaHash) throw new ErroRegra("A base do aditivo mudou. Prepare uma nova proposta.");
  }
  const decisao = await tx.decisaoAditivoContratual.create({ data: { propostaId: p.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo, propostaHash: p.entradaHash } });
  await registrarEvento(tx, { tipo: "AditivoContratualDecidido", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId,
    payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada, propostaHash: p.entradaHash, motivo: d.motivo } });
  return { id: decisao.id, aprovada: decisao.aprovada };
}
