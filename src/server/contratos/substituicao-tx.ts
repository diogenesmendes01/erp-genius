import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarContextoSubstituicaoTx, hashSubstituicao } from "./substituicao-estado";
import { DecidirSubstituicaoContratualSchema, PrepararSubstituicaoContratualSchema } from "./substituicao-schema";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));

async function conferirAtor(tx: Prisma.TransactionClient, autorId: string, decidir = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId, decidir);
}

/** Primitivas internas. O autor vem da sessão conferida pelo chamador; não há
 * envio/cancelamento externo nem efeito financeiro em nenhuma destas operações. */
export async function prepararSubstituicaoContratualTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = PrepararSubstituicaoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await conferirAtor(tx, autorId);
  const anterior = await tx.propostaSubstituicaoContratual.findUnique({ where: { preparadaPorId_chaveIdempotencia: { preparadaPorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    const snapshot = anterior.snapshot as Prisma.JsonObject;
    if (!snapshot.entrada || hashSubstituicao(snapshot.entrada) !== hashSubstituicao(json(d) as Prisma.JsonObject)) throw new ErroRegra("Chave de substituição já utilizada com outra proposta.");
    return { id: anterior.id, versao: anterior.versao, propostaHash: anterior.entradaHash };
  }
  const contexto = await carregarContextoSubstituicaoTx(tx, d);
  const ultima = await tx.propostaSubstituicaoContratual.findFirst({ where: { processoFonteId: contexto.processoFonteId }, orderBy: { versao: "desc" }, select: { versao: true } });
  const versao = (ultima?.versao ?? 0) + 1;
  const snapshot = json({ ...contexto, versao, preparadaPorId: autorId, motivo: d.motivo, entrada: d });
  const entradaHash = hashSubstituicao(snapshot as Prisma.JsonObject);
  const proposta = await tx.propostaSubstituicaoContratual.create({ data: {
    ...contexto, diferencas: json(contexto.diferencas), versao, preparadaPorId: autorId, motivo: d.motivo,
    snapshot, entradaHash, chaveIdempotencia: d.chaveIdempotencia,
  } });
  await registrarEvento(tx, { tipo: "SubstituicaoContratualProposta", agregadoTipo: "Matricula", agregadoId: contexto.matriculaId, autorId,
    payload: { propostaId: proposta.id, processoFonteId: contexto.processoFonteId, versao, propostaHash: entradaHash, motivo: d.motivo } });
  return { id: proposta.id, versao, propostaHash: entradaHash };
}

export async function decidirSubstituicaoContratualTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = DecidirSubstituicaoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const proposta = await tx.propostaSubstituicaoContratual.findUnique({ where: { id: d.propostaId }, include: { decisao: true } });
  if (!proposta) throw new ErroRegra("Proposta de substituição não encontrada.");
  // Mesma ordem dos triggers: calendário, matrícula, processo, usuário.
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${proposta.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${proposta.processoFonteId} FOR UPDATE`;
  await conferirAtor(tx, autorId, true);
  if (autorId === proposta.preparadaPorId) throw new ErroRegra("Outra pessoa da Administração deve decidir esta proposta.");
  if (d.propostaHashEsperado !== proposta.entradaHash || hashSubstituicao(proposta.snapshot) !== proposta.entradaHash) throw new ErroRegra("A decisão não corresponde à proposta revisada.");
  if (proposta.decisao) {
    const anterior = proposta.decisao;
    if (anterior.decisorId !== autorId || anterior.aprovada !== d.aprovada || anterior.motivo !== d.motivo || anterior.propostaHash !== d.propostaHashEsperado) throw new ErroRegra("A proposta já recebeu outra decisão.");
    return { id: anterior.id, aprovada: anterior.aprovada };
  }
  if (d.aprovada) {
    const maisNova = await tx.propostaSubstituicaoContratual.findFirst({ where: { processoFonteId: proposta.processoFonteId, versao: { gt: proposta.versao } }, select: { id: true } });
    if (maisNova) throw new ErroRegra("Existe proposta de substituição mais recente.");
    const snapshot = proposta.snapshot as Prisma.JsonObject;
    const contexto = await carregarContextoSubstituicaoTx(tx, snapshot.entrada);
    const esperado = json({ ...contexto, versao: proposta.versao, preparadaPorId: proposta.preparadaPorId, motivo: proposta.motivo, entrada: snapshot.entrada });
    if (hashSubstituicao(esperado as Prisma.JsonObject) !== proposta.entradaHash) throw new ErroRegra("As condições da proposta mudaram. Prepare e confira uma nova versão.");
  }
  // A rejeição conserva o parecer mesmo se as condições deixaram de ser atuais.
  const decisao = await tx.decisaoSubstituicaoContratual.create({ data: { propostaId: proposta.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo, propostaHash: proposta.entradaHash } });
  await registrarEvento(tx, { tipo: "SubstituicaoContratualDecidida", agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId,
    payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: d.aprovada, propostaHash: proposta.entradaHash, motivo: d.motivo } });
  return { id: decisao.id, aprovada: decisao.aprovada };
}
