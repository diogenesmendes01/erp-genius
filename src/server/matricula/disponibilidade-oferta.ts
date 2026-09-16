"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DataCivilSchema } from "./cobertura";
import { capturarFonteDisponibilidadeOfertaTx, temFonteNegativaDisponibilidade } from "./disponibilidade-oferta-tx";

const DataCivilPersistivel = DataCivilSchema.refine((data) => data >= "0001-01-01", "Data fora do intervalo persistível.");
const TextoMotivo = z.string().trim().min(5).max(2_000);
const TextoEvidencia = z.string().trim().min(5).max(4_000);
const ProporSchema = z.object({
  matriculaId: z.string().min(1), inicio: DataCivilPersistivel, fim: DataCivilPersistivel,
  motivo: TextoMotivo, evidenciaTexto: TextoEvidencia, chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict().refine((dados) => dados.inicio <= dados.fim, { path: ["fim"], message: "O fim não pode ser anterior ao início." });
const DecidirSchema = z.object({ propostaId: z.string().min(1), aprovada: z.boolean(), motivo: TextoMotivo, evidenciaTexto: TextoEvidencia }).strict();
const ConsultarSchema = z.object({ matriculaId: z.string().min(1), pagina: z.number().int().min(1).max(100_000).default(1) }).strict();
const EstadoSchema = z.object({ matriculaId: z.string().min(1), inicio: DataCivilPersistivel, fim: DataCivilPersistivel }).strict().refine((dados) => dados.inicio <= dados.fim, { path: ["fim"], message: "O fim não pode ser anterior ao início." });

const civil = (data: Date) => data.toISOString().slice(0, 10);
const dataUtc = (data: string) => new Date(`${data}T00:00:00.000Z`);
const podePropor = (papeis: Papel[]) => papeis.some((papel) => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
const podeDecidir = (papeis: Papel[]) => papeis.includes(Papel.GERENTE_PEDAGOGICO) || papeis.includes(Papel.ADMINISTRADOR);
const podeConsultar = (papeis: Papel[]) => podePropor(papeis) || papeis.includes(Papel.FINANCEIRO);

async function conferirAutor(tx: Prisma.TransactionClient, usuarioId: string, modo: "PROPOR" | "DECIDIR" | "CONSULTAR") {
  if (modo !== "CONSULTAR") await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  const autorizado = modo === "PROPOR" ? podePropor(usuario?.papeis ?? []) : modo === "DECIDIR" ? podeDecidir(usuario?.papeis ?? []) : podeConsultar(usuario?.papeis ?? []);
  if (!usuario?.ativo || !autorizado) throw new ErroPermissao();
  return usuario;
}

async function bloquearContexto(tx: Prisma.TransactionClient, matriculaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
}

function projetar(proposta: { id: string; inicio: Date; fim: Date; versao: number; motivo: string; evidenciaTexto: string; criadaEm: Date; decisao?: { id: string; aprovada: boolean; motivo: string; evidenciaTexto: string; decididaEm: Date } | null }) {
  return { id: proposta.id, inicio: civil(proposta.inicio), fim: civil(proposta.fim), versao: proposta.versao, motivo: proposta.motivo, evidenciaTexto: proposta.evidenciaTexto, criadaEm: proposta.criadaEm.toISOString(), decisao: proposta.decisao ? { ...proposta.decisao, decididaEm: proposta.decisao.decididaEm.toISOString() } : null };
}

/** Provisão positiva auditável. Ainda não é autorização de saldo, financeiro ou emissão. */
export async function proporDisponibilidadeOferta(input: z.input<typeof ProporSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = ProporSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);
    return prisma.$transaction(async (tx) => {
      await bloquearContexto(tx, dados.matriculaId);
      await conferirAutor(tx, sessao.id, "PROPOR");
      const repetida = await tx.propostaDisponibilidadeOfertaMatricula.findUnique({ where: { autorId_chaveIdempotencia: { autorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia } }, include: { decisao: true } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave de idempotência já usada para outra proposta de disponibilidade.");
        return projetar(repetida);
      }
      const inicio = dataUtc(dados.inicio), fim = dataUtc(dados.fim);
      const ultima = await tx.propostaDisponibilidadeOfertaMatricula.findFirst({ where: { matriculaId: dados.matriculaId, inicio, fim }, orderBy: { versao: "desc" }, select: { versao: true, decisao: { select: { id: true } } } });
      if (ultima?.decisao === null) throw new ErroRegra("A versão mais recente deste período ainda aguarda decisão independente.");
      const origem = await capturarFonteDisponibilidadeOfertaTx(tx, { matriculaId: dados.matriculaId, inicio, fim });
      const proposta = await tx.propostaDisponibilidadeOfertaMatricula.create({ data: { matriculaId: dados.matriculaId, inicio, fim, versao: (ultima?.versao ?? 0) + 1, motivo: dados.motivo, evidenciaTexto: dados.evidenciaTexto, origem, origemHash: hashSubstituicao(origem), autorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "DisponibilidadeOfertaProposta", agregadoTipo: "Matricula", agregadoId: dados.matriculaId, autorId: sessao.id, payload: { propostaId: proposta.id, inicio: dados.inicio, fim: dados.fim, versao: proposta.versao } });
      return projetar(proposta);
    }, { timeout: 20_000 });
  });
}

/** Decide uma versão exata e exige que negativas e agenda ainda sejam as mesmas fontes conferidas. */
export async function decidirDisponibilidadeOferta(input: z.input<typeof DecidirSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = DecidirSchema.parse(input), entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.propostaDisponibilidadeOfertaMatricula.findUnique({ where: { id: dados.propostaId }, select: { matriculaId: true } });
    if (!referencia) throw new ErroRegra("Proposta de disponibilidade não encontrada.");
    return prisma.$transaction(async (tx) => {
      await bloquearContexto(tx, referencia.matriculaId);
      await tx.$queryRaw`SELECT id FROM "PropostaDisponibilidadeOfertaMatricula" WHERE id = ${dados.propostaId} FOR UPDATE`;
      const proposta = await tx.propostaDisponibilidadeOfertaMatricula.findFirst({ where: { id: dados.propostaId, matriculaId: referencia.matriculaId }, include: { decisao: true } });
      if (!proposta) throw new ErroRegra("Proposta de disponibilidade não encontrada nesta matrícula.");
      await conferirAutor(tx, sessao.id, "DECIDIR");
      if (proposta.autorId === sessao.id) throw new ErroRegra("Outra pessoa deve decidir a proposta de disponibilidade.");
      if (proposta.decisao) {
        if (proposta.decisao.decisorId === sessao.id && proposta.decisao.entradaHash === entradaHash && proposta.decisao.aprovada === dados.aprovada && proposta.decisao.motivo === dados.motivo && proposta.decisao.evidenciaTexto === dados.evidenciaTexto) return projetar(proposta);
        throw new ErroRegra("A proposta já possui decisão imutável divergente.");
      }
      const nova = await tx.propostaDisponibilidadeOfertaMatricula.findFirst({ where: { matriculaId: proposta.matriculaId, inicio: proposta.inicio, fim: proposta.fim, versao: { gt: proposta.versao } }, select: { id: true } });
      if (nova) throw new ErroRegra("Há versão mais recente deste período; decida a fonte atual.");
      const origemAtual = await capturarFonteDisponibilidadeOfertaTx(tx, proposta);
      if (dados.aprovada && (proposta.origemHash !== hashSubstituicao(origemAtual) || temFonteNegativaDisponibilidade(origemAtual))) throw new ErroRegra("A fonte de indisponibilidade mudou ou ainda exige conferência; prepare nova versão.");
      const decisao = await tx.decisaoDisponibilidadeOfertaMatricula.create({ data: { propostaId: proposta.id, decisorId: sessao.id, aprovada: dados.aprovada, motivo: dados.motivo, evidenciaTexto: dados.evidenciaTexto, entradaHash } });
      await registrarEvento(tx, { tipo: "DisponibilidadeOfertaDecidida", agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId: sessao.id, payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: dados.aprovada, versao: proposta.versao } });
      return projetar({ ...proposta, decisao });
    }, { timeout: 20_000 });
  });
}

export async function consultarDisponibilidadesOferta(input: z.input<typeof ConsultarSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = ConsultarSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const autor = await conferirAutor(tx, sessao.id, "CONSULTAR");
      const itens = await tx.propostaDisponibilidadeOfertaMatricula.findMany({ where: { matriculaId: dados.matriculaId }, orderBy: [{ inicio: "desc" }, { fim: "desc" }, { versao: "desc" }], skip: (dados.pagina - 1) * 20, take: 21, include: { decisao: true } });
      return { pagina: dados.pagina, temProxima: itens.length > 20, podePropor: podePropor(autor.papeis), propostas: itens.slice(0, 20).map((proposta) => ({ ...projetar(proposta), podeDecidir: proposta.decisao === null && proposta.autorId !== sessao.id && podeDecidir(autor.papeis) })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
