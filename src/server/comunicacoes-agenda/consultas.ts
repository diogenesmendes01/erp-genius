"use server";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { z } from "zod";

export async function consultarAvisosAlteracaoAgenda(input: { cursor?: string; pendenciaCursor?: string } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const { cursor, pendenciaCursor } = z.object({ cursor: z.string().min(1).optional(), pendenciaCursor: z.string().min(1).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const linhas = await tx.avisoAlteracaoAgenda.findMany({ take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: "desc" }, select: { id: true, matriculaId: true, canal: true, situacao: true, criadoEm: true, atualizadoEm: true, aluno: { select: { primeiroNome: true, sobrenome: true } }, itens: { select: { encontroId: true } } } });
      const proximoCursor = linhas.length > 20 ? linhas[20].id : null;
      const pendencias = await tx.pendenciaAvisoAgenda.findMany({ take: 21, ...(pendenciaCursor ? { cursor: { id: pendenciaCursor }, skip: 1 } : {}), orderBy: { id: "desc" }, select: { id: true, matriculaId: true, motivo: true, situacao: true, criadoEm: true, resolvidaEm: true, observacaoResolucao: true, matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } }, }, resolvidaPor: { select: { nome: true } } } });
      const proximoCursorPendencia = pendencias.length > 20 ? pendencias[20].id : null;
      return { itens: linhas.slice(0, 20).map(linha => ({ id: linha.id, matriculaId: linha.matriculaId, canal: linha.canal, situacao: linha.situacao, criadoEm: linha.criadoEm, atualizadoEm: linha.atualizadoEm, alunoNome: [linha.aluno.primeiroNome, linha.aluno.sobrenome].filter(Boolean).join(" "), encontros: linha.itens.map(item => item.encontroId) })), proximoCursor, pendencias: pendencias.slice(0, 20).map(p => ({ id: p.id, matriculaId: p.matriculaId, matriculaCodigo: p.matricula.codigo, alunoNome: [p.matricula.aluno.primeiroNome, p.matricula.aluno.sobrenome].filter(Boolean).join(" "), motivo: p.motivo, situacao: p.situacao, criadoEm: p.criadoEm, resolvidaEm: p.resolvidaEm, resolvidaPorNome: p.resolvidaPor?.nome ?? null, observacaoResolucao: p.observacaoResolucao })), proximoCursorPendencia };
    }, { isolationLevel: "RepeatableRead" });
  });
}
