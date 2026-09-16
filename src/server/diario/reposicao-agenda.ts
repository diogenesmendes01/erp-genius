"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { criarAvisosAlteracaoAgendaTx } from "@/server/comunicacoes-agenda/avisos";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataHoraAvaliacaoSchema, instanteAvaliacaoLocal } from "@/server/avaliacoes/tempo";
import { conferirAgendaReposicaoIndividualTx, exigirAtorAgendaAtual, hashAgendaReposicao, instanteUtcAgendaReposicao, vigenciaNovoBeneficioReposicao, reposicaoAgendaTx, textoAgendaReposicao, type RegraBeneficio } from "./reposicao-agenda-tx";

const id = z.string().min(1).max(100);
const chave = z.string().min(8).max(100);
const regraInput = z.object({ produtoPaisId: id, permiteParticular: z.boolean(), referencia: z.enum(["CIVIL", "CICLO_MATRICULA"]), unidade: z.enum(["DIAS", "MESES"]),
  duracaoPeriodo: z.number().int().positive().max(120000), quantidadePorPeriodo: z.number().int().min(0).max(1000),
  antecedenciaCancelamentoMinutos: z.number().int().min(0).max(5256000), motivo: textoAgendaReposicao, chaveIdempotencia: chave }).strict();
const agendaInput = z.object({ reposicaoId: id, professorId: id, inicioLocal: DataHoraAvaliacaoSchema, fimLocal: DataHoraAvaliacaoSchema, fuso: FusoInstitucionalSchema, autorizacaoExcecaoId: id.optional(), motivo: textoAgendaReposicao, chaveIdempotencia: chave }).strict();
const previaAgendaInput = agendaInput.pick({ reposicaoId: true, professorId: true, inicioLocal: true, fimLocal: true, fuso: true, autorizacaoExcecaoId: true }).strict();
const excecaoInput = agendaInput.extend({ evidencia: textoAgendaReposicao }).strict();
const propostaCancelamentoInput = z.object({ agendaId: id, motivo: textoAgendaReposicao, evidencia: textoAgendaReposicao, chaveIdempotencia: chave }).strict();
const decisaoCancelamentoInput = z.object({ propostaId: id, aprovar: z.boolean(), motivo: textoAgendaReposicao }).strict();
const propostaRemarcacaoInput = z.object({ agendaId: id, professorId: id, inicioLocal: DataHoraAvaliacaoSchema, fimLocal: DataHoraAvaliacaoSchema, fuso: FusoInstitucionalSchema, motivo: textoAgendaReposicao, evidencia: textoAgendaReposicao, chaveIdempotencia: chave }).strict();
const decisaoRemarcacaoInput = z.object({ propostaId: id, aprovar: z.boolean(), motivo: textoAgendaReposicao }).strict();

type RegraOferta = RegraBeneficio & { permiteParticular: boolean; produtoPaisId: string };
const dataCivil = (valor: Date) => valor.toISOString().slice(0, 10);
const dataSql = (valor: string) => Prisma.sql`${valor}::date`;

/** Q14/Q49: gestão propõe a regra da oferta, sem alterar snapshots existentes. */
export async function proporRegraBeneficioReposicaoOferta(input: z.input<typeof regraInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = regraInput.parse(input), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ProdutoPais" WHERE id=${d.produtoPaisId} FOR UPDATE`;
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaRegraBeneficioReposicaoOferta" WHERE "autorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia}`);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra regra de benefício."); return { id: repetida.id }; }
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "PropostaRegraBeneficioReposicaoOferta" WHERE "produtoPaisId"=${d.produtoPaisId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const novoId = randomUUID(), versao = (ultima?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`INSERT INTO "PropostaRegraBeneficioReposicaoOferta" (id,"produtoPaisId",versao,"permiteParticular",referencia,unidade,"duracaoPeriodo","quantidadePorPeriodo","antecedenciaCancelamentoMinutos","autorId",motivo,"chaveIdempotencia","entradaHash") VALUES (${novoId},${d.produtoPaisId},${versao},${d.permiteParticular},${d.referencia}::"ReferenciaPeriodoBeneficioReposicao",${d.unidade}::"UnidadePeriodoBeneficioReposicao",${d.duracaoPeriodo},${d.quantidadePorPeriodo},${d.antecedenciaCancelamentoMinutos},${autor.id},${d.motivo},${d.chaveIdempotencia},${entradaHash})`);
      await registrarEvento(tx, { tipo: "RegraBeneficioReposicaoProposta", agregadoTipo: "ProdutoPais", agregadoId: d.produtoPaisId, autorId: autor.id, payload: { regraId: novoId, versao } });
      return { id: novoId, versao };
    });
  });
}

/** Q11 aplicado à regra: o autor da versão não escolhe sua vigência. */
export async function decidirRegraBeneficioReposicaoOferta(input: { regraId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ regraId: id, aprovar: z.boolean(), motivo: textoAgendaReposicao }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const [r] = await tx.$queryRaw<{ id: string; autorId: string; produtoPaisId: string }[]>(Prisma.sql`SELECT id,"autorId" AS "autorId","produtoPaisId" AS "produtoPaisId" FROM "PropostaRegraBeneficioReposicaoOferta" WHERE id=${d.regraId} FOR UPDATE`);
      if (!r) throw new ErroRegra("Regra de benefício não encontrada.");
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      if (r.autorId === autor.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a regra.");
      const [atual] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoRegraBeneficioReposicaoOferta" WHERE "propostaId"=${r.id}`);
      if (atual) { if (atual.decisorId === autor.id && atual.aprovada === d.aprovar && atual.motivo === d.motivo) return { id: atual.id, aprovada: atual.aprovada }; throw new ErroRegra("A regra já foi decidida."); }
      const novoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoRegraBeneficioReposicaoOferta" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${novoId},${r.id},${autor.id},${d.aprovar},${d.motivo})`);
      await registrarEvento(tx, { tipo: "RegraBeneficioReposicaoDecidida", agregadoTipo: "ProdutoPais", agregadoId: r.produtoPaisId, autorId: autor.id, payload: { regraId: r.id, decisaoId: novoId, aprovada: d.aprovar } });
      return { id: novoId, aprovada: d.aprovar };
    });
  });
}

