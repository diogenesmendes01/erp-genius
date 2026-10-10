"use server";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { z } from "zod";

const Pagina = z.number().int().min(1).max(PAGINA_MAXIMA).optional();

/** Avisos e pendências, cada lista com a própria página numerada (E4); ordem por id, estável na ida e na volta. */
export async function consultarAvisosAlteracaoAgenda(input: { pagina?: number; paginaPendencias?: number } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const { pagina = 1, paginaPendencias = 1 } = z.object({ pagina: Pagina, paginaPendencias: Pagina }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const linhasLidas = await tx.avisoAlteracaoAgenda.findMany({ ...janelaDaPagina(pagina, 20), orderBy: { id: "desc" }, select: { id: true, matriculaId: true, canal: true, situacao: true, criadoEm: true, atualizadoEm: true, aluno: { select: { primeiroNome: true, sobrenome: true } }, itens: { select: { encontroId: true } } } });
      const avisos = recorteDaPagina(linhasLidas, 20);
      const pendenciasLidas = await tx.pendenciaAvisoAgenda.findMany({ ...janelaDaPagina(paginaPendencias, 20), orderBy: { id: "desc" }, select: { id: true, matriculaId: true, motivo: true, situacao: true, criadoEm: true, resolvidaEm: true, observacaoResolucao: true, matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } }, }, resolvidaPor: { select: { nome: true } } } });
      const pendencias = recorteDaPagina(pendenciasLidas, 20);
      return {
        itens: avisos.registros.map(linha => ({ id: linha.id, matriculaId: linha.matriculaId, canal: linha.canal, situacao: linha.situacao, criadoEm: linha.criadoEm, atualizadoEm: linha.atualizadoEm, alunoNome: [linha.aluno.primeiroNome, linha.aluno.sobrenome].filter(Boolean).join(" "), encontros: linha.itens.map(item => item.encontroId) })),
        pagina, temProxima: avisos.temProxima,
        pendencias: pendencias.registros.map(p => ({ id: p.id, matriculaId: p.matriculaId, matriculaCodigo: p.matricula.codigo, alunoNome: [p.matricula.aluno.primeiroNome, p.matricula.aluno.sobrenome].filter(Boolean).join(" "), motivo: p.motivo, situacao: p.situacao, criadoEm: p.criadoEm, resolvidaEm: p.resolvidaEm, resolvidaPorNome: p.resolvidaPor?.nome ?? null, observacaoResolucao: p.observacaoResolucao })),
        paginaPendencias, temProximaPendencia: pendencias.temProxima,
      };
    }, { isolationLevel: "RepeatableRead" });
  });
}
