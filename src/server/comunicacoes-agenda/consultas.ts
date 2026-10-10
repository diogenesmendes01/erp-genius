"use server";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { camposNavegacaoFila, corteDoId, direcaoDeLeitura, lerPaginaDaFila, MENSAGEM_CURSOR_INVALIDO, MENSAGEM_DOIS_SENTIDOS, umSentido, CURSOR_FILA } from "@/lib/cursor-fila";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { z } from "zod";

const cursorPendencias = z.string().regex(CURSOR_FILA, MENSAGEM_CURSOR_INVALIDO).optional();
const Entrada = z.object({ ...camposNavegacaoFila, depoisPendencias: cursorPendencias, antesPendencias: cursorPendencias }).strict()
  .refine(umSentido, MENSAGEM_DOIS_SENTIDOS)
  .refine((d) => umSentido({ depois: d.depoisPendencias, antes: d.antesPendencias }), MENSAGEM_DOIS_SENTIDOS);

/**
 * Avisos e pendências: duas filas de trabalho, cada uma com o próprio cursor nos dois sentidos (E4, decisão de
 * 10/10/2026) — `depois`/`antes` dos avisos e `depoisPendencias`/`antesPendencias` das pendências. Em ordem de id
 * decrescente (o mais novo primeiro): um aviso ou uma pendência nova entra no topo sem deslocar a página de quem já
 * avançou, e a próxima continua do último item visto.
 */
export async function consultarAvisosAlteracaoAgenda(input: z.input<typeof Entrada> = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const d = Entrada.parse(input);
    const navAvisos = { depois: d.depois, antes: d.antes }, navPendencias = { depois: d.depoisPendencias, antes: d.antesPendencias };
    return prisma.$transaction(async tx => {
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const avisos = await lerPaginaDaFila(navAvisos, 20, (leitura, take) => tx.avisoAlteracaoAgenda.findMany({ where: corteDoId(leitura, "desc"), take, orderBy: { id: direcaoDeLeitura(leitura)("desc") }, select: { id: true, matriculaId: true, canal: true, situacao: true, criadoEm: true, atualizadoEm: true, aluno: { select: { primeiroNome: true, sobrenome: true } }, itens: { select: { encontroId: true } } } }), (linha) => linha.id);
      const pendencias = await lerPaginaDaFila(navPendencias, 20, (leitura, take) => tx.pendenciaAvisoAgenda.findMany({ where: corteDoId(leitura, "desc"), take, orderBy: { id: direcaoDeLeitura(leitura)("desc") }, select: { id: true, matriculaId: true, motivo: true, situacao: true, criadoEm: true, resolvidaEm: true, observacaoResolucao: true, matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } }, }, resolvidaPor: { select: { nome: true } } } }), (p) => p.id);
      return {
        itens: avisos.registros.map(linha => ({ id: linha.id, matriculaId: linha.matriculaId, canal: linha.canal, situacao: linha.situacao, criadoEm: linha.criadoEm, atualizadoEm: linha.atualizadoEm, alunoNome: [linha.aluno.primeiroNome, linha.aluno.sobrenome].filter(Boolean).join(" "), encontros: linha.itens.map(item => item.encontroId) })),
        temAnterior: avisos.temAnterior, temProxima: avisos.temProxima, anterior: avisos.anterior, proxima: avisos.proxima,
        pendencias: pendencias.registros.map(p => ({ id: p.id, matriculaId: p.matriculaId, matriculaCodigo: p.matricula.codigo, alunoNome: [p.matricula.aluno.primeiroNome, p.matricula.aluno.sobrenome].filter(Boolean).join(" "), motivo: p.motivo, situacao: p.situacao, criadoEm: p.criadoEm, resolvidaEm: p.resolvidaEm, resolvidaPorNome: p.resolvidaPor?.nome ?? null, observacaoResolucao: p.observacaoResolucao })),
        temAnteriorPendencia: pendencias.temAnterior, temProximaPendencia: pendencias.temProxima, anteriorPendencia: pendencias.anterior, proximaPendencia: pendencias.proxima,
      };
    }, { isolationLevel: "RepeatableRead" });
  });
}