/** Q50/Q61: herda uma regra aprovada para o vínculo, somente no próximo período. */
export async function aplicarBeneficioReposicaoParticularMatricula(input: { matriculaId: string; regraId: string; referenciaCiclo?: string; motivo: string; chaveIdempotencia: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ matriculaId: id, regraId: id, referenciaCiclo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), motivo: textoAgendaReposicao, chaveIdempotencia: chave }).strict().parse(input), entradaHash = hashAgendaReposicao(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${d.matriculaId} FOR UPDATE`;
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "BeneficioReposicaoParticularMatricula" WHERE "aplicadoPorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia}`);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outro snapshot de benefício."); return { id: repetida.id }; }
      const [m] = await tx.$queryRaw<{ produtoId: string; paisId: string; status: string }[]>(Prisma.sql`SELECT "produtoId" AS "produtoId","paisId" AS "paisId",status::text AS status FROM "Matricula" WHERE id=${d.matriculaId}`);
      const [oferta] = await tx.$queryRaw<RegraOferta[]>(Prisma.sql`SELECT r.id,r."produtoPaisId" AS "produtoPaisId",r."permiteParticular" AS "permiteParticular",r.referencia::text AS referencia,r.unidade::text AS unidade,r."duracaoPeriodo" AS "duracaoPeriodo",r."quantidadePorPeriodo" AS "quantidadePorPeriodo",r."antecedenciaCancelamentoMinutos" AS "antecedenciaCancelamentoMinutos",NULL::date AS "referenciaCiclo",CURRENT_DATE AS "vigenteAPartirDe" FROM "PropostaRegraBeneficioReposicaoOferta" r JOIN "DecisaoRegraBeneficioReposicaoOferta" decisao ON decisao."propostaId"=r.id AND decisao.aprovada JOIN "ProdutoPais" o ON o.id=r."produtoPaisId" WHERE r.id=${d.regraId} AND o."produtoId"=${m?.produtoId ?? ""} AND o."paisId"=${m?.paisId ?? ""} FOR SHARE`);
      if (!m || m.status !== "ATIVA" || !oferta?.permiteParticular) throw new ErroRegra("A matrícula ativa precisa de regra particular aprovada da própria oferta.");
      const operacao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      if (!operacao?.fusoInstitucional) throw new ErroRegra("Configure o fuso institucional antes de aplicar benefício.");
      if (oferta.referencia === "CICLO_MATRICULA" && !d.referenciaCiclo) throw new ErroRegra("O ciclo exige data de referência registrada para esta matrícula.");
      if (oferta.referencia === "CIVIL" && d.referenciaCiclo) throw new ErroRegra("Regra civil não recebe data de referência de ciclo.");
      oferta.referenciaCiclo = d.referenciaCiclo ? new Date(`${d.referenciaCiclo}T00:00:00.000Z`) : null;
      const hoje = dataCivilInstitucional(new Date(), operacao.fusoInstitucional);
      oferta.vigenteAPartirDe = new Date(`${hoje}T00:00:00.000Z`);
      const [anterior] = await tx.$queryRaw<RegraBeneficio[]>(Prisma.sql`SELECT id,referencia::text AS referencia,unidade::text AS unidade,"duracaoPeriodo" AS "duracaoPeriodo","quantidadePorPeriodo" AS "quantidadePorPeriodo","antecedenciaCancelamentoMinutos" AS "antecedenciaCancelamentoMinutos","referenciaCiclo" AS "referenciaCiclo","vigenteAPartirDe" AS "vigenteAPartirDe" FROM "BeneficioReposicaoParticularMatricula" WHERE "matriculaId"=${d.matriculaId} ORDER BY "vigenteAPartirDe" DESC LIMIT 1 FOR SHARE`);
      const referenciaAnterior = anterior ? dataCivil(anterior.vigenteAPartirDe) : hoje;
      const vigente = vigenciaNovoBeneficioReposicao(anterior ?? null, oferta, referenciaAnterior > hoje ? referenciaAnterior : hoje);
      const novoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "BeneficioReposicaoParticularMatricula" (id,"matriculaId","regraOfertaId",referencia,unidade,"duracaoPeriodo","referenciaCiclo","quantidadePorPeriodo","antecedenciaCancelamentoMinutos","vigenteAPartirDe","aplicadoPorId",motivo,"chaveIdempotencia","entradaHash") VALUES (${novoId},${d.matriculaId},${oferta.id},${oferta.referencia}::"ReferenciaPeriodoBeneficioReposicao",${oferta.unidade}::"UnidadePeriodoBeneficioReposicao",${oferta.duracaoPeriodo},${oferta.referenciaCiclo ? dataSql(dataCivil(oferta.referenciaCiclo)) : null},${oferta.quantidadePorPeriodo},${oferta.antecedenciaCancelamentoMinutos},${dataSql(vigente)},${autor.id},${d.motivo},${d.chaveIdempotencia},${entradaHash})`);
      await registrarEvento(tx, { tipo: "BeneficioReposicaoAplicado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { beneficioId: novoId, regraId: oferta.id, vigenteAPartirDe: vigente } });
      return { id: novoId, vigenteAPartirDe: vigente };
    });
  });
}

/** Q19: Secretaria propõe exceção somente para um intervalo já conferível. */
export async function proporExcecaoAgendaReposicaoIndividual(input: z.input<typeof excecaoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = excecaoInput.parse(input), inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: d.reposicaoId, professorId: d.professorId, inicio, fim, fuso: d.fuso, permitirSemBeneficio: true });
      if (!c.diasNaoLetivos.length) throw new ErroRegra("Este intervalo é letivo e não requer exceção.");
      if (c.jaAgendada) throw new ErroRegra("A reposição já possui agenda vinculada.");
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "ExcecaoAgendaReposicaoIndividual" WHERE "solicitanteId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia}`);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra exceção."); return { id: repetida.id }; }
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "ExcecaoAgendaReposicaoIndividual" WHERE "reposicaoId"=${c.reposicao.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const novoId = randomUUID(), versao = (ultima?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`INSERT INTO "ExcecaoAgendaReposicaoIndividual" (id,"reposicaoId","professorId",inicio,fim,"fusoOrigem","solicitanteId",versao,motivo,evidencia,"chaveIdempotencia","entradaHash") VALUES (${novoId},${c.reposicao.id},${d.professorId},${instanteUtcAgendaReposicao(inicio)},${instanteUtcAgendaReposicao(fim)},${d.fuso},${autor.id},${versao},${d.motivo},${d.evidencia},${d.chaveIdempotencia},${entradaHash})`);
      await registrarEvento(tx, { tipo: "ExcecaoAgendaReposicaoProposta", agregadoTipo: "Matricula", agregadoId: c.reposicao.matriculaId, autorId: autor.id, payload: { excecaoId: novoId, reposicaoId: c.reposicao.id, versao, diasNaoLetivos: c.diasNaoLetivos } });
      return { id: novoId, versao };
    });
  });
}

