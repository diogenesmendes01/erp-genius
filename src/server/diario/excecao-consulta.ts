"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { estadoDiario } from "./estado";

export async function listarExcecoesGravacao(input: { apenasPendentes?: boolean; cursor?: string } = {}) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ apenasPendentes: z.boolean().default(true), cursor: z.string().min(1).optional() }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo) throw new ErroPermissao();
      const gestao = u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
      if (!gestao && !u.papeis.includes("PROFESSOR")) throw new ErroPermissao();
      const where: Prisma.ExcecaoGravacaoEncontroWhereInput = { ...(gestao ? {} : { solicitanteId: autor.id }), ...(d.apenasPendentes ? { decisao: { is: null } } : {}) };
      if (d.cursor && !await tx.excecaoGravacaoEncontro.count({ where: { ...where, id: d.cursor } })) throw new ErroPermissao("Página indisponível para seu acesso.");
      const registros = await tx.excecaoGravacaoEncontro.findMany({ where, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 31,
        ...(d.cursor ? { cursor: { id: d.cursor }, skip: 1 } : {}),
        select: { id: true, encontroId: true, solicitanteId: true, motivo: true, criadoEm: true, snapshot: true,
          solicitante: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, decididaEm: true } },
          encontro: { select: { inicio: true, fim: true, fusoOrigem: true, status: true,
            diario: { select: { id: true, conteudo: true, atualizadoEm: true, registros: { select: { alunoId: true, nomeAluno: true, presente: true, observacao: true, matriculaId: true, participacao: true }, orderBy: { nomeAluno: "asc" } } } } } } },
      });
      const pagina = registros.slice(0, 30);
      return { itens: pagina.map((p) => ({ id: p.id, encontroId: p.encontroId, professor: p.solicitante.nome,
        motivo: p.motivo, criadoEm: p.criadoEm.toISOString(), inicio: p.encontro.inicio.toISOString(), fim: p.encontro.fim.toISOString(),
        fusoOrigem: p.encontro.fusoOrigem, estadoEncontro: p.encontro.status,
        podeDecidir: gestao && p.solicitanteId !== autor.id && !p.decisao,
        diarioCorresponde: gestao && !!p.encontro.diario && z.object({ estadoDiario: z.string() }).safeParse(p.snapshot).data?.estadoDiario === estadoDiario(p.encontro.diario),
        diarioParaRevisao: gestao && p.encontro.diario ? { conteudo: p.encontro.diario.conteudo,
          registros: p.encontro.diario.registros.map((r) => ({ nomeAluno: r.nomeAluno, presente: r.presente, observacao: r.observacao, participacao: r.participacao })) } : null,
        decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null,
      })), proximoCursor: registros.length > 30 ? pagina[pagina.length - 1].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
