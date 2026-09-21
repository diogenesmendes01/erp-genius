"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { Papel } from "@prisma/client";
import { prepararProcessoAditivoTx } from "./aditivo-envio-tx";
const id = z.string().trim().min(1).max(100), destino = z.object({ fornecedor: z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN"]), ambiente: z.enum(["SANDBOX", "PRODUCAO"]) });
const Preparar = destino.extend({ matriculaId: id, propostaId: id, artefatoId: id, conferenciaId: id }).strict();
export async function prepararProcessoAssinaturaAditivo(input: z.input<typeof Preparar>) { return executarAcao(async () => { const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Preparar.parse(input); return prisma.$transaction(tx => prepararProcessoAditivoTx(tx, ator.id, d), { timeout: 30000 }); }); }
const PaginacaoObservacoes = z.object({
  matriculaId: id, propostaId: id, artefatoId: id,
  paginaTentativas: z.number().int().min(1).max(100000).default(1),
  tentativaObservacoes: z.number().int().min(1).max(100000).optional(),
  paginaObservacoes: z.number().int().min(1).max(100000).default(1),
}).strict();
const ordemObservacoes = [{ observadaEm: "desc" as const }, { id: "desc" as const }];
const selecaoObservacao = { id: true, resultado: true, referenciaExterna: true, observadaEm: true };

export async function consultarProcessoAssinaturaAditivo(input: z.input<typeof PaginacaoObservacoes>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = PaginacaoObservacoes.parse(input);
    return prisma.$transaction(async tx => {
      const fresco = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo || !fresco.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroRegra("Permissão de Secretaria necessária.");
      const escopo = { id: d.artefatoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } };
      if (!await tx.artefatoAditivoContratual.count({ where: escopo })) throw new ErroRegra("Original indisponível nesta matrícula e proposta.");

      const processo = await tx.processoAssinaturaAditivo.findFirst({
        where: { propostaId: d.propostaId, artefatoId: d.artefatoId, proposta: { matriculaId: d.matriculaId } },
        include: { tentativas: {
          orderBy: { numero: "desc" }, skip: (d.paginaTentativas - 1) * 20, take: 21,
          select: { numero: true, revisaoHash: true, iniciadaEm: true, observacoes: { take: 21, orderBy: ordemObservacoes, select: selecaoObservacao } },
        } },
      });
      if (!processo) return null;
      const tentativasDaPagina = processo.tentativas.slice(0, 20);
      const numeroObservacoes = d.tentativaObservacoes ?? tentativasDaPagina[0]?.numero ?? null;
      if (numeroObservacoes != null && !tentativasDaPagina.some(t => t.numero === numeroObservacoes)) {
        throw new ErroRegra("A tentativa solicitada não pertence à página de tentativas exibida.");
      }
      const tentativaObservacoes = numeroObservacoes == null ? null : await tx.tentativaEnvioAditivo.findFirst({
        where: { processoId: processo.id, numero: numeroObservacoes },
        select: { numero: true, observacoes: { skip: (d.paginaObservacoes - 1) * 20, take: 21, orderBy: ordemObservacoes, select: selecaoObservacao } },
      });
      if (numeroObservacoes != null && !tentativaObservacoes) throw new ErroRegra("Tentativa indisponível neste processo de assinatura.");

      return {
        id: processo.id, propostaId: processo.propostaId, artefatoId: processo.artefatoId, conferenciaId: processo.conferenciaId,
        fornecedor: processo.fornecedor, ambiente: processo.ambiente, estado: processo.estado, tentativaAtual: processo.tentativaAtual,
        referenciaExterna: processo.referenciaExterna, criadoEm: processo.criadoEm, paginaTentativas: d.paginaTentativas,
        temMaisTentativas: processo.tentativas.length > 20, tentativaObservacoes: numeroObservacoes, paginaObservacoes: d.paginaObservacoes,
        tentativas: tentativasDaPagina.map(t => {
          const observacoes = t.numero === tentativaObservacoes?.numero ? tentativaObservacoes.observacoes : t.observacoes;
          return { ...t, temMaisObservacoes: observacoes.length > 20, paginaObservacoes: t.numero === tentativaObservacoes?.numero ? d.paginaObservacoes : 1, observacoes: observacoes.slice(0, 20) };
        }),
      };
    });
  });
}
