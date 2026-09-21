"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

export async function listarRegularizacoesAula(input: { cursor?: string; modo?: "PENDENTES" | "HISTORICO" } = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ cursor: z.string().min(1).optional(), modo: z.enum(["PENDENTES", "HISTORICO"]).default("PENDENTES") }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.PROFESSOR || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const gestao = u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      if (d.modo === "HISTORICO" && !gestao) throw new ErroPermissao();
      const agora = new Date();
      const encontros = await tx.encontroAgenda.findMany({ where: { finalidade: "AULA",
        ...(d.modo === "PENDENTES" ? { status: "PREVISTO" as const, fim: { lte: agora } } : { designacoesRegularizacaoAula: { some: {} } }),
        ...(d.cursor ? { id: { gt: d.cursor } } : {}),
        ...(!gestao ? { designacoesRegularizacaoAula: { some: { responsavelId: usuario.id, revogacao: null } } } : {}),
      }, orderBy: { id: "asc" }, take: 31, select: { id: true, status: true, inicio: true, fim: true, fusoOrigem: true, professorId: true,
        professor: { select: { nome: true } }, turma: { select: { codigo: true } },
        designacoesRegularizacaoAula: { where: { revogacao: null }, select: { id: true, responsavelId: true, responsavel: { select: { nome: true } } } },
      } });
      const pagina = encontros.slice(0, 30);
      return { gestao, modo: d.modo, itens: pagina.map(e => ({ id: e.id, status: e.status, podeGerir: gestao && e.status === "PREVISTO" && e.fim <= agora, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem,
        turma: e.turma?.codigo ?? (e.turma ? "Turma sem código" : "Particular"), professor: e.professor?.nome ?? "Professor não identificado",
        podeRegularizar: e.status === "PREVISTO" && e.fim <= agora && (e.designacoesRegularizacaoAula.some(a => a.responsavelId === usuario.id) || e.professorId === usuario.id && u.papeis.includes(Papel.PROFESSOR)),
        designacao: e.designacoesRegularizacaoAula[0] ? { id: e.designacoesRegularizacaoAula[0].id, responsavel: e.designacoesRegularizacaoAula[0].responsavel.nome } : null,
      })), proximoCursor: encontros.length > 30 ? pagina[pagina.length - 1].id : null };
    });
  });
}

export async function consultarDesignacoesAula(input: { encontroId: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { finalidade: true, status: true, fim: true } });
      if (!e || e.finalidade !== "AULA") throw new ErroRegra("Aula não encontrada.");
      const historico = await tx.designacaoRegularizacaoAula.findMany({ where: { encontroId: d.encontroId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
        select: { id: true, motivo: true, criadaEm: true, responsavel: { select: { nome: true } }, designador: { select: { nome: true } },
          revogacao: { select: { motivo: true, criadaEm: true, revogador: { select: { nome: true } } } } } });
      const podeGerir = e.status === "PREVISTO" && e.fim <= new Date();
      const responsaveis = podeGerir ? await tx.usuario.findMany({ where: { ativo: true, papeis: { hasSome: [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR] } }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true } }) : [];
      return { podeGerir, responsaveis, historico: historico.map(h => ({ id: h.id, motivo: h.motivo, criadaEm: h.criadaEm.toISOString(), responsavel: h.responsavel.nome,
        designador: h.designador.nome, revogacao: h.revogacao ? { motivo: h.revogacao.motivo, criadaEm: h.revogacao.criadaEm.toISOString(), revogador: h.revogacao.revogador.nome } : null })) };
    });
  });
}
