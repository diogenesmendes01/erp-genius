"use server";

import { revalidatePath } from "next/cache";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  irmaosParaInativar,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import {
  IdiomaSchema,
  ModalidadeSchema,
  NivelSchema,
  ProdutoSchema,
  PrecoSchema,
  type IdiomaInput,
  type ModalidadeInput,
  type NivelInput,
  type ProdutoInput,
  type PrecoInput,
} from "./schema";

const PATH = "/configuracao/catalogo";

// ----- Idiomas -----
export async function criarIdioma(input: IdiomaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = IdiomaSchema.parse(input);
    const id = await prisma.$transaction(async (tx) => {
      const idioma = await tx.idioma.create({ data: { nome: dados.nome } });
      await registrarEvento(tx, {
        tipo: "IdiomaCriado",
        agregadoTipo: "Idioma",
        agregadoId: idioma.id,
        autorId: autor.id,
        payload: { nome: idioma.nome },
      });
      return idioma.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

export async function alternarIdiomaAtivo(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const idioma = await prisma.idioma.findUnique({ where: { id } });
    if (!idioma) throw new ErroRegra("Idioma não encontrado.");
    await prisma.$transaction(async (tx) => {
      await tx.idioma.update({ where: { id }, data: { ativo: !idioma.ativo } });
      await registrarEvento(tx, {
        tipo: idioma.ativo ? "IdiomaDesativado" : "IdiomaAtivado",
        agregadoTipo: "Idioma",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: idioma.ativo, para: !idioma.ativo },
      });
    });
    revalidatePath(PATH);
  });
}

// ----- Modalidades -----
export async function criarModalidade(input: ModalidadeInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = ModalidadeSchema.parse(input);
    const id = await prisma.$transaction(async (tx) => {
      const m = await tx.modalidade.create({
        data: {
          nome: dados.nome,
          segmento: dados.segmento,
          frequencia: dados.frequencia,
          horasAula: dados.horasAula,
          duracaoPorNivel: dados.duracaoPorNivel,
          aulasPorNivel: dados.aulasPorNivel,
          minimoAbrir: dados.minimoAbrir,
        },
      });
      await registrarEvento(tx, {
        tipo: "ModalidadeCriada",
        agregadoTipo: "Modalidade",
        agregadoId: m.id,
        autorId: autor.id,
        payload: { nome: m.nome, segmento: m.segmento, minimoAbrir: m.minimoAbrir },
      });
      return m.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

export async function editarModalidade(id: string, input: ModalidadeInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = ModalidadeSchema.parse(input);
    const atual = await prisma.modalidade.findUnique({ where: { id } });
    if (!atual) throw new ErroRegra("Modalidade não encontrada.");
    await prisma.$transaction(async (tx) => {
      await tx.modalidade.update({
        where: { id },
        data: {
          nome: dados.nome,
          segmento: dados.segmento,
          frequencia: dados.frequencia,
          horasAula: dados.horasAula,
          duracaoPorNivel: dados.duracaoPorNivel,
          aulasPorNivel: dados.aulasPorNivel,
          minimoAbrir: dados.minimoAbrir,
        },
      });
      await registrarEvento(tx, {
        tipo: "ModalidadeEditada",
        agregadoTipo: "Modalidade",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          de: { minimoAbrir: atual.minimoAbrir, nome: atual.nome },
          para: { minimoAbrir: dados.minimoAbrir, nome: dados.nome },
        },
      });
    });
    revalidatePath(PATH);
  });
}

