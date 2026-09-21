import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { ConteudoRegraAvaliacaoSchema, DecidirRegraAvaliacaoSchema, PrepararRegraAvaliacaoSchema } from "./regra-schema";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function conferirGestorAvaliacao(tx: Prisma.TransactionClient, autorId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

export async function prepararRegraAvaliacaoTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof PrepararRegraAvaliacaoSchema>) {
  const d = PrepararRegraAvaliacaoSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-autor:${autorId}`}, 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${d.nivelId}`}, 0))`;
  await conferirGestorAvaliacao(tx, autorId);
  const anterior = await tx.versaoRegraAvaliacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outra proposta de avaliação.");
    return { id: anterior.id, versao: anterior.versao };
  }
  if (!await tx.nivel.findUnique({ where: { id: d.nivelId }, select: { id: true } })) throw new ErroRegra("Nível não encontrado.");
  const ultima = await tx.versaoRegraAvaliacao.findFirst({ where: { nivelId: d.nivelId }, orderBy: { versao: "desc" }, select: { versao: true } });
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("As regras receberam nova versão. Atualize a proposta.");
  const r = await tx.versaoRegraAvaliacao.create({ data: {
    nivelId: d.nivelId, versao: d.versaoEsperada + 1, preparadorId: autorId,
    conteudo: d.conteudo, conteudoHash: hash(d.conteudo), motivo: d.motivo,
    chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d),
  } });
  await registrarEvento(tx, { tipo: "RegraAvaliacaoProposta", agregadoTipo: "RegraAvaliacao", agregadoId: r.id, autorId,
    payload: { nivelId: r.nivelId, versao: r.versao, conteudoHash: r.conteudoHash, motivo: d.motivo } });
  return { id: r.id, versao: r.versao };
}

export async function decidirRegraAvaliacaoTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof DecidirRegraAvaliacaoSchema>) {
  const d = DecidirRegraAvaliacaoSchema.parse(input);
  const ref = await tx.versaoRegraAvaliacao.findUnique({ where: { id: d.regraId }, select: { nivelId: true } });
  if (!ref) throw new ErroRegra("Regra não encontrada.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${ref.nivelId}`}, 0))`;
  await conferirGestorAvaliacao(tx, autorId);
  const r = await tx.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: d.regraId }, include: { decisao: true } });
  if (r.preparadorId === autorId) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa decidir.");
  // JSONB não preserva ordem de chaves: conferir conteúdo normalizado pelo schema.
  if (r.conteudoHash !== d.conteudoHash || hash(ConteudoRegraAvaliacaoSchema.parse(r.conteudo)) !== r.conteudoHash) throw new ErroRegra("Confira o conteúdo exato antes de decidir.");
  if (r.decisao) {
    if (r.decisao.decisorId === autorId && r.decisao.aprovada === d.aprovada && r.decisao.motivo === d.motivo) return { id: r.decisao.id };
    throw new ErroRegra("Esta versão já possui decisão. Prepare outra versão para alterações.");
  }
  ConteudoRegraAvaliacaoSchema.parse(r.conteudo);
  if (d.aprovada) {
    const ultima = await tx.versaoRegraAvaliacao.findFirstOrThrow({ where: { nivelId: r.nivelId }, orderBy: { versao: "desc" }, select: { id: true } });
    if (ultima.id !== r.id) throw new ErroRegra("Existe proposta mais recente. Confira a versão atual antes de publicar.");
  }
  const decisao = await tx.decisaoRegraAvaliacao.create({ data: { regraId: r.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: d.aprovada ? "RegraAvaliacaoPublicada" : "RegraAvaliacaoRejeitada", agregadoTipo: "RegraAvaliacao", agregadoId: r.id, autorId,
    payload: { decisaoId: decisao.id, nivelId: r.nivelId, versao: r.versao, conteudoHash: r.conteudoHash, motivo: d.motivo } });
  return { id: decisao.id };
}
