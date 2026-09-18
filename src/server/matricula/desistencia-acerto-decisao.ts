"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { fotografiaQ165 } from "./desistencia-acerto-contratual";

const id = z.string().min(1).max(100);
const motivo = z.string().trim().min(5).max(3000);
const EntradaDecisao = z.object({
  propostaId: id,
  fotografiaHash: z.string().regex(/^[a-f0-9]{64}$/),
  aprovada: z.boolean(),
  motivo,
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();

export async function decidirAcertoDesistenciaContratual(input: unknown) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const entrada = EntradaDecisao.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaAcertoDesistenciaContratual.findUniqueOrThrow({
        where: { id: entrada.propostaId }, select: { pedido: { select: { matriculaId: true } } },
      });
      await bloquearMatriculas(tx, [referencia.pedido.matriculaId]);
      const proposta = await tx.propostaAcertoDesistenciaContratual.findUniqueOrThrow({
        where: { id: entrada.propostaId }, include: { pedido: true, decisao: true },
      });
      const usuario = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!usuario?.ativo || (!usuario.papeis.includes(Papel.ADMINISTRADOR)
        && (!usuario.papeis.includes(Papel.FINANCEIRO) || !usuario.permissoes.includes("financeiro.aprovar_acertos")))) {
        throw new ErroPermissao();
      }
      if (proposta.preparadorId === ator.id || proposta.fotografiaHash !== entrada.fotografiaHash) {
        throw new ErroRegra("Decisão não corresponde à proposta independente.");
      }
      if (proposta.decisao) {
        if (proposta.decisao.decisorId !== ator.id || proposta.decisao.aprovada !== entrada.aprovada
          || proposta.decisao.motivo !== entrada.motivo || proposta.decisao.chaveIdempotencia !== entrada.chaveIdempotencia) {
          throw new ErroRegra("Proposta já decidida com outros dados.");
        }
        return { id: proposta.decisao.id, aprovada: proposta.decisao.aprovada };
      }
      const atual = await tx.propostaAcertoDesistenciaContratual.findFirst({
        where: { pedidoId: proposta.pedidoId }, orderBy: { versao: "desc" }, select: { id: true },
      });
      if (atual?.id !== proposta.id) throw new ErroRegra("A proposta foi superada por uma reapresentação mais recente.");
      if (entrada.aprovada) {
        const condicoes = await tx.condicoesEncerramentoMatricula.findUniqueOrThrow({ where: { id: proposta.condicoesId }, select: { versao: true } });
        if (await tx.condicoesEncerramentoMatricula.count({ where: { matriculaId: proposta.pedido.matriculaId, versao: { gt: condicoes.versao } } })) {
          throw new ErroRegra("A versão contratual mudou; prepare novo acerto.");
        }
        const { fotografia } = await fotografiaQ165(tx, proposta.pedido.matriculaId);
        if (hashSubstituicao(fotografia) !== proposta.fotografiaHash) throw new ErroRegra("A fotografia financeira mudou; prepare novo acerto.");
      }
      const decisao = await tx.decisaoAcertoDesistenciaContratual.create({ data: {
        propostaId: proposta.id, decisorId: ator.id, aprovada: entrada.aprovada, motivo: entrada.motivo,
        condicoesHash: proposta.condicoesHash, fotografiaHash: proposta.fotografiaHash, chaveIdempotencia: entrada.chaveIdempotencia,
      } });
      await registrarEvento(tx, {
        tipo: "AcertoDesistenciaContratualDecidido", agregadoTipo: "Matricula", agregadoId: proposta.pedido.matriculaId, autorId: ator.id,
        payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: entrada.aprovada, fotografiaHash: proposta.fotografiaHash, versao: proposta.versao },
      });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}