"use server";

import { createHash, randomUUID } from "crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { normalizarEmailPortalAluno } from "./politica";

const texto = z.string().trim().min(5).max(4000);
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
const EntradaEvidencia = z.object({ solicitacaoId: z.string().min(1), evidencia: texto }).strict();
const EntradaDecisao = z.object({ conciliacaoId: z.string().min(1), estadoHash: z.string().regex(/^[a-f0-9]{64}$/), aprovar: z.boolean(), motivo: texto }).strict();

type Estado = { solicitacaoId: string; contaId: string; alunoId: string; finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL"; destinatario: string; trocaEmailId: string | null; situacao: string; ativa: boolean; senhaHash: string | null; emailVerificado: string | null; emailAluno: string | null; versaoSessao: number };

function hashEstado(estado: Estado) {
  return createHash("sha256").update(JSON.stringify({
    solicitacaoId: estado.solicitacaoId, contaId: estado.contaId, alunoId: estado.alunoId,
    finalidade: estado.finalidade, destinatario: estado.destinatario, trocaEmailId: estado.trocaEmailId,
    situacao: estado.situacao, ativa: estado.ativa, senhaHash: Boolean(estado.senhaHash),
    emailVerificado: estado.emailVerificado, emailAluno: estado.emailAluno, versaoSessao: estado.versaoSessao,
  })).digest("hex");
}

async function usuarioFrescoTx(tx: Prisma.TransactionClient, id: string, papel: Papel) {
  const [u] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${id} FOR SHARE`);
  if (!u?.ativo || (!u.papeis.includes(papel) && !u.papeis.includes(Papel.ADMINISTRADOR))) throw new ErroPermissao("Sua permissão mudou; inicie a operação novamente.");
}

async function carregarEstadoTx(tx: Prisma.TransactionClient, solicitacaoId: string): Promise<Estado> {
  const [e] = await tx.$queryRaw<Estado[]>(Prisma.sql`
    SELECT e.id AS "solicitacaoId", e."contaId" AS "contaId", c."alunoId" AS "alunoId", e.finalidade::text AS finalidade,
      e.destinatario, e."trocaEmailId" AS "trocaEmailId", e.situacao::text AS situacao, c.ativa,
      c."senhaHash" AS "senhaHash", c."emailVerificado" AS "emailVerificado", a.email AS "emailAluno", c."versaoSessao" AS "versaoSessao"
    FROM "SolicitacaoEnvioPortalAluno" e
    JOIN "ContaPortalAluno" c ON c.id = e."contaId"
    JOIN "Aluno" a ON a.id = c."alunoId"
    WHERE e.id = ${solicitacaoId}
    FOR UPDATE OF e, c, a
  `);
  if (!e) throw new ErroRegra("Solicitação de envio não encontrada.");
  return e;
}

async function conferirReemissaoTx(tx: Prisma.TransactionClient, estado: Estado) {
  if (estado.situacao !== "INCERTO" || !estado.ativa) throw new ErroRegra("A solicitação não está mais disponível para conciliação.");
  if (estado.finalidade === "CONVITE") {
    if (estado.senhaHash || !estado.emailAluno || normalizarEmailPortalAluno(estado.emailAluno) !== estado.destinatario) throw new ErroRegra("O contato ou a credencial mudou; não é possível reemitir este convite.");
  } else if (estado.finalidade === "RECUPERACAO") {
    const [assistida] = await tx.$queryRaw<{ autorizada: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s
        JOIN "DecisaoTrocaEmailPortalAluno" d ON d."solicitacaoId" = s.id AND d.aprovada
        WHERE s."contaId" = ${estado.contaId} AND s.situacao = 'APROVADA_APLICADA'
          AND s."novoEmail" = ${estado.destinatario} AND ${estado.emailVerificado} = ${estado.destinatario}
      ) AS autorizada
    `);
    if (estado.emailVerificado !== estado.destinatario || (!estado.senhaHash && !assistida?.autorizada)) throw new ErroRegra("O destinatário de recuperação não está mais autorizado.");
  } else {
    const [troca] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "SolicitacaoTrocaEmailPortalAluno"
      WHERE id = ${estado.trocaEmailId} AND "contaId" = ${estado.contaId}
        AND situacao = 'PENDENTE_VALIDACAO' AND "novoEmail" = ${estado.destinatario}
      FOR UPDATE
    `);
    if (!troca) throw new ErroRegra("A validação de troca de e-mail não está mais disponível.");
  }
}

export async function registrarEvidenciaEnvioIncerto(input: { solicitacaoId: string; evidencia: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = EntradaEvidencia.parse(input);
    return prisma.$transaction(async (tx) => {
      await usuarioFrescoTx(tx, autor.id, Papel.SECRETARIA_ACADEMICA);
      const estado = await carregarEstadoTx(tx, dados.solicitacaoId);
      if (estado.situacao !== "INCERTO") throw new ErroRegra("A solicitação não possui resultado incerto para conciliar.");
      const estadoHash = hashEstado(estado);
      const [anterior] = await tx.$queryRaw<{ id: string; secretariaId: string; evidencia: string; estadoHash: string; versao: number }[]>(Prisma.sql`
        SELECT id, "secretariaId" AS "secretariaId", evidencia, "estadoHash" AS "estadoHash", versao
        FROM "ConciliacaoEnvioPortalAluno" WHERE "solicitacaoId" = ${estado.solicitacaoId} ORDER BY versao DESC LIMIT 1 FOR UPDATE
      `);
      if (anterior?.secretariaId === autor.id && anterior.evidencia === dados.evidencia && anterior.estadoHash === estadoHash) return { conciliacaoId: anterior.id, estadoHash, versao: anterior.versao, idempotente: true as const };
      const id = randomUUID(); const versao = (anterior?.versao ?? 0) + 1;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ConciliacaoEnvioPortalAluno" (id, "solicitacaoId", versao, "secretariaId", evidencia, "estadoHash", "versaoConta")
        VALUES (${id}, ${estado.solicitacaoId}, ${versao}, ${autor.id}, ${dados.evidencia}, ${estadoHash}, ${estado.versaoSessao})
      `);
      await registrarEvento(tx, { tipo: "EvidenciaEnvioPortalAlunoIncertoRegistrada", agregadoTipo: "Aluno", agregadoId: estado.alunoId, autorId: autor.id, payload: { solicitacaoEnvioId: estado.solicitacaoId, conciliacaoId: id, resultado: "SEM_COMPROVACAO" } });
      return { conciliacaoId: id, estadoHash, versao, idempotente: false as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

export async function decidirReemissaoEnvioIncerto(input: { conciliacaoId: string; estadoHash: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const decisor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = EntradaDecisao.parse(input);
    return prisma.$transaction(async (tx) => {
      await usuarioFrescoTx(tx, decisor.id, Papel.ADMINISTRADOR);
      const [c] = await tx.$queryRaw<{ id: string; solicitacaoId: string; secretariaId: string; evidenciaHash: string }[]>(Prisma.sql`
        SELECT id, "solicitacaoId" AS "solicitacaoId", "secretariaId" AS "secretariaId", "estadoHash" AS "evidenciaHash"
        FROM "ConciliacaoEnvioPortalAluno" WHERE id = ${dados.conciliacaoId} FOR UPDATE
      `);
      if (!c) throw new ErroRegra("Conciliação não encontrada.");
      if (c.secretariaId === decisor.id) throw new ErroPermissao("Outra pessoa da Administração deve autorizar a nova emissão.");
      await usuarioFrescoTx(tx, c.secretariaId, Papel.SECRETARIA_ACADEMICA);
      const [anterior] = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string; estadoHash: string; solicitacaoReemitidaId: string | null }[]>(Prisma.sql`
        SELECT id, "decisorId" AS "decisorId", aprovada, motivo, "estadoHash" AS "estadoHash", "solicitacaoReemitidaId" AS "solicitacaoReemitidaId"
        FROM "DecisaoReemissaoEnvioPortalAluno" WHERE "conciliacaoId" = ${c.id} FOR UPDATE
      `);
      if (anterior) {
        if (anterior.decisorId === decisor.id && anterior.aprovada === dados.aprovar && anterior.motivo === dados.motivo && anterior.estadoHash === dados.estadoHash) return { decisaoId: anterior.id, aprovada: anterior.aprovada, solicitacaoEnvioId: anterior.solicitacaoReemitidaId, idempotente: true as const };
        throw new ErroRegra("A conciliação já recebeu decisão.");
      }
      const estado = await carregarEstadoTx(tx, c.solicitacaoId);
      const atual = hashEstado(estado);
      if (c.evidenciaHash !== dados.estadoHash || atual !== dados.estadoHash) throw new ErroRegra("O contato ou estado mudou desde a evidência; registre nova conferência.");
      if (dados.aprovar) {
        const [jaAprovada] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT d.id FROM "DecisaoReemissaoEnvioPortalAluno" d
          JOIN "ConciliacaoEnvioPortalAluno" anteriores ON anteriores.id = d."conciliacaoId"
          WHERE anteriores."solicitacaoId" = ${estado.solicitacaoId} AND d.aprovada FOR UPDATE
        `);
        if (jaAprovada) throw new ErroRegra("Esta tentativa já recebeu autorização de reemissão.");
        await conferirReemissaoTx(tx, estado);
      }
      const decisaoId = randomUUID();
      const agora = new Date();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReemissaoEnvioPortalAluno" (id, "conciliacaoId", "decisorId", aprovada, motivo, "estadoHash") VALUES (${decisaoId}, ${c.id}, ${decisor.id}, ${dados.aprovar}, ${dados.motivo}, ${dados.estadoHash})`);
      let solicitacaoEnvioId: string | null = null;
      if (dados.aprovar) {
        await tx.$executeRaw(Prisma.sql`UPDATE "TokenPortalAluno" SET "revogadoEm" = ${instanteUtc(agora)} WHERE "contaId" = ${estado.contaId} AND finalidade = ${estado.finalidade}::"FinalidadeTokenPortalAluno" AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL`);
        solicitacaoEnvioId = randomUUID();
        await tx.$executeRaw(Prisma.sql`INSERT INTO "SolicitacaoEnvioPortalAluno" (id, "contaId", finalidade, destinatario, "trocaEmailId", situacao, chave) VALUES (${solicitacaoEnvioId}, ${estado.contaId}, ${estado.finalidade}::"FinalidadeTokenPortalAluno", ${estado.destinatario}, ${estado.trocaEmailId}, 'PREPARADO', ${`portal:reemissao:${decisaoId}`})`);
        await tx.$executeRaw(Prisma.sql`UPDATE "DecisaoReemissaoEnvioPortalAluno" SET "solicitacaoReemitidaId" = ${solicitacaoEnvioId} WHERE id = ${decisaoId}`);
      }
      await registrarEvento(tx, { tipo: "ReemissaoEnvioPortalAlunoDecidida", agregadoTipo: "Aluno", agregadoId: estado.alunoId, autorId: decisor.id, payload: { solicitacaoEnvioId: estado.solicitacaoId, conciliacaoId: c.id, decisaoId, aprovada: dados.aprovar, solicitacaoReemitidaId: solicitacaoEnvioId } });
      return { decisaoId, aprovada: dados.aprovar, solicitacaoEnvioId, idempotente: false as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}
