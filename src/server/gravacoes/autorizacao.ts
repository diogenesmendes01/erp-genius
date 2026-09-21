import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao } from "@/server/_shared";
import { cobrancaGeraRestricaoAutomatica } from "@/server/cobrancas/acesso-aulas-regras";
import { exigirSessaoPortalAluno, type SessaoPortalAluno } from "@/server/portal-aluno/sessao";
import { obterDriveOrganizacaoId } from "./credenciais";
import { resolverFonteRevisaoGravacaoTx } from "./fonte-revisao-tx";

export type AutorizacaoReproducaoGravacao = {
  /** Identificador interno da fonte oficial; nunca deve atravessar uma resposta HTTP. */
  fileId: string;
  reposicaoId: string;
  matriculaId: string;
  driveId?: string;
  revisionId: string;
  md5Checksum: string;
  size: string;
  mimeType: string;
};

type FonteAutorizada = { fileId: string; reposicaoId: string; matriculaId: string; materialId: string; publicacaoAulaId: string | null; aulaOriginalId: string };

/**
 * Guard interno para o adaptador de streaming. Cada chamada resolve a fonte a
 * partir da reposição, jamais a partir de um identificador de arquivo vindo do
 * navegador. Não interpreta LiberacaoEntregaReposicao como acesso ao vídeo:
 * ela permite apenas uma entrega pontual. Enquanto não houver uma concessão
 * própria de reprodução, matrícula pausada ou encerrada continua sem vídeo.
 */
export async function autorizarReproducaoGravacao(reposicaoId: string, agora = new Date()): Promise<AutorizacaoReproducaoGravacao> {
  if (!reposicaoId || reposicaoId.length > 200) throw new ErroPermissao("Reprodução não autorizada.");
  const sessao = await exigirSessaoPortalAluno();

  return prisma.$transaction((tx) => autorizarReproducaoGravacaoTx(tx, sessao, reposicaoId, agora),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Compartilha a autorização com operações sobre o material, sem abrir uma
 * transação independente entre a conferência e a gravação do relato. */
export async function autorizarReproducaoGravacaoTx(
  tx: Prisma.TransactionClient, sessao: SessaoPortalAluno, reposicaoId: string, agora = new Date(),
): Promise<AutorizacaoReproducaoGravacao> {
    if (!reposicaoId || reposicaoId.length > 200) throw new ErroPermissao("Reprodução não autorizada.");
    const [fonte] = await tx.$queryRaw<FonteAutorizada[]>(Prisma.sql`
      SELECT material.id AS "materialId", material."arquivoOficialId" AS "fileId", r.id AS "reposicaoId", m.id AS "matriculaId",
        material."publicacaoAulaId", r."aulaOriginalId"
      FROM "ReposicaoIndividual" r
      JOIN "Matricula" m ON m.id = r."matriculaId"
        AND m."alunoId" = ${sessao.alunoId}
        AND m.status = 'ATIVA'
        AND NOT m."acessoBloqueado"
        AND NOT m."acessoBloqueioManual"
        AND NOT m."acessoBloqueioAutomatico"
      JOIN "ContaPortalAluno" conta ON conta.id = ${sessao.contaId}
        AND conta."alunoId" = m."alunoId"
        AND conta.ativa
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      JOIN "MaterialReposicaoGravacao" material ON material."reposicaoId" = r.id AND material.disponivel
        AND material.provedor = 'GOOGLE_DRIVE'
      JOIN "DisponibilizacaoEntregaReposicao" disponibilizacao ON disponibilizacao."reposicaoId" = r.id
        AND disponibilizacao."materialId" = material.id
      WHERE r.id = ${reposicaoId}
        AND r.modalidade = 'GRAVACAO'
        AND NOT EXISTS (
          SELECT 1 FROM "IndisponibilidadeMaterialReposicao" indisponibilidade
          WHERE indisponibilidade."materialId" = material.id AND indisponibilidade.fim IS NULL
        )
      FOR SHARE OF r, m, conta, decisao, material, disponibilizacao
    `);
    if (!fonte) throw new ErroPermissao("Reprodução não autorizada.");
    const fonteFixa = await resolverFonteRevisaoGravacaoTx(tx, { materialReposicaoId: fonte.materialId });
    if (fonte.publicacaoAulaId) {
      const publicacao = await tx.publicacaoGravacaoAula.findUnique({ where: { id: fonte.publicacaoAulaId } });
      if (!publicacao || publicacao.encontroId !== fonte.aulaOriginalId ||
          publicacao.driveOrganizacaoId !== obterDriveOrganizacaoId()) {
        throw new ErroPermissao("Reprodução não autorizada.");
      }
    }

    // A rotina agendada persiste o bloqueio, mas uma nova leitura não pode
    // conceder a janela entre o vencimento D+30 e o próximo tick. Reutiliza a
    // mesma política por cobrança, sem recriar a noção de dias no SQL.
    const cobrancas = await tx.cobranca.findMany({
      where: { matriculaId: fonte.matriculaId },
      select: { status: true, vencimento: true, saldo: true, valorNegociado: true, valorRecebido: true },
    });
    const bloqueioD30 = cobrancas.some((cobranca) => cobrancaGeraRestricaoAutomatica({
      status: cobranca.status,
      vencimento: cobranca.vencimento,
      saldo: cobranca.saldo === null ? null : Number(cobranca.saldo),
      valorNegociado: Number(cobranca.valorNegociado),
      valorRecebido: cobranca.valorRecebido === null ? null : Number(cobranca.valorRecebido),
    }, agora));
    if (bloqueioD30) throw new ErroPermissao("Reprodução não autorizada.");

    return { fileId: fonteFixa.fileId, reposicaoId: fonte.reposicaoId, matriculaId: fonte.matriculaId,
      driveId: fonteFixa.driveId, revisionId: fonteFixa.revisionId, md5Checksum: fonteFixa.md5Checksum,
      size: fonteFixa.size, mimeType: fonteFixa.mimeType };
}
