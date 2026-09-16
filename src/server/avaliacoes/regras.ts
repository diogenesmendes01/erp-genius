"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { ConteudoRegraAvaliacaoSchema, DecidirRegraAvaliacaoSchema, PrepararRegraAvaliacaoSchema } from "./regra-schema";
import { conferirGestorAvaliacao, decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";

export async function prepararRegraAvaliacao(input: z.input<typeof PrepararRegraAvaliacaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, u.id, input));
  });
}

export async function decidirRegraAvaliacao(input: z.input<typeof DecidirRegraAvaliacaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, u.id, input));
  });
}

export async function consultarRegrasAvaliacao(input: { nivelId: string; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ nivelId: PrepararRegraAvaliacaoSchema.shape.nivelId, pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${d.nivelId}`}, 0))`;
      await conferirGestorAvaliacao(tx, u.id);
      const nivel = await tx.nivel.findUnique({ where: { id: d.nivelId }, select: { id: true, codigo: true, idioma: { select: { nome: true } } } });
      if (!nivel) throw new ErroRegra("Nível não encontrado.");
      const select = { id: true, nivelId: true, versao: true, conteudo: true, conteudoHash: true, motivo: true, criadaEm: true,
        preparador: { select: { id: true, nome: true } }, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { id: true, nome: true } } } } } as const;
      const regras = await tx.versaoRegraAvaliacao.findMany({ where: { nivelId: d.nivelId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21, select });
      const vigente = await tx.versaoRegraAvaliacao.findFirst({ where: { nivelId: d.nivelId, decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
      const ultima = await tx.versaoRegraAvaliacao.findFirst({ where: { nivelId: d.nivelId }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
      return { nivel, ultimaVersao: ultima?.versao ?? 0,
        regras: regras.slice(0, 20).map(r => ({ ...r, conteudo: ConteudoRegraAvaliacaoSchema.parse(r.conteudo), podeDecidir: !r.decisao && r.preparador.id !== u.id,
          podeAprovar: !r.decisao && r.preparador.id !== u.id && r.id === ultima?.id })),
        vigente, pagina: d.pagina, temProxima: regras.length > 20 };
    });
  });
}

export async function listarNiveisRegrasAvaliacao(input: { busca?: string; pagina?: number } = {}) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ busca: z.string().trim().max(100).default(""), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const niveis = await tx.nivel.findMany({ where: { OR: [{ codigo: { contains: d.busca, mode: "insensitive" } }, { idioma: { nome: { contains: d.busca, mode: "insensitive" } } }] },
        orderBy: [{ idioma: { nome: "asc" } }, { ordem: "asc" }, { id: "asc" }], skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, codigo: true, idioma: { select: { nome: true } } } });
      return { niveis: niveis.slice(0, 30), busca: d.busca, pagina: d.pagina, temProxima: niveis.length > 30 };
    });
  });
}
