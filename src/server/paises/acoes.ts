"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusPais } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import { PaisSchema, type PaisInput } from "./schema";

const PATH = "/configuracao/paises";

/** Habilita/desabilita um produto (idioma×modalidade) no país — doc 04/09. */
export async function alternarProdutoPais(paisId: string, produtoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const pais = await prisma.pais.findUnique({ where: { id: paisId } });
    if (!pais) throw new ErroRegra("País não encontrado.");
    const existente = await prisma.produtoPais.findUnique({
      where: { produtoId_paisId: { produtoId, paisId } },
    });
    const oferecido = existente ? !existente.oferecido : true;
    await prisma.$transaction(async (tx) => {
      if (existente) {
        await tx.produtoPais.update({ where: { id: existente.id }, data: { oferecido } });
      } else {
        await tx.produtoPais.create({ data: { produtoId, paisId, moeda: pais.moedaLocal, oferecido: true } });
      }
      await registrarEvento(tx, {
        tipo: oferecido ? "ProdutoHabilitadoPais" : "ProdutoDesabilitadoPais",
        agregadoTipo: "Pais",
        agregadoId: paisId,
        autorId: autor.id,
        payload: { produtoId, oferecido },
      });
    });
    revalidatePath(PATH);
  });
}

export async function criarPais(input: PaisInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = PaisSchema.parse(input);

    const existente = await prisma.pais.findUnique({ where: { codigoISO: dados.codigoISO } });
    if (existente) throw new ErroRegra(`Já existe país com código ${dados.codigoISO}.`);

    const id = await prisma.$transaction(async (tx) => {
      const pais = await tx.pais.create({
        data: {
          nome: dados.nome,
          codigoISO: dados.codigoISO,
          moedaLocal: dados.moedaLocal,
          ddi: dados.ddi,
          fuso: dados.fuso,
          idioma: dados.idioma,
          status: StatusPais.RASCUNHO,
          tiposDocumento: { create: dados.tiposDocumento },
        },
      });
      await registrarEvento(tx, {
        tipo: "PaisCriado",
        agregadoTipo: "Pais",
        agregadoId: pais.id,
        autorId: autor.id,
        payload: { nome: pais.nome, codigoISO: pais.codigoISO },
      });
      return pais.id;
    });

    revalidatePath(PATH);
    return { id };
  });
}

export async function editarPais(id: string, input: PaisInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = PaisSchema.parse(input);

    const atual = await prisma.pais.findUnique({ where: { id } });
    if (!atual) throw new ErroRegra("País não encontrado.");

    if (dados.codigoISO !== atual.codigoISO) {
      const colide = await prisma.pais.findUnique({ where: { codigoISO: dados.codigoISO } });
      if (colide) throw new ErroRegra(`Já existe país com código ${dados.codigoISO}.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.tipoDocumento.deleteMany({ where: { paisId: id } });
      await tx.pais.update({
        where: { id },
        data: {
          nome: dados.nome,
          codigoISO: dados.codigoISO,
          moedaLocal: dados.moedaLocal,
          ddi: dados.ddi,
          fuso: dados.fuso,
          idioma: dados.idioma,
          tiposDocumento: { create: dados.tiposDocumento },
        },
      });
      await registrarEvento(tx, {
        tipo: "PaisEditado",
        agregadoTipo: "Pais",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: { nome: atual.nome, moeda: atual.moedaLocal }, para: { nome: dados.nome, moeda: dados.moedaLocal } },
      });
    });

    revalidatePath(PATH);
  });
}

const EVENTO_STATUS: Record<StatusPais, string> = {
  RASCUNHO: "PaisRascunho",
  ATIVO: "PaisAtivado",
  PAUSADO: "PaisPausado",
  ENCERRADO: "PaisEncerrado",
};

export async function alterarStatusPais(id: string, novoStatus: StatusPais): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);

    const pais = await prisma.pais.findUnique({
      where: { id },
      include: { _count: { select: { tiposDocumento: true, precos: true } } },
    });
    if (!pais) throw new ErroRegra("País não encontrado.");

    // Checklist de prontidão (doc 04): para ATIVAR exige moeda + doc + ≥1 preço.
    if (novoStatus === StatusPais.ATIVO) {
      if (!pais.moedaLocal) throw new ErroRegra("Defina a moeda antes de ativar.");
      if (pais._count.tiposDocumento === 0)
        throw new ErroRegra("Cadastre ao menos um tipo de documento antes de ativar.");
      if (pais._count.precos === 0)
        throw new ErroRegra("Cadastre ao menos um produto com preço (Catálogo) antes de ativar.");
    }

    if (pais.status === novoStatus) return;

    await prisma.$transaction(async (tx) => {
      await tx.pais.update({ where: { id }, data: { status: novoStatus } });
      await registrarEvento(tx, {
        tipo: EVENTO_STATUS[novoStatus],
        agregadoTipo: "Pais",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: pais.status, para: novoStatus },
      });
    });

    revalidatePath(PATH);
  });
}