// ----- Níveis -----
export async function criarNivel(input: NivelInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = NivelSchema.parse(input);
    const idioma = await prisma.idioma.findUnique({ where: { id: dados.idiomaId } });
    if (!idioma) throw new ErroRegra("Idioma não encontrado.");
    const id = await prisma.$transaction(async (tx) => {
      const n = await tx.nivel.create({
        data: { idiomaId: dados.idiomaId, codigo: dados.codigo, ordem: dados.ordem },
      });
      await registrarEvento(tx, {
        tipo: "NivelCriado",
        agregadoTipo: "Nivel",
        agregadoId: n.id,
        autorId: autor.id,
        payload: { idiomaId: dados.idiomaId, codigo: n.codigo, ordem: n.ordem },
      });
      return n.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

// ----- Produtos (idioma × modalidade) -----
export async function criarProduto(input: ProdutoInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = ProdutoSchema.parse(input);

    const dup = await prisma.produto.findFirst({
      where: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId },
    });
    if (dup) throw new ErroRegra("Já existe um produto para esse idioma + modalidade.");

    const id = await prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId },
      });
      await registrarEvento(tx, {
        tipo: "ProdutoCriado",
        agregadoTipo: "Produto",
        agregadoId: p.id,
        autorId: autor.id,
        payload: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId },
      });
      return p.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

// ----- Preços (PrecoReferencia). Nova versão supersede a ativa do mesmo conjunto. -----
export async function criarPreco(input: PrecoInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = PrecoSchema.parse(input);

    const produto = await prisma.produto.findUnique({ where: { id: dados.produtoId } });
    if (!produto) throw new ErroRegra("Produto não encontrado.");
    const pais = await prisma.pais.findUnique({ where: { id: dados.paisId } });
    if (!pais) throw new ErroRegra("País não encontrado.");

    const chave = {
      paisId: dados.paisId,
      produtoId: dados.produtoId,
      modalidadeId: produto.modalidadeId,
      tipoCobranca: dados.tipoCobranca,
    };

    const id = await prisma.$transaction(async (tx) => {
      // supersede: desativa o preço ativo anterior do mesmo conjunto (mantém histórico)
      await tx.precoReferencia.updateMany({ where: { ...chave, ativo: true }, data: { ativo: false } });
      const preco = await tx.precoReferencia.create({
        data: {
          ...chave,
          valor: dados.valor,
          moeda: pais.moedaLocal,
          ativo: true,
          versaoEstudo: dados.versaoEstudo || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "PrecoDefinido",
        agregadoTipo: "Preco",
        agregadoId: preco.id,
        autorId: autor.id,
        payload: { ...chave, valor: dados.valor, moeda: pais.moedaLocal },
      });
      return preco.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

export async function alternarPrecoAtivo(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const preco = await prisma.precoReferencia.findUnique({ where: { id } });
    if (!preco) throw new ErroRegra("Preço não encontrado.");

    const reativando = !preco.ativo;
    const chave = {
      paisId: preco.paisId,
      produtoId: preco.produtoId,
      modalidadeId: preco.modalidadeId,
      tipoCobranca: preco.tipoCobranca,
    };

    await prisma.$transaction(async (tx) => {
      // Ao reativar, supersede: inativa os irmãos ativos da mesma combinação
      // (país/produto/modalidade/tipo) para nunca haver dois preços ativos.
      // Mesmo comportamento de criarPreco — mantém histórico, só um fica ativo.
      let inativados: string[] = [];
      if (reativando) {
        const irmaosAtivos = await tx.precoReferencia.findMany({
          where: { ...chave, ativo: true },
          select: { id: true, paisId: true, produtoId: true, modalidadeId: true, tipoCobranca: true },
        });
        inativados = irmaosParaInativar({ id, ...chave }, irmaosAtivos);
        if (inativados.length > 0) {
          await tx.precoReferencia.updateMany({
            where: { id: { in: inativados } },
            data: { ativo: false },
          });
        }
      }

      await tx.precoReferencia.update({ where: { id }, data: { ativo: reativando } });
      await registrarEvento(tx, {
        tipo: reativando ? "PrecoReativado" : "PrecoDesativado",
        agregadoTipo: "Preco",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          de: preco.ativo,
          para: reativando,
          ...(inativados.length > 0 ? { irmaosInativados: inativados } : {}),
        },
      });
    });
    revalidatePath(PATH);
  });
}
