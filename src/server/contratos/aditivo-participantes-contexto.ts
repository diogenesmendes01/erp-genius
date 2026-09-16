import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { carregarBaseAditivoTx } from "./aditivo-estado";
import { ConteudoModeloSchema } from "./modelo-schema";
import { hashSubstituicao } from "./substituicao-estado";
import { exigirAlcadasAditivoTx } from "./aditivo-alcadas-tx";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));

/** Revalida os fatos que sustentam a proposta antes de conferir ou apresentar signatários. */
export async function carregarContextoParticipantesAditivoTx(tx: Prisma.TransactionClient, propostaId: string) {
  const proposta = await tx.propostaAditivoContratual.findUnique({ where: { id: propostaId }, include: { decisao: true, modelo: true } });
  if (!proposta?.decisao?.aprovada || proposta.decisao.propostaHash !== proposta.entradaHash) throw new ErroRegra("A proposta exige aprovação administrativa antes da conferência dos signatários.");
  if (hashSubstituicao(proposta.snapshot) !== proposta.entradaHash) throw new ErroRegra("Confira a versão exata da proposta de aditivo.");
  if (await tx.propostaAditivoContratual.count({ where: { matriculaId: proposta.matriculaId, versao: { gt: proposta.versao } } })) throw new ErroRegra("Existe proposta de aditivo mais recente.");
  const snapshot = proposta.snapshot as Prisma.JsonObject;
  const base = await carregarBaseAditivoTx(tx, snapshot.entrada, proposta.versao);
  const esperado = json({ ...base, versao: proposta.versao, preparadaPorId: proposta.preparadaPorId, motivo: proposta.motivo, entrada: snapshot.entrada });
  if (hashSubstituicao(esperado as unknown as Prisma.JsonValue) !== proposta.entradaHash) throw new ErroRegra("A base do aditivo mudou. Revise a proposta antes dos signatários.");
  await exigirAlcadasAditivoTx(tx, proposta);
  const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: proposta.matriculaId }, select: { alunoId: true, leadId: true } });
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${matricula.alunoId} FOR SHARE`;
  const aluno = await tx.aluno.findUniqueOrThrow({ where: { id: matricula.alunoId }, select: { primeiroNome: true, sobrenome: true, documento: true, email: true } });
  if (!base.base.pagador) throw new ErroRegra("Confira o pagador desta contratação.");
  const pagador = await tx.pagadorPreparacaoMatricula.findUniqueOrThrow({ where: { id: base.base.pagador.id } });
  const tipoPagador = z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).parse(pagador.tipo);
  const identidadeAluno = { nome: [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" "), documento: aluno.documento, email: aluno.email };
  const dadosPagador = z.object({ nome: z.string().nullable().optional(), documento: z.string().nullable().optional(), email: z.string().nullable().optional() }).parse(pagador.dados);
  const identificacoes: Record<string, string | null | undefined> = { ALUNO_NOME: identidadeAluno.nome, ALUNO_DOCUMENTO: aluno.documento, ALUNO_EMAIL: aluno.email, PAGADOR_NOME: dadosPagador.nome, PAGADOR_DOCUMENTO: dadosPagador.documento, PAGADOR_EMAIL: dadosPagador.email };
  for (const alteracao of base.alteracoes) if (alteracao.campo in identificacoes && alteracao.novo !== identificacoes[alteracao.campo]?.trim()) throw new ErroRegra("A identificação atual não corresponde à alteração aprovada. Confira o cadastro e a proposta antes de identificar os signatários.");
  return { proposta, snapshot, base, matricula, tipoPagador, identidadeAluno, dadosPagador, conteudo: ConteudoModeloSchema.parse(proposta.modelo.conteudo) };
}
