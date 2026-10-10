"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { camposNavegacaoFila, corteDoId, direcaoDeLeitura, lerPaginaDaFila, MENSAGEM_DOIS_SENTIDOS, umSentido, type NavegacaoDaPagina, type NavegacaoFila } from "@/lib/cursor-fila";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarContinuidadeMensalTx } from "./continuidade-estado-tx";

const Entrada = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);

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
export type FilaContinuidadeMensal = NavegacaoDaPagina & { itens: ItemFilaContinuidadeMensal[] };

/** Incremento 608: visão financeira e sem efeitos; a emissão revalida tudo no comando próprio. Fila de trabalho com
 * cursor nos dois sentidos (E4, decisão de 10/10/2026), em ordem de id: uma matrícula que entra ou sai da fila (ativação,
 * encerramento) não desloca as páginas, e a próxima continua do último item visto. */
export async function consultarFilaContinuidadeMensal(input: NavegacaoFila = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const nav = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.FINANCEIRO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const { registros, ...navegacao } = await lerPaginaDaFila(nav, 20, (leitura, take) => tx.matricula.findMany({
        where: {
          status: "ATIVA",
          OR: [
            { preparacaoComercial: { regime: "MENSALIDADE" } },
            { preparacaoComercial: null, cobrancas: { some: { tipo: "MENSALIDADE" } } },
          ],
          ...corteDoId(leitura, "asc"),
        },
        orderBy: { id: direcaoDeLeitura(leitura)("asc") }, take,
        select: { id: true, codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } },
      }), (m) => m.id);
      const agora = new Date();
      const itens: ItemFilaContinuidadeMensal[] = [];
      for (const matricula of registros) {
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
      return { itens, ...navegacao } satisfies FilaContinuidadeMensal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
  });
}
