"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarContinuidadeMensalTx } from "./continuidade-estado-tx";

const Entrada = z.object({ cursor: z.string().trim().min(1).max(100).optional() }).strict();

type EstadoFilaContinuidade = "AGUARDAR_PRAZO" | "PRONTA" | "OFERTA_PENDENTE" | "INDISPONIVEL" | "CONFERENCIA" | "A_CONFERIR";
export type ItemFilaContinuidadeMensal = {
  matriculaId: string;
  codigo: string | null;
  alunoNome: string;
  estado: EstadoFilaContinuidade;
  motivo: string;
  cobertura: { inicio: string; fim: string } | null;
  vencimento: string | null;
};
export type FilaContinuidadeMensal = { itens: ItemFilaContinuidadeMensal[]; proximoCursor: string | null };

/** Incremento 608: visão financeira, paginada e sem efeitos; a emissão revalida tudo no comando próprio. */
export async function consultarFilaContinuidadeMensal(input: { cursor?: string } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.FINANCEIRO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const registros = await tx.matricula.findMany({
        where: {
          status: "ATIVA",
          ...(dados.cursor ? { id: { gt: dados.cursor } } : {}),
          OR: [
            { preparacaoComercial: { regime: "MENSALIDADE" } },
            { preparacaoComercial: null, cobrancas: { some: { tipo: "MENSALIDADE" } } },
          ],
        },
        orderBy: { id: "asc" }, take: 21,
        select: { id: true, codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } },
      });
      const agora = new Date();
      const itens: ItemFilaContinuidadeMensal[] = [];
      for (const matricula of registros.slice(0, 20)) {
        const alunoNome = [matricula.aluno.primeiroNome, matricula.aluno.sobrenome].filter(Boolean).join(" ");
        try {
          const estado = await carregarContinuidadeMensalTx(tx, { matriculaId: matricula.id, agora });
          const cobertura = { inicio: estado.plano.cobertura.inicio, fim: estado.plano.cobertura.fim };
          const vencimento = estado.plano.vencimento;
          if (estado.oferta.estado === "INDISPONIVEL") {
            itens.push({ matriculaId: matricula.id, codigo: matricula.codigo, alunoNome, estado: "INDISPONIVEL", motivo: estado.motivo, cobertura, vencimento });
          } else if (estado.oferta.estado === "PENDENTE_CONFERENCIA") {
            itens.push({ matriculaId: matricula.id, codigo: matricula.codigo, alunoNome, estado: "OFERTA_PENDENTE", motivo: estado.motivo, cobertura, vencimento });
          } else if (estado.comprovacaoOferta.estado !== "COMPROVADA_POR_AGENDA" && estado.comprovacaoOferta.estado !== "CONFIRMADA_PELA_GESTAO") {
            itens.push({ matriculaId: matricula.id, codigo: matricula.codigo, alunoNome, estado: "CONFERENCIA", motivo: "A oferta precisa de confirmação da Gestão Pedagógica antes da emissão.", cobertura, vencimento });
          } else {
            itens.push({ matriculaId: matricula.id, codigo: matricula.codigo, alunoNome, estado: estado.plano.status === "AGUARDAR_EMISSAO" ? "AGUARDAR_PRAZO" : "PRONTA", motivo: estado.motivo, cobertura, vencimento });
          }
        } catch (erro) {
          if (!(erro instanceof ErroRegra)) throw erro;
          itens.push({ matriculaId: matricula.id, codigo: matricula.codigo, alunoNome, estado: "A_CONFERIR", motivo: erro.message, cobertura: null, vencimento: null });
        }
      }
      return { itens, proximoCursor: registros.length > 20 ? registros[19]!.id : null } satisfies FilaContinuidadeMensal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
  });
}
