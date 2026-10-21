"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { obterDriveOrganizacaoId } from "@/server/gravacoes/credenciais";
import { obterTokenPublicacaoDrive } from "@/server/gravacoes/credenciais-publicacao";
import { fixarRevisaoDriveOrganizacional } from "@/server/gravacoes/drive-revisao";
import { exigirAcessoRegularizacaoAulaTx } from "./regularizacao-acesso";
import { contextoConclusaoTx } from "./conclusao-contexto";
import { hashCorrecaoAula } from "./correcao-aula-schema";

const entradaSchema = z.object({ encontroId: z.string().min(1), arquivoOficialId: z.string().regex(/^[A-Za-z0-9_-]{3,500}$/),
  chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();

/** Publica a fonte e conclui a aula com chamada e disponibilidade conferidas. */
export async function registrarGravacaoAula(input: z.input<typeof entradaSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = entradaSchema.parse(input);
    const entradaHash = hashCorrecaoAula(d);
    const preparar = () => prisma.$transaction(async tx => {
      await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: d.encontroId });
      const anterior = await tx.publicacaoGravacaoAula.findUnique({ where: { publicadorId_chaveIdempotencia: { publicadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("A chave já identifica outra publicação de gravação.");
        const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: d.encontroId }, select: { status: true } });
        if (e.status === "MINISTRADO") return { id: anterior.id, snapshot: null, concluida: true };
        return { id: anterior.id, snapshot: await contextoConclusaoTx(tx, d.encontroId), concluida: false };
      }
      if (await tx.publicacaoGravacaoAula.findUnique({ where: { encontroId: d.encontroId }, select: { id: true } }))
        throw new ErroRegra("A aula já possui gravação registrada. A substituição exige o fluxo de correção.");
      return { id: null, snapshot: await contextoConclusaoTx(tx, d.encontroId), concluida: false };
    });
    const revisao = await preparar();
    if (revisao.id && revisao.concluida) return { id: revisao.id };
    const driveOrganizacaoId = obterDriveOrganizacaoId();
    const fonteFixa = await fixarRevisaoDriveOrganizacional({ fileId: d.arquivoOficialId, driveIdOrganizacao: driveOrganizacaoId, token: obterTokenPublicacaoDrive });
    const conferidaEm = new Date();
    return prisma.$transaction(async tx => {
      const acesso = await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: d.encontroId });
      const anterior = await tx.publicacaoGravacaoAula.findUnique({ where: { publicadorId_chaveIdempotencia: { publicadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("A chave já identifica outra publicação de gravação.");
        const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: d.encontroId }, select: { status: true } });
        if (e.status === "MINISTRADO") return { id: anterior.id };
        if (anterior.driveOrganizacaoId !== driveOrganizacaoId) throw new ErroRegra("A configuração do repositório mudou. Solicite conferência da gravação.");
      }
      const snapshot = await contextoConclusaoTx(tx, d.encontroId);
      if (hashCorrecaoAula(snapshot) !== hashCorrecaoAula(revisao.snapshot)) throw new ErroRegra("A aula mudou durante a conferência do vídeo. Recarregue antes de publicar.");
      const p = anterior ?? await tx.publicacaoGravacaoAula.create({ data: { ...d, publicadorId: autor.id, entradaHash, driveOrganizacaoId,
        mimeType: fonteFixa.mimeType, driveRevisionId: fonteFixa.revisionId, driveRevisionMd5: fonteFixa.md5Checksum, driveRevisionSize: BigInt(fonteFixa.size), conferidaEm, snapshot } });
      if (!anterior) {
        await tx.fonteRevisaoGravacao.create({ data: { alvo: "PUBLICACAO_AULA", publicacaoAulaId: p.id, versao: 1,
          arquivoOficialId: fonteFixa.fileId, driveOrganizacaoId: fonteFixa.driveId, driveRevisionId: fonteFixa.revisionId,
          driveRevisionMd5: fonteFixa.md5Checksum, driveRevisionSize: BigInt(fonteFixa.size), mimeType: fonteFixa.mimeType } });
        await registrarEvento(tx, { tipo: "GravacaoAulaRegistrada", agregadoTipo: "EncontroAgenda", agregadoId: d.encontroId, autorId: autor.id,
        payload: { publicacaoId: p.id, designacaoId: acesso.designacaoId, diarioId: snapshot.diarioId } });
      }
      await tx.encontroAgenda.update({ where: { id: d.encontroId }, data: { status: "MINISTRADO" } });
      await registrarEvento(tx, { tipo: "AulaConcluidaComGravacao", agregadoTipo: "EncontroAgenda", agregadoId: d.encontroId, autorId: autor.id,
        payload: { publicacaoId: p.id, designacaoId: acesso.designacaoId, conferidaEm: conferidaEm.toISOString(), snapshot } });
      return { id: p.id };
    });
  });
}
