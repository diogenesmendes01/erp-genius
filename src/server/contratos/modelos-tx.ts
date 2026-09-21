import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { PrepararModeloSchema } from "./modelo-schema";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function conferirAutor(tx: Prisma.TransactionClient, id: string, decidir = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => p === Papel.ADMINISTRADOR || (!decidir && p === Papel.SECRETARIA_ACADEMICA))) throw new ErroPermissao();
}

export async function prepararModeloTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof PrepararModeloSchema>) {
  const d = PrepararModeloSchema.parse(input);
  // Serializa tanto versões da família quanto reenvios do mesmo autor.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`modelo-autor:${autorId}`}, 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`modelo-codigo:${d.codigo}`}, 0))`;
  await conferirAutor(tx, autorId);
  const anterior = await tx.versaoModeloContratual.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outra proposta.");
    return { id: anterior.id, versao: anterior.versao };
  }
  const ultima = await tx.versaoModeloContratual.findFirst({ where: { codigo: d.codigo }, orderBy: { versao: "desc" } });
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("O modelo recebeu nova versão. Atualize e confira a proposta.");
  const proposta = await tx.versaoModeloContratual.create({ data: {
    codigo: d.codigo, versao: d.versaoEsperada + 1, preparadorId: autorId,
    conteudo: d.conteudo, conteudoHash: hash(d.conteudo), motivo: d.motivo,
    chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d),
  } });
  await registrarEvento(tx, { tipo: "ModeloContratualProposto", agregadoTipo: "ModeloContratual", agregadoId: proposta.id, autorId: autorId, payload: { codigo: proposta.codigo, versao: proposta.versao, conteudoHash: proposta.conteudoHash, motivo: d.motivo } });
  return { id: proposta.id, versao: proposta.versao };
}
