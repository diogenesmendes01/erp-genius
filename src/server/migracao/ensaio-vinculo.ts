"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma, StatusMatricula } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const Texto = z.string().trim().min(1).max(160);
const RevisaoEsperada = z.object({ id: Texto, versao: z.number().int().positive() }).strict();
const EntradaProduto = z.object({ origem: Texto, produtoOrigemId: Texto, produtoId: Texto, paisId: Texto, moeda: z.string().regex(/^[A-Z]{3}$/), ativa: z.boolean(), revisaoEsperada: RevisaoEsperada.optional() }).strict();
const EntradaTurma = z.object({ origem: Texto, turmaOrigemId: Texto, turmaId: Texto, ativa: z.boolean(), revisaoEsperada: RevisaoEsperada.optional() }).strict();
const EntradaStatus = z.object({ origem: Texto, statusOrigem: Texto, statusDestino: z.nativeEnum(StatusMatricula), ativa: z.boolean(), revisaoEsperada: RevisaoEsperada.optional() }).strict();
const EntradaEnsaio = z.object({ linhaId: Texto }).strict();

type Linha = { id: string; origem: string; entradaHash: string; alunoOrigemId: string | null; turmaOrigemId: string | null; dadosOrigem: unknown };
type Mapa = { id: string; versao: number; ativa: boolean };
type MapaProduto = Mapa & { paisId: string; moeda: string; codigoISO: string };
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const texto = (dados: unknown, caminho: string[]) => {
  const valor = caminho.reduce<unknown>((atual, chave) => atual && typeof atual === "object" ? (atual as Record<string, unknown>)[chave] : null, dados);
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  return typeof valor === "number" && Number.isFinite(valor) ? String(valor) : null;
};

async function adminFresco(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Sua Administração não está mais ativa.");
}

/** Registra uma revisão, nunca altera ou reativa uma versão anterior. */
export async function revisarCorrespondenciaProdutoMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR); const dados = EntradaProduto.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFresco(tx, autor.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-produto:${dados.origem}:${dados.produtoOrigemId}`}, 0))`;
      if (dados.ativa) {
        const [oferta] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "ProdutoPais" WHERE "produtoId"=${dados.produtoId} AND "paisId"=${dados.paisId} AND moeda=${dados.moeda} AND oferecido=true FOR SHARE`);
        if (!oferta) throw new ErroRegra("O produto não está disponível para o país e moeda informados.");
      }
      const [anterior] = await tx.$queryRaw<{ id: string; versao: number }[]>(Prisma.sql`SELECT id,versao FROM "CorrespondenciaProdutoMigracao" WHERE origem=${dados.origem} AND "produtoOrigemId"=${dados.produtoOrigemId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      if (!dados.ativa && (!dados.revisaoEsperada || anterior?.id !== dados.revisaoEsperada.id || anterior?.versao !== dados.revisaoEsperada.versao)) throw new ErroRegra("A correspondência mudou desde a sua consulta. Recarregue antes de revogar.");
      const versao = (anterior?.versao ?? 0) + 1; const id = randomUUID();
      await tx.$executeRaw`INSERT INTO "CorrespondenciaProdutoMigracao" (id,origem,"produtoOrigemId",versao,"produtoId","paisId",moeda,ativa,"revisadaPorId") VALUES (${id},${dados.origem},${dados.produtoOrigemId},${versao},${dados.produtoId},${dados.paisId},${dados.moeda},${dados.ativa},${autor.id})`;
      return { id, versao };
    });
  });
}

export async function revisarCorrespondenciaTurmaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR); const dados = EntradaTurma.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFresco(tx, autor.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-turma:${dados.origem}:${dados.turmaOrigemId}`}, 0))`;
      const [alvo] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "Turma" WHERE id=${dados.turmaId} FOR SHARE`); if (!alvo) throw new ErroRegra("A turma de destino não existe.");
      const [anterior] = await tx.$queryRaw<{ id: string; versao: number }[]>(Prisma.sql`SELECT id,versao FROM "CorrespondenciaTurmaMigracao" WHERE origem=${dados.origem} AND "turmaOrigemId"=${dados.turmaOrigemId} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      if (!dados.ativa && (!dados.revisaoEsperada || anterior?.id !== dados.revisaoEsperada.id || anterior?.versao !== dados.revisaoEsperada.versao)) throw new ErroRegra("A correspondência mudou desde a sua consulta. Recarregue antes de revogar.");
      const id=randomUUID(), versao=(anterior?.versao ?? 0)+1;
      await tx.$executeRaw`INSERT INTO "CorrespondenciaTurmaMigracao" (id,origem,"turmaOrigemId",versao,"turmaId",ativa,"revisadaPorId") VALUES (${id},${dados.origem},${dados.turmaOrigemId},${versao},${dados.turmaId},${dados.ativa},${autor.id})`;
      return { id, versao };
    });
  });
}