/** Q19/Q11: outra pessoa da gestão aprova a exceção exata, sem liberar o calendário geral. */
export async function decidirExcecaoAgendaReposicaoIndividual(input: { excecaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ excecaoId: id, aprovar: z.boolean(), motivo: textoAgendaReposicao }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      const [e] = await tx.$queryRaw<{ id: string; reposicaoId: string; professorId: string; inicio: Date; fim: Date; fusoOrigem: string; solicitanteId: string }[]>(Prisma.sql`SELECT id,"reposicaoId" AS "reposicaoId","professorId" AS "professorId",inicio,fim,"fusoOrigem" AS "fusoOrigem","solicitanteId" AS "solicitanteId" FROM "ExcecaoAgendaReposicaoIndividual" WHERE id=${d.excecaoId} FOR UPDATE`);
      if (!e) throw new ErroRegra("Exceção de agenda não encontrada.");
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      if (e.solicitanteId === autor.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a exceção.");
      const [atual] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoExcecaoAgendaReposicaoIndividual" WHERE "excecaoId"=${e.id}`);
      if (atual) { if (atual.decisorId === autor.id && atual.aprovada === d.aprovar && atual.motivo === d.motivo) return { id: atual.id, aprovada: atual.aprovada }; throw new ErroRegra("A exceção já foi decidida."); }
      const reposicao = await reposicaoAgendaTx(tx, e.reposicaoId);
      if (d.aprovar) {
        const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: e.reposicaoId, professorId: e.professorId, inicio: e.inicio, fim: e.fim, fuso: e.fusoOrigem, permitirSemBeneficio: true });
        if (c.jaAgendada || !c.diasNaoLetivos.length || c.disponibilidade.encontros.length || c.disponibilidade.indisponibilidades || c.disponibilidade.reservas || (c.regra && (c.saldo ?? 0) <= 0)) throw new ErroRegra("A disponibilidade, saldo ou calendário mudou; prepare nova exceção.");
      }
      const novoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoExcecaoAgendaReposicaoIndividual" (id,"excecaoId","decisorId",aprovada,motivo) VALUES (${novoId},${e.id},${autor.id},${d.aprovar},${d.motivo})`);
      await registrarEvento(tx, { tipo: "ExcecaoAgendaReposicaoDecidida", agregadoTipo: "Matricula", agregadoId: reposicao.matriculaId, autorId: autor.id, payload: { excecaoId: e.id, decisaoId: novoId, aprovada: d.aprovar } });
      return { id: novoId, aprovada: d.aprovar };
    });
  });
}

const autorizacaoExcecaoInput = z.object({ reposicaoId: id, motivo: textoAgendaReposicao, evidencia: textoAgendaReposicao, chaveIdempotencia: chave }).strict();

/** Q34: propõe gratuidade acadêmica excepcional sem criar crédito, cobrança ou saldo normal. */
export async function proporAutorizacaoExcecaoReposicaoParticular(input: z.input<typeof autorizacaoExcecaoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO), d = autorizacaoExcecaoInput.parse(input), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      const r = await reposicaoAgendaTx(tx, d.reposicaoId);
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      if (r.modalidade !== "PARTICULAR" || r.status !== "ATIVA") throw new ErroRegra("Exceção exige reposição particular de matrícula ativa.");
      const [decisaoPedido] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=${r.id} AND aprovada FOR SHARE`);
      if (!decisaoPedido) throw new ErroRegra("A exceção exige pedido de reposição previamente autorizado.");
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`SELECT id,"entradaHash" AS "entradaHash" FROM "AutorizacaoExcecaoReposicaoParticular" WHERE "solicitanteId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia}`);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra exceção de benefício."); return { id: repetida.id }; }
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "AutorizacaoExcecaoReposicaoParticular" WHERE "reposicaoId"=${r.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      const novoId = randomUUID(), versao = (ultima?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`INSERT INTO "AutorizacaoExcecaoReposicaoParticular" (id,"reposicaoId","solicitanteId",versao,motivo,evidencia,"chaveIdempotencia","entradaHash") VALUES (${novoId},${r.id},${autor.id},${versao},${d.motivo},${d.evidencia},${d.chaveIdempotencia},${entradaHash})`);
      await registrarEvento(tx, { tipo: "ExcecaoBeneficioReposicaoProposta", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id, payload: { autorizacaoId: novoId, reposicaoId: r.id, versao } });
      return { id: novoId, versao };
    });
  });
}

