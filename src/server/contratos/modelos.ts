"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor, prepararModeloTx } from "./modelos-tx";
import { PrepararModeloSchema, DecidirModeloSchema } from "./modelo-schema";

export async function prepararModeloContratual(input: z.input<typeof PrepararModeloSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = PrepararModeloSchema.parse(input);
    return prisma.$transaction((tx) => prepararModeloTx(tx, autor.id, d));
  });
}

export async function decidirModeloContratual(input: z.input<typeof DecidirModeloSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR), d = DecidirModeloSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "VersaoModeloContratual" WHERE id = ${d.modeloId} FOR UPDATE`;
      await conferirAutor(tx, autor.id, true);
      const m = await tx.versaoModeloContratual.findUnique({ where: { id: d.modeloId }, include: { decisao: true } });
      if (!m) throw new ErroRegra("Modelo não encontrado.");
      if (m.preparadorId === autor.id) throw new ErroRegra("Outra pessoa da Administração precisa decidir o modelo.");
      if (m.conteudoHash !== d.conteudoHash) throw new ErroRegra("Confira a versão exata do conteúdo antes de decidir.");
      if (m.decisao) {
        if (m.decisao.decisorId === autor.id && m.decisao.aprovada === d.aprovada && m.decisao.motivo === d.motivo) return { id: m.decisao.id };
        throw new ErroRegra("Esta versão já possui decisão. Prepare outra versão para mudanças.");
      }
      const decisao = await tx.decisaoModeloContratual.create({ data: { modeloId: m.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "ModeloContratualPublicado" : "ModeloContratualRejeitado", agregadoTipo: "ModeloContratual", agregadoId: m.id, autorId: autor.id, payload: { decisaoId: decisao.id, versao: m.versao, conteudoHash: m.conteudoHash, motivo: d.motivo } });
      return { id: decisao.id };
    });
  });
}

export async function consultarModelosContratuais(input: { codigo: string; pagina?: number }) {
  await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const d = z.object({ codigo: PrepararModeloSchema.shape.codigo, pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
  const modelos = await prisma.versaoModeloContratual.findMany({ where: { codigo: d.codigo }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
    select: { id: true, codigo: true, versao: true, conteudo: true, conteudoHash: true, motivo: true, criadaEm: true,
      preparador: { select: { id: true, nome: true } }, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { id: true, nome: true } } } } } });
  return { modelos: modelos.slice(0, 20), pagina: d.pagina, temProxima: modelos.length > 20 };
}

export async function listarFamiliasModelos(input: { pagina?: number } = {}) {
  await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const { pagina } = z.object({ pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
  const grupos = await prisma.versaoModeloContratual.groupBy({ by: ["codigo"], orderBy: { codigo: "asc" }, skip: (pagina - 1) * 20, take: 21,
    _max: { versao: true }, _count: { id: true } });
  return { familias: grupos.slice(0, 20).map((g) => ({ codigo: g.codigo, ultimaVersao: g._max.versao!, quantidade: g._count.id })), pagina, temProxima: grupos.length > 20 };
}
