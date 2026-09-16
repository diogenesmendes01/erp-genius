"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import {
  confirmarIndisponibilidadeMaterialReposicao,
  liberarEntregaReposicaoPausada,
  prazoEntregaVigente,
  prorrogarPrazoEntregaReposicao,
  publicarMaterialReposicaoGravacao,
  retomarMaterialReposicaoGravacao,
} from "@/server/portal-aluno/entregas-reposicao";
import type { ProrrogacaoPrazoEtapa } from "@/server/portal-aluno/entregas-reposicao";

const id = z.string().trim().min(1).max(100);
const texto = z.string().trim().min(5).max(4_000);

type ContextoOperacional = { reposicaoId: string; matriculaId: string; modalidade: string; statusMatricula: string; contaAtiva: boolean };

/** A operação sempre parte da reposição e da matrícula já conferidas; IDs de
 * conta do portal nunca atravessam o cliente da equipe. */
async function contextoGestaoTx(tx: Prisma.TransactionClient, reposicaoId: string, matriculaId?: string): Promise<ContextoOperacional> {
  const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
  const [fresco] = await tx.$queryRaw<Array<{ ativo: boolean; papeis: Papel[] }>>(Prisma.sql`
    SELECT ativo, papeis FROM "Usuario" WHERE id=${usuario.id} FOR SHARE
  `);
  if (!fresco?.ativo || !fresco.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  const [contexto] = await tx.$queryRaw<ContextoOperacional[]>(Prisma.sql`
    SELECT r.id AS "reposicaoId",r."matriculaId" AS "matriculaId",r.modalidade::text AS modalidade,m.status::text AS "statusMatricula",
      EXISTS(SELECT 1 FROM "ContaPortalAluno" conta WHERE conta."alunoId"=m."alunoId" AND conta.ativa) AS "contaAtiva"
    FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId"
    WHERE r.id=${reposicaoId} AND (${matriculaId ?? null}::text IS NULL OR r."matriculaId"=${matriculaId ?? ""})
    FOR SHARE OF r,m
  `);
  if (!contexto || contexto.modalidade !== "GRAVACAO") throw new ErroRegra("A operação exige reposição gravada da matrícula conferida.");
  return contexto;
}

const consulta = z.object({ reposicaoId: id, matriculaId: id }).strict();

/** Q35/Q36/Q52/Q57: projeção administrativa mínima de uma reposição gravada.
 * Não retorna conta, URL/ID Drive, entrega, contato ou dados de outro portal. */
export async function consultarOperacaoEntregaReposicao(input: unknown) {
  return executarAcao(async () => {
    const d = consulta.parse(input);
    return prisma.$transaction(async (tx) => {
      const contexto = await contextoGestaoTx(tx, d.reposicaoId, d.matriculaId);
      const [fonte] = await tx.$queryRaw<Array<{ fuso: string; materialPublicadoEm: Date | null; disponivel: boolean | null; prazoInicialAte: Date | null; pausaId: string | null; pausaInicio: Date | null; pausaMotivo: string | null; liberadaAte: Date | null }>>(Prisma.sql`
        SELECT (SELECT "fusoInstitucional" FROM "ConfiguracaoOperacional" WHERE id='escola') AS fuso, material."publicadoEm" AS "materialPublicadoEm", material.disponivel, disponibilidade."prazoInicialAte" AS "prazoInicialAte",
          pausa.id AS "pausaId", pausa.inicio AS "pausaInicio", pausa.motivo AS "pausaMotivo", liberacao."expiraEm" AS "liberadaAte"
        FROM "ReposicaoIndividual" r
        LEFT JOIN "MaterialReposicaoGravacao" material ON material."reposicaoId"=r.id
        LEFT JOIN "DisponibilizacaoEntregaReposicao" disponibilidade ON disponibilidade."reposicaoId"=r.id
        LEFT JOIN LATERAL (SELECT i.id,i.inicio,i.motivo FROM "IndisponibilidadeMaterialReposicao" i WHERE i."materialId"=material.id AND i.fim IS NULL ORDER BY i.inicio DESC LIMIT 1) pausa ON true
        LEFT JOIN LATERAL (SELECT l."expiraEm" FROM "LiberacaoEntregaReposicao" l JOIN "ContaPortalAluno" conta ON conta.id=l."contaId" AND conta.ativa WHERE l."reposicaoId"=r.id AND conta."alunoId"=(SELECT "alunoId" FROM "Matricula" WHERE id=r."matriculaId") AND l."expiraEm">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ORDER BY l."expiraEm" DESC LIMIT 1) liberacao ON true
        WHERE r.id=${contexto.reposicaoId}
      `);
      const pausas = await tx.$queryRaw<Array<{ inicio: Date; fim: Date | null }>>(Prisma.sql`
        SELECT i.inicio,i.fim FROM "IndisponibilidadeMaterialReposicao" i JOIN "MaterialReposicaoGravacao" material ON material.id=i."materialId" WHERE material."reposicaoId"=${contexto.reposicaoId}
      `);
      const prorrogacoesIniciais = await tx.$queryRaw<ProrrogacaoPrazoEtapa[]>(Prisma.sql`
        SELECT p."novoPrazo" AS "novoPrazo",p."criadaEm" AS "autorizadaEm",p.versao
        FROM "ProrrogacaoPrazoReposicao" p
        WHERE p."reposicaoId"=${contexto.reposicaoId} AND p."solicitacaoCorrecaoId" IS NULL
        ORDER BY p."criadaEm",p.versao
      `);
      const [correcao] = await tx.$queryRaw<Array<{ id: string; prazoAte: Date; criadaEm: Date }>>(Prisma.sql`
        SELECT c.id,c."prazoAte",c."criadaEm" FROM "SolicitacaoCorrecaoEntregaReposicao" c
        WHERE c."reposicaoId"=${contexto.reposicaoId} AND c.situacao='PENDENTE' ORDER BY c."criadaEm" DESC LIMIT 1
      `);
      const prorrogacoesCorrecao = correcao ? await tx.$queryRaw<ProrrogacaoPrazoEtapa[]>(Prisma.sql`
        SELECT p."novoPrazo" AS "novoPrazo",p."criadaEm" AS "autorizadaEm",p.versao
        FROM "ProrrogacaoPrazoReposicao" p
        WHERE p."solicitacaoCorrecaoId"=${correcao.id}
        ORDER BY p."criadaEm",p.versao
      `) : [];
      const relatos = await tx.$queryRaw<Array<{ id: string; descricao: string; criadaEm: Date }>>(Prisma.sql`
        SELECT relato.id,relato.descricao,relato."criadaEm" AS "criadaEm" FROM "RelatoIndisponibilidadeMaterialReposicao" relato
        JOIN "MaterialReposicaoGravacao" material ON material.id=relato."materialId"
        WHERE material."reposicaoId"=${contexto.reposicaoId} AND relato.situacao='ABERTO' ORDER BY relato."criadaEm" ASC,relato.id ASC LIMIT 20
      `);
      const prazoInicial = prazoEntregaVigente(fonte?.prazoInicialAte ?? null, pausas, prorrogacoesIniciais);
      const prazoEtapa = correcao ? prazoEntregaVigente(correcao.prazoAte, pausas.filter((p) => p.fim && p.fim > correcao.criadaEm).map((p) => ({ inicio: new Date(Math.max(p.inicio.getTime(), correcao.criadaEm.getTime())), fim: p.fim })), prorrogacoesCorrecao) : prazoInicial;
      return {
        reposicaoId: contexto.reposicaoId,
        matriculaStatus: contexto.statusMatricula,
        fuso: fonte?.fuso ?? "America/Sao_Paulo",
        material: fonte?.materialPublicadoEm ? { publicadoEm: fonte.materialPublicadoEm.toISOString(), disponivel: !!fonte.disponivel } : null,
        etapa: { correcaoId: correcao?.id ?? null, prazoAte: prazoEtapa?.toISOString() ?? null, prazoInicialAte: prazoInicial?.toISOString() ?? null },
        liberacao: { podeLiberar: ["PAUSADA", "ENCERRADA"].includes(contexto.statusMatricula) && contexto.contaAtiva, expiraEm: fonte?.liberadaAte?.toISOString() ?? null },
        indisponibilidade: fonte?.pausaId ? { id: fonte.pausaId, inicio: fonte.pausaInicio!.toISOString(), motivo: fonte.pausaMotivo ?? "Indisponibilidade confirmada." } : null,
        relatosAbertos: relatos.map((r) => ({ id: r.id, descricao: r.descricao, criadaEm: r.criadaEm.toISOString() })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

async function conferirOperacao(reposicaoId: string) {
  return prisma.$transaction((tx) => contextoGestaoTx(tx, reposicaoId));
}

async function conferirAlvoDaReposicao(reposicaoId: string, alvoId: string, tipo: "RELATO" | "INDISPONIBILIDADE") {
  return prisma.$transaction(async (tx) => {
    await contextoGestaoTx(tx, reposicaoId);
    const [alvo] = tipo === "RELATO"
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT relato.id FROM "RelatoIndisponibilidadeMaterialReposicao" relato
          JOIN "MaterialReposicaoGravacao" material ON material.id=relato."materialId"
          WHERE relato.id=${alvoId} AND material."reposicaoId"=${reposicaoId} FOR SHARE OF relato,material
        `)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT indisponibilidade.id FROM "IndisponibilidadeMaterialReposicao" indisponibilidade
          JOIN "MaterialReposicaoGravacao" material ON material.id=indisponibilidade."materialId"
          WHERE indisponibilidade.id=${alvoId} AND material."reposicaoId"=${reposicaoId} FOR SHARE OF indisponibilidade,material
        `);
    if (!alvo) throw new ErroRegra("O item operacional não pertence à reposição conferida.");
  });
}

/** As ações de domínio já retornam Resultado. O wrapper mantém o mesmo
 * contrato, sem devolver Resultado dentro de Resultado, e inclui a conferência
 * do alvo no tratamento esperado pelo cliente. */
function exigirResultado<T>(resultado: Resultado<T>): T {
  if (!resultado.ok) throw new ErroRegra(resultado.erro);
  return resultado.dado as T;
}

export async function publicarMaterialOperacional(input: unknown) {
  return executarAcao(async () => {
    const d = z.object({ reposicaoId: id, arquivoOficialId: z.string().trim().min(3).max(500).optional(), usarGravacaoAulaOriginal: z.boolean().optional() }).strict().parse(input);
    await conferirOperacao(d.reposicaoId);
    return exigirResultado(await publicarMaterialReposicaoGravacao(d));
  });
}

export async function prorrogarEtapaOperacional(input: unknown) {
  return executarAcao(async () => {
    const d = z.object({ reposicaoId: id, solicitacaoCorrecaoId: id.nullable(), prazoAnterior: z.string().datetime(), novoPrazo: z.string().datetime(), motivo: texto }).strict().parse(input);
    await conferirOperacao(d.reposicaoId);
    return exigirResultado(await prorrogarPrazoEntregaReposicao(d));
  });
}

export async function liberarEntregaOperacional(input: unknown) {
  return executarAcao(async () => {
    const d = z.object({ reposicaoId: id, expiraEm: z.string().datetime(), motivo: texto }).strict().parse(input);
    const conta = await prisma.$transaction(async (tx) => {
      const contexto = await contextoGestaoTx(tx, d.reposicaoId);
      if (!contexto.contaAtiva) throw new ErroRegra("A matrícula não possui conta de portal ativa para esta liberação.");
      const [r] = await tx.$queryRaw<Array<{ contaId: string }>>(Prisma.sql`
        SELECT conta.id AS "contaId" FROM "ContaPortalAluno" conta JOIN "Matricula" m ON m."alunoId"=conta."alunoId" WHERE m.id=${contexto.matriculaId} AND conta.ativa ORDER BY conta."criadaEm" ASC LIMIT 1 FOR SHARE OF conta,m
      `);
      if (!r) throw new ErroRegra("A matrícula não possui conta de portal ativa para esta liberação.");
      return r.contaId;
    });
    return exigirResultado(await liberarEntregaReposicaoPausada({ ...d, contaId: conta }));
  });
}

export async function confirmarIndisponibilidadeOperacional(input: unknown) {
  return executarAcao(async () => {
    const d = z.object({ reposicaoId: id, relatoId: id, motivo: texto }).strict().parse(input);
    await conferirAlvoDaReposicao(d.reposicaoId, d.relatoId, "RELATO");
    return exigirResultado(await confirmarIndisponibilidadeMaterialReposicao({ relatoId: d.relatoId, motivo: d.motivo }));
  });
}

export async function retomarIndisponibilidadeOperacional(input: unknown) {
  return executarAcao(async () => {
    const d = z.object({ reposicaoId: id, indisponibilidadeId: id, motivo: texto }).strict().parse(input);
    await conferirAlvoDaReposicao(d.reposicaoId, d.indisponibilidadeId, "INDISPONIBILIDADE");
    return exigirResultado(await retomarMaterialReposicaoGravacao({ indisponibilidadeId: d.indisponibilidadeId, motivo: d.motivo }));
  });
}