/** A mesma pessoa não transforma seu pedido excepcional em gratuidade. */
export async function decidirAutorizacaoExcecaoReposicaoParticular(input: { autorizacaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ autorizacaoId: id, aprovar: z.boolean(), motivo: textoAgendaReposicao }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const [p] = await tx.$queryRaw<{ id: string; reposicaoId: string; solicitanteId: string }[]>(Prisma.sql`SELECT id,"reposicaoId" AS "reposicaoId","solicitanteId" AS "solicitanteId" FROM "AutorizacaoExcecaoReposicaoParticular" WHERE id=${d.autorizacaoId} FOR UPDATE`);
      if (!p) throw new ErroRegra("Autorização excepcional não encontrada.");
      const r = await reposicaoAgendaTx(tx, p.reposicaoId);
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      if (p.solicitanteId === autor.id || r.status !== "ATIVA") throw new ErroRegra("Outra pessoa da gestão deve decidir a exceção da matrícula ativa.");
      const [atual] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoAutorizacaoExcecaoReposicaoParticular" WHERE "autorizacaoId"=${p.id}`);
      if (atual) { if (atual.decisorId === autor.id && atual.aprovada === d.aprovar && atual.motivo === d.motivo) return { id: atual.id, aprovada: atual.aprovada }; throw new ErroRegra("A autorização excepcional já foi decidida."); }
      const novoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoAutorizacaoExcecaoReposicaoParticular" (id,"autorizacaoId","decisorId",aprovada,motivo) VALUES (${novoId},${p.id},${autor.id},${d.aprovar},${d.motivo})`);
      await registrarEvento(tx, { tipo: "ExcecaoBeneficioReposicaoDecidida", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id, payload: { autorizacaoId: p.id, decisaoId: novoId, aprovada: d.aprovar } });
      return { id: novoId, aprovada: d.aprovar };
    });
  });
}

