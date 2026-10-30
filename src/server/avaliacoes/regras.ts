"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { DecidirRegraAvaliacaoSchema, lerConteudoRegra, PrepararRegraAvaliacaoSchema } from "./regra-schema";
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
      const lidas = regras.slice(0, 20).map(r => ({ r, leitura: lerConteudoRegra(r.conteudo) }));
      // #530 (WARN-532-01 / C2): o formulário de nova versão parte da versão mais recente VÁLIDA no schema
      // atual (estrita). Legado normalizado nunca pré-preenche: os defaults de compatibilidade não podem
      // virar valores reais. Sem nenhuma válida, abre vazio.
      let conteudoInicial = lidas.find(l => l.leitura.ok && !l.leitura.legado)?.leitura;
      if (!conteudoInicial && regras.length) {
        for (const v of await tx.versaoRegraAvaliacao.findMany({ where: { nivelId: d.nivelId }, orderBy: { versao: "desc" }, select: { conteudo: true } })) {
          const l = lerConteudoRegra(v.conteudo);
          if (l.ok && !l.legado) { conteudoInicial = l; break; }
        }
      }
      return { nivel, ultimaVersao: ultima?.versao ?? 0, conteudoInicial: conteudoInicial?.ok ? conteudoInicial.conteudo : null,
        // #530: leitura tolerante a versões legadas. Versão legada (normalizada ou ilegível) é só leitura:
        // não pode ser decidida, e a ilegível não entra como conteúdo inicial do formulário.
        regras: lidas.map(({ r, leitura }) => {
          if (!leitura.ok) console.warn("regra-avaliacao-legada", { regraId: r.id, caminhos: leitura.caminhos });
          const decidivel = !r.decisao && r.preparador.id !== u.id && !leitura.legado;
          return { ...r, conteudo: leitura.ok ? leitura.conteudo : null, legado: leitura.legado, ilegivel: !leitura.ok,
            podeDecidir: decidivel, podeAprovar: decidivel && r.id === ultima?.id };
        }),
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
