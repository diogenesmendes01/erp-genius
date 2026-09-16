"use server";

import { z } from "zod";
import { FormaAgendaOferta, Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";

const Entrada = z.object({ ofertaId: z.string().min(1), versaoEsperada: z.number().int().nonnegative(),
  formaAgenda: z.nativeEnum(FormaAgendaOferta).nullable(), taxaPreviaAssinatura: z.boolean(), adiantamentoHoraExigido: z.boolean().nullable(), motivo: z.string().trim().min(5).max(2000) }).strict();

export async function configurarEntradaOferta(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR), d = Entrada.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProdutoPais" WHERE id = ${d.ofertaId} FOR UPDATE`;
      const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const oferta = await tx.produtoPais.findUnique({ where: { id: d.ofertaId } });
      if (!oferta) throw new ErroRegra("Oferta não encontrada.");
      if (oferta.versaoEntrada !== d.versaoEsperada) throw new ErroRegra("As regras de entrada mudaram. Atualize a tela e confira novamente.");
      const anterior = { formaAgenda: oferta.formaAgenda, taxaPreviaAssinatura: oferta.taxaPreviaAssinatura, adiantamentoHoraExigido: oferta.adiantamentoHoraExigido, versao: oferta.versaoEntrada };
      const atual = { formaAgenda: d.formaAgenda, taxaPreviaAssinatura: d.taxaPreviaAssinatura, adiantamentoHoraExigido: d.adiantamentoHoraExigido, versao: oferta.versaoEntrada + 1 };
      await tx.produtoPais.update({ where: { id: oferta.id }, data: { formaAgenda: atual.formaAgenda, taxaPreviaAssinatura: atual.taxaPreviaAssinatura, adiantamentoHoraExigido: atual.adiantamentoHoraExigido, versaoEntrada: atual.versao } });
      await registrarEvento(tx, { tipo: "EntradaOfertaConfigurada", agregadoTipo: "ProdutoPais", agregadoId: oferta.id, autorId: autor.id, payload: { anterior, atual, motivo: d.motivo } });
    });
    revalidatePath("/configuracao/catalogo");
  });
}

export async function consultarEntradasOfertas() {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  return prisma.produtoPais.findMany({ orderBy: [{ produtoId: "asc" }, { paisId: "asc" }], select: {
    id: true, moeda: true, oferecido: true, formaAgenda: true, versaoEntrada: true, taxaPreviaAssinatura: true, adiantamentoHoraExigido: true,
    produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } }, pais: { select: { nome: true } },
  } });
}