/** Q11/Q14: mostra a mesma cota, período e conflitos que o comando conferirá de novo. */
export async function consultarPreviaAgendaReposicaoIndividual(input: z.input<typeof previaAgendaInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = previaAgendaInput.parse(input);
    const inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: d.reposicaoId, professorId: d.professorId, inicio, fim, fuso: d.fuso, permitirSemBeneficio: true });
      const [autorizacao] = d.autorizacaoExcecaoId ? await tx.$queryRaw<{ id: string; motivo: string }[]>(Prisma.sql`
        SELECT a.id,a.motivo FROM "AutorizacaoExcecaoReposicaoParticular" a
        JOIN "DecisaoAutorizacaoExcecaoReposicaoParticular" decisao ON decisao."autorizacaoId"=a.id AND decisao.aprovada
        WHERE a.id=${d.autorizacaoExcecaoId} AND a."reposicaoId"=${c.reposicao.id} FOR SHARE
      `) : [];
      if (d.autorizacaoExcecaoId && !autorizacao) throw new ErroRegra("A autorização excepcional selecionada não está aprovada para esta reposição.");
      const [excecaoAgenda] = c.diasNaoLetivos.length ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT x.id FROM "ExcecaoAgendaReposicaoIndividual" x
        JOIN "DecisaoExcecaoAgendaReposicaoIndividual" decisao ON decisao."excecaoId"=x.id AND decisao.aprovada
        WHERE x."reposicaoId"=${c.reposicao.id} AND x."professorId"=${d.professorId}
          AND x.inicio=${instanteUtcAgendaReposicao(inicio)} AND x.fim=${instanteUtcAgendaReposicao(fim)} AND x."fusoOrigem"=${d.fuso}
        ORDER BY x.versao DESC LIMIT 1 FOR SHARE
      `) : [];
      const conflito = c.disponibilidade.encontros.length > 0 || c.disponibilidade.indisponibilidades || c.disponibilidade.reservas;
      return {
        professor: c.professor, fusoInstitucional: c.fusoInstitucional, periodo: c.periodo,
        quantidadePorPeriodo: c.regra?.quantidadePorPeriodo ?? null, saldo: c.saldo,
        conflitos: { encontros: c.disponibilidade.encontros.length, indisponibilidades: c.disponibilidade.indisponibilidades, reservas: c.disponibilidade.reservas },
        diasNaoLetivos: c.diasNaoLetivos, excecaoAgendaAprovada: !!excecaoAgenda,
        exigeAutorizacaoExcecao: !c.regra, autorizacaoExcecao: autorizacao ?? null,
        podeAgendar: !c.jaAgendada && !conflito && (!c.diasNaoLetivos.length || !!excecaoAgenda) && !!(autorizacao || (c.regra && (c.saldo ?? 0) > 0)),
      };
    });
  });
}

/** Q11/Q14: Secretaria cria o único encontro REPOSICAO e reserva o benefício na mesma transação. */
export async function agendarReposicaoIndividual(input: z.input<typeof agendaInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = agendaInput.parse(input), inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      const [idempotente] = await tx.$queryRaw<{ id: string; reposicaoIndividualId: string | null; entradaHash: string }[]>(Prisma.sql`SELECT id,"reposicaoIndividualId" AS "reposicaoIndividualId","entradaHash" AS "entradaHash" FROM "EncontroAgenda" WHERE "preparadorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR UPDATE`);
      if (idempotente) { if (idempotente.reposicaoIndividualId !== d.reposicaoId || idempotente.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outro agendamento."); return { encontroId: idempotente.id, idempotente: true }; }
      const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: d.reposicaoId, professorId: d.professorId, inicio, fim, fuso: d.fuso, permitirSemBeneficio: !!d.autorizacaoExcecaoId });
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${c.reposicao.matriculaId} FOR UPDATE`;
      if (c.jaAgendada || (!d.autorizacaoExcecaoId && c.regra && (c.saldo ?? 0) <= 0)) throw new ErroRegra("A reposição já foi agendada ou não há saldo de benefício.");
      if (c.disponibilidade.encontros.length || c.disponibilidade.indisponibilidades || c.disponibilidade.reservas) throw new ErroRegra("Há conflito com agenda, indisponibilidade docente ou reserva contratada.");
      let autorizacaoExcecaoId: string | null = null;
      if (d.autorizacaoExcecaoId) {
        const [autorizacao] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT a.id FROM "AutorizacaoExcecaoReposicaoParticular" a JOIN "DecisaoAutorizacaoExcecaoReposicaoParticular" decisao ON decisao."autorizacaoId"=a.id AND decisao.aprovada WHERE a.id=${d.autorizacaoExcecaoId ?? ""} AND a."reposicaoId"=${c.reposicao.id} FOR SHARE`);
        if (!autorizacao) throw new ErroRegra("Sem benefício vigente, a particular exige autorização excepcional aprovada.");
        autorizacaoExcecaoId = autorizacao.id;
      } else if (!c.regra) throw new ErroRegra("Sem benefício vigente, a particular exige autorização excepcional aprovada.");
      let excecaoId: string | null = null;
      if (c.diasNaoLetivos.length) {
        const [excecao] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT x.id FROM "ExcecaoAgendaReposicaoIndividual" x JOIN "DecisaoExcecaoAgendaReposicaoIndividual" decisao ON decisao."excecaoId"=x.id AND decisao.aprovada WHERE x."reposicaoId"=${c.reposicao.id} AND x."professorId"=${d.professorId} AND x.inicio=${instanteUtcAgendaReposicao(inicio)} AND x.fim=${instanteUtcAgendaReposicao(fim)} AND x."fusoOrigem"=${d.fuso} ORDER BY x.versao DESC LIMIT 1 FOR SHARE`);
        if (!excecao) throw new ErroRegra("Dia não letivo exige exceção aprovada para este mesmo horário.");
        excecaoId = excecao.id;
      }
      const encontroId = randomUUID(), agendaId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EncontroAgenda" (id,finalidade,"reposicaoIndividualId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",status,motivo,"chaveIdempotencia","entradaHash") VALUES (${encontroId},'REPOSICAO'::"FinalidadeEncontroAgenda",${c.reposicao.id},${c.reposicao.matriculaId},${d.professorId},${autor.id},${instanteUtcAgendaReposicao(inicio)},${instanteUtcAgendaReposicao(fim)},${d.fuso},'PREVISTO'::"StatusEncontroAgenda",${d.motivo},${d.chaveIdempotencia},${entradaHash})`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "AgendaReposicaoIndividual" (id,"reposicaoId","encontroId","beneficioId","periodoInicio","periodoFimExclusivo","statusBeneficio","autorizacaoExcecaoId","excecaoId","reservadoPorId",motivo) VALUES (${agendaId},${c.reposicao.id},${encontroId},${autorizacaoExcecaoId ? null : c.regra?.id ?? null},${autorizacaoExcecaoId ? null : c.periodo ? dataSql(c.periodo.inicio) : null},${autorizacaoExcecaoId ? null : c.periodo ? dataSql(c.periodo.fimExclusivo) : null},${autorizacaoExcecaoId ? 'ISENTA_EXCECAO' : 'RESERVADA'}::"StatusReservaBeneficioReposicao",${autorizacaoExcecaoId},${excecaoId},${autor.id},${d.motivo})`);
      await registrarEvento(tx, { tipo: "ReposicaoIndividualAgendada", agregadoTipo: "Matricula", agregadoId: c.reposicao.matriculaId, autorId: autor.id, payload: { reposicaoId: c.reposicao.id, agendaId, encontroId, beneficioId: autorizacaoExcecaoId ? null : c.regra?.id ?? null, autorizacaoExcecaoId, periodo: autorizacaoExcecaoId ? null : c.periodo, excecaoId } });
      // Confere os guards diferidos antes de produzir uma resposta de sucesso.
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { encontroId, agendaId, periodo: c.periodo, idempotente: false };
    });
  });
}

type AgendaCiclo = {
  id: string; reposicaoId: string; encontroId: string; matriculaId: string; modalidade: string; matriculaStatus: string;
  encontroStatus: string; inicio: Date; fim: Date; professorId: string | null; fusoOrigem: string;
  beneficioId: string | null; autorizacaoExcecaoId: string | null; statusBeneficio: "RESERVADA" | "CONSUMIDA" | "DEVOLVIDA" | "ISENTA_EXCECAO";
  antecedenciaCancelamentoMinutos: number | null;
};

/** Locks the current, singular agenda and its exact PREVISTO meeting. */
async function agendaCicloTx(tx: Prisma.TransactionClient, agendaId: string) {
  const [agenda] = await tx.$queryRaw<AgendaCiclo[]>(Prisma.sql`
    SELECT a.id,a."reposicaoId" AS "reposicaoId",a."encontroId" AS "encontroId",r."matriculaId" AS "matriculaId",
      r.modalidade::text AS modalidade,m.status::text AS "matriculaStatus",e.status::text AS "encontroStatus",
      e.inicio,e.fim,e."professorId" AS "professorId",e."fusoOrigem" AS "fusoOrigem",
      a."beneficioId" AS "beneficioId",a."autorizacaoExcecaoId" AS "autorizacaoExcecaoId",
      a."statusBeneficio"::text AS "statusBeneficio",b."antecedenciaCancelamentoMinutos" AS "antecedenciaCancelamentoMinutos"
    FROM "AgendaReposicaoIndividual" a
    JOIN "ReposicaoIndividual" r ON r.id=a."reposicaoId"
    JOIN "Matricula" m ON m.id=r."matriculaId"
    JOIN "EncontroAgenda" e ON e.id=a."encontroId"
    LEFT JOIN "BeneficioReposicaoParticularMatricula" b ON b.id=a."beneficioId"
    WHERE a.id=${agendaId}
    FOR UPDATE OF a,r,m,e
  `);
  if (!agenda || agenda.modalidade !== "PARTICULAR" || agenda.matriculaStatus !== "ATIVA"
    || agenda.encontroStatus !== "PREVISTO" || !["RESERVADA", "ISENTA_EXCECAO"].includes(agenda.statusBeneficio)) {
    throw new ErroRegra("O ciclo exige a agenda particular prevista, autorizada e vinculada a matrícula ativa.");
  }
  const [decisao] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=${agenda.reposicaoId} AND aprovada FOR SHARE
  `);
  if (!decisao) throw new ErroRegra("O pedido de reposição não está autorizado.");
  return agenda;
}

