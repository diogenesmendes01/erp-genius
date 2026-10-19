"use server";

import { revalidatePath } from "next/cache";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { marcaIdempotencia, repeticaoIdempotente, type MarcaIdempotencia } from "@/server/_shared/idempotencia";
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
  CriarModalidadeSchema,
  NivelSchema,
  ProdutoSchema,
  PrecoSchema,
  type IdiomaInput,
  type ModalidadeInput,
  type CriarModalidadeInput,
  type NivelInput,
  type ProdutoInput,
  type PrecoInput,
} from "./schema";

const PATH = "/configuracao/catalogo";

/**
 * Idempotência das criações (#166): com a marca da tentativa, trava a chave do autor e devolve o id já
 * criado por ela (repetição idêntica), ou `null` para criar e gravar a marca no Evento de criação.
 */
async function idDaRepeticao(
  tx: Prisma.TransactionClient,
  alvo: { tipo: string; agregadoTipo: string; autorId: string; marca: MarcaIdempotencia | null; oQue: string },
): Promise<string | null> {
  if (!alvo.marca) return null;
  const evento = await repeticaoIdempotente(tx, {
    tipo: alvo.tipo, agregadoTipo: alvo.agregadoTipo, autorId: alvo.autorId, marca: alvo.marca,
    mensagemConflito: `Esta tentativa já foi usada com outros dados. Recarregue a página e confira se ${alvo.oQue} já aparece antes de repetir.`,
  });
  return evento?.agregadoId ?? null;
}

