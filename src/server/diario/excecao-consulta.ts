"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { alemDoCursor, camposNavegacaoFila, cursorDaLeitura, direcaoDeLeitura, lerPaginaDaFila, MENSAGEM_DOIS_SENTIDOS, umSentido, type NavegacaoFila } from "@/lib/cursor-fila";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { estadoDiario } from "./estado";

/** Fila de trabalho com cursor nos dois sentidos (E4, decisão de 10/10/2026), no escopo de quem consulta e em ordem
 * estável (criadoEm desc, id desc). A âncora do cursor é lida no escopo, mas sem o filtro de pendentes: decidir a
 * exceção âncora não a perde, e a próxima continua de onde a pessoa parou sem pular ninguém. */
export async function listarExcecoesGravacao(input: NavegacaoFila & { apenasPendentes?: boolean } = {}) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ ...camposNavegacaoFila, apenasPendentes: z.boolean().default(true) }).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS).parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo) throw new ErroPermissao();
      const gestao = u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
      if (!gestao && !u.papeis.includes("PROFESSOR")) throw new ErroPermissao();
      const escopo: Prisma.ExcecaoGravacaoEncontroWhereInput = gestao ? {} : { solicitanteId: autor.id };
      const where: Prisma.ExcecaoGravacaoEncontroWhereInput = { ...escopo, ...(d.apenasPendentes ? { decisao: { is: null } } : {}) };
      const ler = async (leitura: NavegacaoFila, take: number) => {
        const cursor = cursorDaLeitura(leitura);
        const ancora = cursor === null ? null : await tx.excecaoGravacaoEncontro.findFirst({ where: { ...escopo, id: cursor }, select: { id: true, criadoEm: true } });
        if (cursor !== null && !ancora) return [];
        const sentido = direcaoDeLeitura(leitura);
        return tx.excecaoGravacaoEncontro.findMany({ where: ancora ? { AND: [where, { OR: [{ criadoEm: alemDoCursor(leitura, "desc", ancora.criadoEm) }, { criadoEm: ancora.criadoEm, id: alemDoCursor(leitura, "desc", ancora.id) }] }] } : where,
          orderBy: [{ criadoEm: sentido("desc") }, { id: sentido("desc") }], take,
        select: { id: true, encontroId: true, solicitanteId: true, motivo: true, criadoEm: true, snapshot: true,
          solicitante: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, decididaEm: true } },
          encontro: { select: { inicio: true, fim: true, fusoOrigem: true, status: true,
            diario: { select: { id: true, conteudo: true, atualizadoEm: true, registros: { select: { alunoId: true, nomeAluno: true, presente: true, observacao: true, matriculaId: true, participacao: true }, orderBy: { nomeAluno: "asc" } } } } } } },
        });
      };
      const { registros, ...navegacao } = await lerPaginaDaFila({ depois: d.depois, antes: d.antes }, 30, ler, (p) => p.id);
      return { itens: registros.map((p) => ({ id: p.id, encontroId: p.encontroId, professor: p.solicitante.nome,
        motivo: p.motivo, criadoEm: p.criadoEm.toISOString(), inicio: p.encontro.inicio.toISOString(), fim: p.encontro.fim.toISOString(),
        fusoOrigem: p.encontro.fusoOrigem, estadoEncontro: p.encontro.status,
        podeDecidir: gestao && p.solicitanteId !== autor.id && !p.decisao,
        diarioCorresponde: gestao && !!p.encontro.diario && z.object({ estadoDiario: z.string() }).safeParse(p.snapshot).data?.estadoDiario === estadoDiario(p.encontro.diario),
        diarioParaRevisao: gestao && p.encontro.diario ? { conteudo: p.encontro.diario.conteudo,
          registros: p.encontro.diario.registros.map((r) => ({ nomeAluno: r.nomeAluno, presente: r.presente, observacao: r.observacao, participacao: r.participacao })) } : null,
        decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null,
      })), ...navegacao };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