/** Q16: Secretaria registra o pedido histórico; a gestão independente decide o efeito no benefício. */
export async function proporCancelamentoReposicaoIndividual(input: z.input<typeof propostaCancelamentoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const d = propostaCancelamentoInput.parse(input), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      const agenda = await agendaCicloTx(tx, d.agendaId);
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaCancelamentoAgendaReposicaoIndividual"
        WHERE "autorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR UPDATE
      `);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outro cancelamento."); return { id: repetida.id, idempotente: true }; }
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
        SELECT versao FROM "PropostaCancelamentoAgendaReposicaoIndividual" WHERE "agendaId"=${agenda.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE
      `);
      const novoId = randomUUID(), versao = (ultima?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaCancelamentoAgendaReposicaoIndividual"
          (id,"agendaId","encontroId","autorId",versao,motivo,evidencia,"solicitadaEm",estado,"chaveIdempotencia","entradaHash")
        VALUES (${novoId},${agenda.id},${agenda.encontroId},${autor.id},${versao},${d.motivo},${d.evidencia},
          ${instanteUtcAgendaReposicao(new Date())},
          ${JSON.stringify({ agendaId: agenda.id, encontroId: agenda.encontroId, statusBeneficio: agenda.statusBeneficio, inicio: agenda.inicio.toISOString() })}::jsonb,
          ${d.chaveIdempotencia},${entradaHash})
      `);
      await registrarEvento(tx, { tipo: "CancelamentoAgendaReposicaoProposto", agregadoTipo: "Matricula", agregadoId: agenda.matriculaId, autorId: autor.id, payload: { propostaId: novoId, agendaId: agenda.id, encontroId: agenda.encontroId, versao } });
      return { id: novoId, versao, idempotente: false };
    });
  });
}

/** Q16/Q26: only an independent decision changes the reservation and cancels its exact meeting. */
export async function decidirCancelamentoReposicaoIndividual(input: z.input<typeof decisaoCancelamentoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = decisaoCancelamentoInput.parse(input);
    return prisma.$transaction(async tx => {
      const [proposta] = await tx.$queryRaw<{ id: string; agendaId: string; encontroId: string; autorId: string; solicitadaEm: Date }[]>(Prisma.sql`
        SELECT id,"agendaId" AS "agendaId","encontroId" AS "encontroId","autorId" AS "autorId","solicitadaEm" AS "solicitadaEm"
        FROM "PropostaCancelamentoAgendaReposicaoIndividual" WHERE id=${d.propostaId} FOR UPDATE
      `);
      if (!proposta) throw new ErroRegra("Proposta de cancelamento não encontrada.");
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      const [atual] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`
        SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoCancelamentoAgendaReposicaoIndividual" WHERE "propostaId"=${proposta.id}
      `);
      if (atual) { if (atual.decisorId === autor.id && atual.aprovada === d.aprovar && atual.motivo === d.motivo) return { id: atual.id, aprovada: atual.aprovada, idempotente: true }; throw new ErroRegra("A proposta já foi decidida."); }
      const agenda = await agendaCicloTx(tx, proposta.agendaId);
      if (proposta.autorId === autor.id || proposta.encontroId !== agenda.encontroId) throw new ErroRegra("A decisão deve ser independente e referir a agenda atual.");
      const resultado = !d.aprovar ? null : agenda.statusBeneficio === "ISENTA_EXCECAO" ? "ISENTA_SEM_SALDO" :
        proposta.solicitadaEm.getTime() <= agenda.inicio.getTime() - (agenda.antecedenciaCancelamentoMinutos ?? 0) * 60_000 ? "DEVOLVE_BENEFICIO" : "CONSOME_BENEFICIO";
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoCancelamentoAgendaReposicaoIndividual" (id,"propostaId","decisorId",aprovada,resultado,motivo) VALUES (${decisaoId},${proposta.id},${autor.id},${d.aprovar},${resultado}::"ResultadoCancelamentoAgendaReposicao",${d.motivo})`);
      if (d.aprovar) {
        if (resultado === "DEVOLVE_BENEFICIO") await tx.$executeRaw(Prisma.sql`UPDATE "AgendaReposicaoIndividual" SET "statusBeneficio"='DEVOLVIDA'::"StatusReservaBeneficioReposicao","devolvidaEm"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"motivoDevolucao"=${d.motivo} WHERE id=${agenda.id} AND "encontroId"=${agenda.encontroId} AND "statusBeneficio"='RESERVADA'::"StatusReservaBeneficioReposicao"`);
        else if (resultado === "CONSOME_BENEFICIO") await tx.$executeRaw(Prisma.sql`UPDATE "AgendaReposicaoIndividual" SET "statusBeneficio"='CONSUMIDA'::"StatusReservaBeneficioReposicao","consumidaEm"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=${agenda.id} AND "encontroId"=${agenda.encontroId} AND "statusBeneficio"='RESERVADA'::"StatusReservaBeneficioReposicao"`);
        if (resultado !== "ISENTA_SEM_SALDO" && !(await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "AgendaReposicaoIndividual" WHERE id=${agenda.id} AND "statusBeneficio"=${resultado === "DEVOLVE_BENEFICIO" ? "DEVOLVIDA" : "CONSUMIDA"}::"StatusReservaBeneficioReposicao"`))[0]) throw new ErroRegra("A reserva mudou antes do cancelamento.");
        const cancelado = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`UPDATE "EncontroAgenda" SET status='CANCELADO'::"StatusEncontroAgenda" WHERE id=${agenda.encontroId} AND "reposicaoIndividualId"=${agenda.reposicaoId} AND status='PREVISTO'::"StatusEncontroAgenda" RETURNING id`);
        if (!cancelado[0]) throw new ErroRegra("O encontro mudou antes do cancelamento.");
      }
      await registrarEvento(tx, { tipo: "CancelamentoAgendaReposicaoDecidido", agregadoTipo: "Matricula", agregadoId: agenda.matriculaId, autorId: autor.id, payload: { propostaId: proposta.id, decisaoId, aprovada: d.aprovar, resultado } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: decisaoId, aprovada: d.aprovar, resultado, idempotente: false };
    });
  });
}

/** Q26: remarcação é uma proposta auditável; ela não move encontro nem cota por si. */
export async function proporRemarcacaoReposicaoIndividual(input: z.input<typeof propostaRemarcacaoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const d = propostaRemarcacaoInput.parse(input), inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso), entradaHash = hashAgendaReposicao(d);
    return prisma.$transaction(async tx => {
      const agenda = await agendaCicloTx(tx, d.agendaId);
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: agenda.reposicaoId, professorId: d.professorId, inicio, fim, fuso: d.fuso, permitirSemBeneficio: !!agenda.autorizacaoExcecaoId, ignorarAgendaId: agenda.id });
      // A proposta é histórica e não consome saldo. A decisão independente
      // revalida a cota sob lock; assim uma cota ocupada entre as etapas gera
      // rejeição auditável sem alterar a agenda atual.
      if (!c.regra && !agenda.autorizacaoExcecaoId) throw new ErroRegra("A remarcação não tem benefício vigente nem autorização excepcional.");
      if (c.disponibilidade.encontros.length || c.disponibilidade.indisponibilidades || c.disponibilidade.reservas) throw new ErroRegra("Há conflito com agenda, indisponibilidade docente ou reserva contratada.");
      const [repetida] = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaReposicaoIndividual" WHERE "autorId"=${autor.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR UPDATE
      `);
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra remarcação."); return { id: repetida.id, idempotente: true }; }
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`
        SELECT versao FROM "PropostaRemarcacaoAgendaReposicaoIndividual" WHERE "agendaId"=${agenda.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE
      `);
      const novoId = randomUUID(), versao = (ultima?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PropostaRemarcacaoAgendaReposicaoIndividual"
          (id,"agendaId","encontroOriginalId","professorId",inicio,fim,"fusoOrigem","autorId",versao,motivo,evidencia,estado,"chaveIdempotencia","entradaHash")
        VALUES (${novoId},${agenda.id},${agenda.encontroId},${d.professorId},${instanteUtcAgendaReposicao(inicio)},${instanteUtcAgendaReposicao(fim)},${d.fuso},${autor.id},${versao},${d.motivo},${d.evidencia},
          ${JSON.stringify({ agendaId: agenda.id, encontroOriginalId: agenda.encontroId, professorId: d.professorId, inicio: inicio.toISOString(), fim: fim.toISOString(), fuso: d.fuso })}::jsonb,
          ${d.chaveIdempotencia},${entradaHash})
      `);
      await registrarEvento(tx, { tipo: "RemarcacaoAgendaReposicaoProposta", agregadoTipo: "Matricula", agregadoId: agenda.matriculaId, autorId: autor.id, payload: { propostaId: novoId, agendaId: agenda.id, encontroOriginalId: agenda.encontroId, versao } });
      return { id: novoId, versao, idempotente: false };
    });
  });
}

/** Q26: a decisão revalida tudo e troca agenda/encontro de forma atômica. */
export async function decidirRemarcacaoReposicaoIndividual(input: z.input<typeof decisaoRemarcacaoInput>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = decisaoRemarcacaoInput.parse(input);
    return prisma.$transaction(async tx => {
      const [proposta] = await tx.$queryRaw<{ id: string; agendaId: string; encontroOriginalId: string; professorId: string; inicio: Date; fim: Date; fusoOrigem: string; autorId: string; motivo: string }[]>(Prisma.sql`
        SELECT id,"agendaId" AS "agendaId","encontroOriginalId" AS "encontroOriginalId","professorId" AS "professorId",inicio,fim,"fusoOrigem" AS "fusoOrigem","autorId" AS "autorId",motivo
        FROM "PropostaRemarcacaoAgendaReposicaoIndividual" WHERE id=${d.propostaId} FOR UPDATE
      `);
      if (!proposta) throw new ErroRegra("Proposta de remarcação não encontrada.");
      await exigirAtorAgendaAtual(tx, autor.id, [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]);
      const [atual] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string; encontroNovoId: string | null }[]>(Prisma.sql`
        SELECT id,"decisorId" AS "decisorId",aprovada,motivo,"encontroNovoId" AS "encontroNovoId" FROM "DecisaoRemarcacaoAgendaReposicaoIndividual" WHERE "propostaId"=${proposta.id}
      `);
      if (atual) { if (atual.decisorId === autor.id && atual.aprovada === d.aprovar && atual.motivo === d.motivo) return { id: atual.id, aprovada: atual.aprovada, encontroId: atual.encontroNovoId, idempotente: true }; throw new ErroRegra("A proposta já foi decidida."); }
      const agenda = await agendaCicloTx(tx, proposta.agendaId);
      if (proposta.autorId === autor.id || proposta.encontroOriginalId !== agenda.encontroId) throw new ErroRegra("A decisão deve ser independente e referir a agenda atual.");
      let encontroNovoId: string | null = null;
      if (d.aprovar) {
        const c = await conferirAgendaReposicaoIndividualTx(tx, { reposicaoId: agenda.reposicaoId, professorId: proposta.professorId, inicio: proposta.inicio, fim: proposta.fim, fuso: proposta.fusoOrigem, permitirSemBeneficio: !!agenda.autorizacaoExcecaoId, ignorarAgendaId: agenda.id });
        if ((c.regra && (c.saldo ?? 0) <= 0) || (!c.regra && !agenda.autorizacaoExcecaoId) || c.disponibilidade.encontros.length || c.disponibilidade.indisponibilidades || c.disponibilidade.reservas) throw new ErroRegra("Saldo, calendário ou disponibilidade mudaram; prepare nova remarcação.");
        let excecaoId: string | null = null;
        if (c.diasNaoLetivos.length) {
          const [excecao] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT x.id FROM "ExcecaoAgendaReposicaoIndividual" x
            JOIN "DecisaoExcecaoAgendaReposicaoIndividual" decisao ON decisao."excecaoId"=x.id AND decisao.aprovada
            WHERE x."reposicaoId"=${agenda.reposicaoId} AND x."professorId"=${proposta.professorId}
              AND x.inicio=${instanteUtcAgendaReposicao(proposta.inicio)} AND x.fim=${instanteUtcAgendaReposicao(proposta.fim)}
              AND x."fusoOrigem"=${proposta.fusoOrigem}
            ORDER BY x.versao DESC LIMIT 1 FOR SHARE
          `);
          if (!excecao) throw new ErroRegra("A remarcação em dia não letivo exige exceção aprovada para este horário.");
          excecaoId = excecao.id;
        }
        encontroNovoId = randomUUID();
        const chaveEncontro = `remarcacao:${proposta.id}`;
        await tx.$executeRaw(Prisma.sql`INSERT INTO "EncontroAgenda" (id,finalidade,"reposicaoIndividualId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",status,motivo,"chaveIdempotencia","entradaHash") VALUES (${encontroNovoId},'REPOSICAO'::"FinalidadeEncontroAgenda",${agenda.reposicaoId},${agenda.matriculaId},${proposta.professorId},${autor.id},${instanteUtcAgendaReposicao(proposta.inicio)},${instanteUtcAgendaReposicao(proposta.fim)},${proposta.fusoOrigem},'PREVISTO'::"StatusEncontroAgenda",${d.motivo},${chaveEncontro},${hashAgendaReposicao({ propostaId: proposta.id, motivo: d.motivo })})`);
        const agendaAtualizada = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`UPDATE "AgendaReposicaoIndividual" SET "encontroId"=${encontroNovoId},"beneficioId"=${agenda.autorizacaoExcecaoId ? null : c.regra?.id ?? null},"periodoInicio"=${agenda.autorizacaoExcecaoId ? null : c.periodo ? dataSql(c.periodo.inicio) : null},"periodoFimExclusivo"=${agenda.autorizacaoExcecaoId ? null : c.periodo ? dataSql(c.periodo.fimExclusivo) : null},"excecaoId"=${excecaoId} WHERE id=${agenda.id} AND "encontroId"=${agenda.encontroId} AND "statusBeneficio"=${agenda.statusBeneficio}::"StatusReservaBeneficioReposicao" RETURNING id`);
        if (!agendaAtualizada[0]) throw new ErroRegra("A agenda mudou antes da remarcação.");
      }
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoRemarcacaoAgendaReposicaoIndividual" (id,"propostaId","decisorId","encontroNovoId",aprovada,motivo) VALUES (${decisaoId},${proposta.id},${autor.id},${encontroNovoId},${d.aprovar},${d.motivo})`);
      if (d.aprovar) {
        const cancelado = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`UPDATE "EncontroAgenda" SET status='CANCELADO'::"StatusEncontroAgenda" WHERE id=${agenda.encontroId} AND "reposicaoIndividualId"=${agenda.reposicaoId} AND status='PREVISTO'::"StatusEncontroAgenda" RETURNING id`);
        if (!cancelado[0]) throw new ErroRegra("O encontro original mudou antes da remarcação.");
      }
      const evento = await registrarEvento(tx, { tipo: "RemarcacaoAgendaReposicaoDecidida", agregadoTipo: "Matricula", agregadoId: agenda.matriculaId, autorId: autor.id, payload: { propostaId: proposta.id, decisaoId, aprovada: d.aprovar, encontroOriginalId: agenda.encontroId, encontroNovoId } });
      if (d.aprovar && encontroNovoId) await criarAvisosAlteracaoAgendaTx(tx, { eventoId: evento.id, matriculaId: agenda.matriculaId, encontrosIds: [agenda.encontroId, encontroNovoId] });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: decisaoId, aprovada: d.aprovar, encontroId: encontroNovoId, idempotente: false };
    });
  });
}