// ----- Idiomas -----
export async function criarIdioma(input: IdiomaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const { chaveIdempotencia, ...dados } = IdiomaSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const id = await prisma.$transaction(async (tx) => {
      const repetido = await idDaRepeticao(tx, { tipo: "IdiomaCriado", agregadoTipo: "Idioma", autorId: autor.id, marca, oQue: "o idioma" });
      if (repetido) return repetido;
      const idioma = await tx.idioma.create({ data: { nome: dados.nome } });
      await registrarEvento(tx, {
        tipo: "IdiomaCriado",
        agregadoTipo: "Idioma",
        agregadoId: idioma.id,
        autorId: autor.id,
        payload: { nome: idioma.nome, ...marca },
      });
      return idioma.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

/**
 * Ativa ou desativa o idioma com o estado-alvo explícito (B4, #175 C2): quem confirma com a tela velha o estado em
 * que o idioma já está não desfaz a mudança de um colega — é um no-op, sem evento. A linha é travada na transação
 * para que duas confirmações simultâneas leiam o estado uma depois da outra.
 */
export async function definirIdiomaAtivo(id: string, ativo: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    if (typeof id !== "string" || !id.trim()) throw new ErroRegra("Idioma não informado.");
    if (typeof ativo !== "boolean") throw new ErroRegra("Situação do idioma inválida.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Idioma" WHERE id = ${id} FOR UPDATE`;
      const idioma = await tx.idioma.findUnique({ where: { id }, select: { ativo: true } });
      if (!idioma) throw new ErroRegra("Idioma não encontrado.");
      if (idioma.ativo === ativo) return;
      await tx.idioma.update({ where: { id }, data: { ativo } });
      await registrarEvento(tx, {
        tipo: ativo ? "IdiomaAtivado" : "IdiomaDesativado",
        agregadoTipo: "Idioma",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: idioma.ativo, para: ativo },
      });
    });
    revalidatePath(PATH);
  });
}

// ----- Modalidades -----
export async function criarModalidade(input: CriarModalidadeInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const { chaveIdempotencia, ...dados } = CriarModalidadeSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const id = await prisma.$transaction(async (tx) => {
      const repetido = await idDaRepeticao(tx, { tipo: "ModalidadeCriada", agregadoTipo: "Modalidade", autorId: autor.id, marca, oQue: "a modalidade" });
      if (repetido) return repetido;
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
        payload: { nome: m.nome, segmento: m.segmento, minimoAbrir: m.minimoAbrir, ...marca },
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
    if (atual.aulasPorNivel !== dados.aulasPorNivel) throw new ErroRegra("A quantidade de aulas segue revisão conjunta em Acadêmico > Quantidade de aulas da modalidade.");
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
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const { chaveIdempotencia, ...dados } = NivelSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const idioma = await prisma.idioma.findUnique({ where: { id: dados.idiomaId } });
    if (!idioma) throw new ErroRegra("Idioma não encontrado.");
    const id = await prisma.$transaction(async (tx) => {
      const repetido = await idDaRepeticao(tx, { tipo: "NivelCriado", agregadoTipo: "Nivel", autorId: autor.id, marca, oQue: "o nível" });
      if (repetido) return repetido;
      const n = await tx.nivel.create({
        data: { idiomaId: dados.idiomaId, codigo: dados.codigo, ordem: dados.ordem },
      });
      await registrarEvento(tx, {
        tipo: "NivelCriado",
        agregadoTipo: "Nivel",
        agregadoId: n.id,
        autorId: autor.id,
        payload: { idiomaId: dados.idiomaId, codigo: n.codigo, ordem: n.ordem, ...marca },
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
    const { chaveIdempotencia, ...dados } = ProdutoSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);

    const id = await prisma.$transaction(async (tx) => {
      // A repetição vem antes da conferência de duplicado: o produto que a própria tentativa criou não é
      // "outro" produto, e o reenvio devolve ele em vez do erro.
      const repetido = await idDaRepeticao(tx, { tipo: "ProdutoCriado", agregadoTipo: "Produto", autorId: autor.id, marca, oQue: "o produto" });
      if (repetido) return repetido;
      const dup = await tx.produto.findFirst({
        where: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId },
      });
      if (dup) throw new ErroRegra("Já existe um produto para esse idioma + modalidade.");
      const p = await tx.produto.create({
        data: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId },
      });
      await registrarEvento(tx, {
        tipo: "ProdutoCriado",
        agregadoTipo: "Produto",
        agregadoId: p.id,
        autorId: autor.id,
        payload: { idiomaId: dados.idiomaId, modalidadeId: dados.modalidadeId, ...marca },
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
    const { chaveIdempotencia, ...dados } = PrecoSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados);

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
      // O reenvio da mesma tentativa devolve o preço criado por ela, sem aposentá-lo com uma cópia.
      const repetido = await idDaRepeticao(tx, { tipo: "PrecoDefinido", agregadoTipo: "Preco", autorId: autor.id, marca, oQue: "o preço" });
      if (repetido) return repetido;
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
        payload: { ...chave, valor: dados.valor, moeda: pais.moedaLocal, ...marca },
      });
      return preco.id;
    });
    revalidatePath(PATH);
    return { id };
  });
}

/**
 * Ativa ou desativa o preço de referência com o estado-alvo explícito (B4, #175 C2). Se o preço já está no estado
 * pedido, nada muda e nenhum evento é gravado — em especial, confirmar "reativar" com a tela velha não aposenta o
 * preço que um colega acabou de ativar. A combinação é travada na transação (mesma chave de `criarPreco`).
 */
export async function definirPrecoAtivo(id: string, ativo: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    if (typeof id !== "string" || !id.trim()) throw new ErroRegra("Preço não informado.");
    if (typeof ativo !== "boolean") throw new ErroRegra("Situação do preço inválida.");

    await prisma.$transaction(async (tx) => {
      const alvo = await tx.precoReferencia.findUnique({
        where: { id },
        select: { paisId: true, produtoId: true, modalidadeId: true, tipoCobranca: true },
      });
      if (!alvo) throw new ErroRegra("Preço não encontrado.");
      const chave = {
        paisId: alvo.paisId,
        produtoId: alvo.produtoId,
        modalidadeId: alvo.modalidadeId,
        tipoCobranca: alvo.tipoCobranca,
      };
      // Trava todos os preços da combinação, em ordem estável: duas reativações concorrentes de irmãos não
      // deixam dois preços ativos, e o estado lido abaixo é o que vale na hora de gravar.
      await tx.$queryRaw`SELECT id FROM "PrecoReferencia" WHERE "paisId" = ${chave.paisId} AND "produtoId" = ${chave.produtoId} AND "modalidadeId" = ${chave.modalidadeId} AND "tipoCobranca"::text = ${chave.tipoCobranca} ORDER BY id FOR UPDATE`;
      const preco = await tx.precoReferencia.findUnique({ where: { id }, select: { ativo: true } });
      if (!preco) throw new ErroRegra("Preço não encontrado.");
      if (preco.ativo === ativo) return;

      // Ao reativar, supersede: inativa os irmãos ativos da mesma combinação
      // (país/produto/modalidade/tipo) para nunca haver dois preços ativos.
      // Mesmo comportamento de criarPreco — mantém histórico, só um fica ativo.
      let inativados: string[] = [];
      if (ativo) {
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

      await tx.precoReferencia.update({ where: { id }, data: { ativo } });
      await registrarEvento(tx, {
        tipo: ativo ? "PrecoReativado" : "PrecoDesativado",
        agregadoTipo: "Preco",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          de: preco.ativo,
          para: ativo,
          ...(inativados.length > 0 ? { irmaosInativados: inativados } : {}),
        },
      });
    });
    revalidatePath(PATH);
  });
}
