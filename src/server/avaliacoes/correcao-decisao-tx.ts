import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { notaVigente } from "./nota-vigente";
import { carregarImpactosProgressaoPorAproveitamentoTx } from "./impactos-progressao-tx";
import { registrarCasosRevisaoProgressaoTx } from "./casos-revisao-progressao-tx";

export const DecisaoCorrecaoSchema = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/),
  impactosHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
export async function revisarCorrecaoNotaTx(tx: Prisma.TransactionClient, autorId: string, propostaId: string) {
  const ref = await tx.propostaCorrecaoNota.findUnique({ where: { id: propostaId }, select: { lancamento: { select: { registro: { select: { alocacaoId: true } } } } } });
  if (!ref) throw new ErroRegra("Proposta não encontrada.");
  const a = await bloquearLancamento(tx, ref.lancamento.registro.alocacaoId);
  await conferirGestorAvaliacao(tx, autorId);
  const p = await tx.propostaCorrecaoNota.findUniqueOrThrow({ where: { id: propostaId }, include: { decisao: true, lancamento: true } });
  const vigente = await notaVigente(tx, p.lancamento);
  const ultima = await tx.propostaCorrecaoNota.findFirstOrThrow({ where: { lancamentoId: p.lancamentoId }, orderBy: { versao: "desc" }, select: { id: true } });
  const serializados = await carregarImpactosProgressaoPorAproveitamentoTx(tx, {
    matriculaId: a.matriculaId,
    alocacaoOrigemId: a.id,
  });
  const impactosHash = createHash("sha256").update(JSON.stringify(serializados)).digest("hex");
  return { a, p, vigente, impactos: serializados, impactosHash, podeAprovar: !p.decisao && p.autorId !== autorId && ultima.id === p.id && p.origemHash === vigente.origemHash };
}
export async function decidirCorrecaoNotaTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof DecisaoCorrecaoSchema>) {
  const d = DecisaoCorrecaoSchema.parse(input), r = await revisarCorrecaoNotaTx(tx, autorId, d.propostaId), p = r.p;
  if (p.autorId === autorId) throw new ErroRegra("Outra pessoa autorizada deve decidir a correção.");
  if (p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira o conteúdo exato da proposta.");
  if (p.decisao) {
    if (p.decisao.decisorId === autorId && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id, aplicada: p.decisao.aprovada };
    throw new ErroRegra("Proposta já decidida.");
  }
  if (d.aprovada && (!r.podeAprovar || r.impactosHash !== d.impactosHash)) throw new ErroRegra("Proposta ou impactos desatualizados. Confira novamente.");
  const decisao = await tx.decisaoCorrecaoNota.create({ data: { propostaId: p.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo, impactos: r.impactos } });
  if (d.aprovada) await registrarCasosRevisaoProgressaoTx(tx, {
    matriculaId: r.a.matriculaId, alocacaoFonteId: r.a.id,
    origem: { tipo: "REGULAR", decisaoId: decisao.id }, impactos: r.impactos,
  });
  await registrarEvento(tx, { tipo: d.aprovada ? "CorrecaoNotaAplicada" : "CorrecaoNotaRejeitada", agregadoTipo: "Matricula", agregadoId: r.a.matriculaId, autorId,
    payload: { propostaId: p.id, decisaoId: decisao.id, lancamentoId: p.lancamentoId, motivo: d.motivo } });
  if (d.aprovada && r.impactos.length) await registrarEvento(tx, { tipo: "CorrecaoNotaRevisaoNecessaria", agregadoTipo: "Matricula", agregadoId: r.a.matriculaId, autorId,
    payload: { decisaoId: decisao.id, solicitacoes: r.impactos.map(i => i.id) } });
  return { id: decisao.id, aplicada: d.aprovada };
}