export async function revisarCorrespondenciaStatusMatriculaMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR); const dados = EntradaStatus.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFresco(tx, autor.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-status-matricula:${dados.origem}:${dados.statusOrigem}`}, 0))`;
      const [anterior] = await tx.$queryRaw<{ id: string; versao: number }[]>(Prisma.sql`SELECT id,versao FROM "CorrespondenciaStatusMatriculaMigracao" WHERE origem=${dados.origem} AND "statusOrigem"=${dados.statusOrigem} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      if (!dados.ativa && (!dados.revisaoEsperada || anterior?.id !== dados.revisaoEsperada.id || anterior?.versao !== dados.revisaoEsperada.versao)) throw new ErroRegra("A correspondência mudou desde a sua consulta. Recarregue antes de revogar.");
      const id=randomUUID(), versao=(anterior?.versao ?? 0)+1;
      await tx.$executeRaw`INSERT INTO "CorrespondenciaStatusMatriculaMigracao" (id,origem,"statusOrigem",versao,"statusDestino",ativa,"revisadaPorId") VALUES (${id},${dados.origem},${dados.statusOrigem},${versao},${dados.statusDestino}::"StatusMatricula",${dados.ativa},${autor.id})`;
      return { id, versao };
    });
  });
}

export async function ensaiarVinculoMigracao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR); const { linhaId } = EntradaEnsaio.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFresco(tx, autor.id);
      const [linha] = await tx.$queryRaw<Linha[]>(Prisma.sql`SELECT l.id,l."entradaHash",l."alunoOrigemId",l."turmaOrigemId",l."dadosOrigem",lo.origem FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId" WHERE l.id=${linhaId} AND l."tipoEntrada"='VINCULO_MATRICULA'::"TipoEntradaPreparacaoMigracao" FOR UPDATE`);
      if (!linha) throw new ErroRegra("A linha não é uma fotografia de vínculo disponível.");
      const produtoOrigem = texto(linha.dadosOrigem, ["matricula", "produtoOrigem"]); const statusOrigem = texto(linha.dadosOrigem, ["matricula", "situacao"]);
      const moeda = texto(linha.dadosOrigem, ["matricula", "moeda"]); const pais = texto(linha.dadosOrigem, ["matricula", "pais"]);
      // A revisão e o ensaio disputam as mesmas chaves, antes de ler a última versão.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-produto:${linha.origem}:${produtoOrigem ?? "<ausente>"}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-turma:${linha.origem}:${linha.turmaOrigemId ?? "<ausente>"}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`migracao-status-matricula:${linha.origem}:${statusOrigem ?? "<ausente>"}`}, 0))`;
      const [produto] = produtoOrigem ? await tx.$queryRaw<MapaProduto[]>(Prisma.sql`SELECT c.id,c.versao,c.ativa,c."paisId",c.moeda,p."codigoISO" FROM "CorrespondenciaProdutoMigracao" c JOIN "Pais" p ON p.id=c."paisId" WHERE c.origem=${linha.origem} AND c."produtoOrigemId"=${produtoOrigem} ORDER BY c.versao DESC LIMIT 1 FOR SHARE`) : [];
      const [turma] = linha.turmaOrigemId ? await tx.$queryRaw<Mapa[]>(Prisma.sql`SELECT id,versao,ativa FROM "CorrespondenciaTurmaMigracao" WHERE origem=${linha.origem} AND "turmaOrigemId"=${linha.turmaOrigemId} ORDER BY versao DESC LIMIT 1 FOR SHARE`) : [];
      const [status] = statusOrigem ? await tx.$queryRaw<Mapa[]>(Prisma.sql`SELECT id,versao,ativa FROM "CorrespondenciaStatusMatriculaMigracao" WHERE origem=${linha.origem} AND "statusOrigem"=${statusOrigem} ORDER BY versao DESC LIMIT 1 FOR SHARE`) : [];
      const [mapaAluno] = linha.alunoOrigemId ? await tx.$queryRaw<{ alunoId: string }[]>(Prisma.sql`SELECT mapa."alunoId" FROM "MapaOrigemAlunoMigracao" mapa JOIN "Aluno" aluno ON aluno.id=mapa."alunoId" WHERE mapa.origem=${linha.origem} AND mapa."alunoOrigemId"=${linha.alunoOrigemId} FOR SHARE`) : [];
      const pendencias = await tx.$queryRaw<{ codigo: string }[]>(Prisma.sql`SELECT codigo FROM "PendenciaCampoPreparacaoMigracao" WHERE "linhaId"=${linha.id} ORDER BY codigo FOR SHARE`);
      const requisitos = [
        !mapaAluno ? "MAPA_ALUNO_AUSENTE" : null,
        !produto?.ativa ? "CORRESPONDENCIA_PRODUTO_AUSENTE_OU_REVOGADA" : null,
        produto?.ativa && (produto.moeda !== moeda || produto.codigoISO !== pais) ? "PAIS_OU_MOEDA_DIVERGENTE" : null,
        !turma?.ativa ? "CORRESPONDENCIA_TURMA_AUSENTE_OU_REVOGADA" : null,
        !status?.ativa ? "CORRESPONDENCIA_STATUS_AUSENTE_OU_REVOGADA" : null,
        ...pendencias.filter((pendencia) => pendencia.codigo !== "SITUACAO_NAO_CONFIRMADA" || !status?.ativa).map((pendencia) => `PENDENCIA_PREPARACAO_${pendencia.codigo}`),
        "CONTRATO_HISTORICO_EXIGE_EVIDENCIA", "PAGAMENTO_HISTORICO_EXIGE_EVIDENCIA",
      ].filter((codigo): codigo is string => !!codigo).map((codigo) => ({ codigo }));
      // A situação declarada vira pendência de confirmação durante a preparação.
      // Uma correspondência administrativa ativa confirma precisamente essa única
      // pendência para o ensaio, sem esconder as demais pendências da fotografia.
      const pendenciasBloqueantes = pendencias.filter((pendencia) => pendencia.codigo !== "SITUACAO_NAO_CONFIRMADA");
      const completas = !!produto?.ativa && produto.moeda === moeda && produto.codigoISO === pais && !!turma?.ativa && !!status?.ativa && !!mapaAluno && pendenciasBloqueantes.length === 0;
      const resultado = completas ? "PRONTO_PARA_REVISAO" : "REQUISITO_AUSENTE";
      const correspondencias = { produto: produto?.ativa ? { id: produto.id, versao: produto.versao } : null, turma: turma?.ativa ? { id: turma.id, versao: turma.versao } : null, status: status?.ativa ? { id: status.id, versao: status.versao } : null };
      const revisoesObservadas = { produto: produto ? { id: produto.id, versao: produto.versao, ativa: produto.ativa } : null, turma: turma ? { id: turma.id, versao: turma.versao, ativa: turma.ativa } : null, status: status ? { id: status.id, versao: status.versao, ativa: status.ativa } : null };
      const mapaAlunoObservado = mapaAluno ? { alunoId: mapaAluno.alunoId } : null;
      const contextoHash = hash({ linhaId: linha.id, entradaHash: linha.entradaHash, correspondencias, revisoesObservadas, mapaAluno: mapaAlunoObservado, resultado, requisitos });
      const snapshot = { linhaId: linha.id, entradaHash: linha.entradaHash, contextoHash, correspondencias, revisoesObservadas, mapaAluno: mapaAlunoObservado, resultado, requisitos };
      const [existente] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "EnsaioVinculoMigracao" WHERE "linhaId"=${linha.id} AND "entradaHash"=${linha.entradaHash} AND "contextoHash"=${contextoHash} FOR SHARE`);
      if (existente) return { id: existente.id, repetido: true, resultado, requisitos };
      const id = randomUUID();
      await tx.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"correspondenciaProdutoId","correspondenciaTurmaId","correspondenciaStatusId","ensaiadoPorId") VALUES (${id},${linha.id},${linha.entradaHash},${contextoHash},${resultado}::"ResultadoEnsaioVinculoMigracao",${JSON.stringify(requisitos)}::jsonb,${JSON.stringify(snapshot)}::jsonb,${produto?.ativa ? produto.id : null},${turma?.ativa ? turma.id : null},${status?.ativa ? status.id : null},${autor.id})`;
      return { id, repetido: false, resultado, requisitos };
    });
  });
}
