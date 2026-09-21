"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const Entrada = z.object({ cursor: z.string().min(1).max(100).optional() }).strict();
const textoDaFotografia = (dados: unknown, caminho: string[]) => {
  const valor = caminho.reduce<unknown>((atual, chave) => atual && typeof atual === "object" ? (atual as Record<string, unknown>)[chave] : null, dados);
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  return typeof valor === "number" && Number.isFinite(valor) ? String(valor) : null;
};
export type ItemLotePreparacaoMigracao = { id: string; origem: string; chaveLote: string; estado: "PREPARADO" | "COM_PENDENCIAS"; criadoEm: Date; preparadoPorNome: string; linhas: number; pendencias: number; colisoes: number; conflitosEntrada: number };
export type ConsultaLotesPreparacaoMigracao = { itens: ItemLotePreparacaoMigracao[]; proximoCursor: string | null };

async function adminFrescoTx(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Sua permissão mudou; inicie a consulta novamente.");
}
/** Consulta administrativa sem aplicar nem supor dados a partir da preparação. */
export async function consultarLotesPreparacaoMigracao(input: { cursor?: string } = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      await adminFrescoTx(tx, sessao.id);
      const lotes = await tx.lotePreparacaoMigracao.findMany({
        ...(dados.cursor ? { where: { id: { gt: dados.cursor } } } : {}), orderBy: { id: "asc" }, take: 21,
        select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, preparadoPor: { select: { nome: true } }, _count: { select: { linhas: true, conflitosEntrada: true } }, linhas: { select: { _count: { select: { pendencias: true } }, colisoesComoConflitante: { select: { id: true } }, colisoesComoExistente: { select: { id: true } } } } },
      });
      const pagina = lotes.slice(0, 20).map((lote) => ({ id: lote.id, origem: lote.origem, chaveLote: lote.chaveLote, estado: lote.estado, criadoEm: lote.criadoEm, preparadoPorNome: lote.preparadoPor.nome, linhas: lote._count.linhas, pendencias: lote.linhas.reduce((total, linha) => total + linha._count.pendencias, 0), colisoes: new Set(lote.linhas.flatMap((linha) => [...linha.colisoesComoConflitante, ...linha.colisoesComoExistente].map((colisao) => colisao.id))).size, conflitosEntrada: lote._count.conflitosEntrada }));
      return { itens: pagina, proximoCursor: lotes.length > 20 ? pagina.at(-1)!.id : null } satisfies ConsultaLotesPreparacaoMigracao;
    });
  });
}

export async function consultarLotePreparacaoMigracao(loteId: string) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(async (tx) => {
      await adminFrescoTx(tx, sessao.id);
      const id = z.string().min(1).max(100).parse(loteId);
      const lote = await tx.lotePreparacaoMigracao.findUnique({ where: { id }, select: { id: true, origem: true, chaveLote: true, estado: true, criadoEm: true, preparadoPor: { select: { nome: true } }, conflitosEntrada: { orderBy: { criadoEm: "asc" }, select: { linhaOrigem: true, codigo: true, entradaHash: true, dadosConflitantes: true, criadoEm: true } }, linhas: { orderBy: { linhaOrigem: "asc" }, select: { id: true, linhaOrigem: true, tipoEntrada: true, alunoOrigemId: true, turmaOrigemId: true, matriculaOrigemId: true, financeiroOrigemId: true, dadosOrigem: true, entradaHash: true, estado: true, aplicacoesCadastro: { orderBy: { criadoEm: "asc" }, select: { situacao: true, alunoId: true, detalhe: true, criadoEm: true, executadoPor: { select: { nome: true } } } }, ensaiosVinculo: { orderBy: { criadoEm: "desc" }, select: { id: true, entradaHash: true, contextoHash: true, correspondenciaProdutoId: true, correspondenciaTurmaId: true, correspondenciaStatusId: true, resultado: true, requisitos: true, criadoEm: true, ensaiadoPor: { select: { nome: true } }, aplicacoes: { orderBy: { aplicadoEm: "desc" }, select: { id: true, matriculaId: true, alocacaoId: true, aplicadoEm: true, aplicadoPor: { select: { nome: true } } } } } }, pendencias: { orderBy: [{ campo: "asc" }, { codigo: "asc" }], select: { campo: true, codigo: true, detalhe: true } }, colisoesComoConflitante: { select: { id: true, tipo: true, identificadorOrigem: true, linhaExistente: { select: { linhaOrigem: true } } } }, colisoesComoExistente: { select: { id: true, tipo: true, identificadorOrigem: true, linhaConflitante: { select: { linhaOrigem: true } } } } } } } });
      if (!lote) return null;
      const eventos = await tx.evento.findMany({ where: { agregadoTipo: "LotePreparacaoMigracao", agregadoId: id, tipo: "ConflitoPreparacaoMigracaoRegistrado" }, select: { criadoEm: true, autor: { select: { nome: true } }, payload: true } });
      const autorPorHash = new Map<string, { nome: string | null; criadoEm: Date }>();
      for (const evento of eventos) {
        const conflitos = (evento.payload as { conflitos?: unknown } | null)?.conflitos;
        if (!Array.isArray(conflitos)) continue;
        for (const conflito of conflitos) if (conflito && typeof conflito === "object" && typeof (conflito as { entradaHash?: unknown }).entradaHash === "string") autorPorHash.set((conflito as { entradaHash: string }).entradaHash, { nome: evento.autor?.nome ?? null, criadoEm: evento.criadoEm });
      }
      const [ofertasProduto, turmas] = await Promise.all([
        tx.produtoPais.findMany({ where: { oferecido: true }, orderBy: { pais: { nome: "asc" } }, select: { produtoId: true, paisId: true, moeda: true, pais: { select: { nome: true, codigoISO: true } }, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } } }),
        tx.turma.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } } }),
      ]);
      const linhasVinculo = lote.linhas.filter((linha) => linha.tipoEntrada === "VINCULO_MATRICULA");
      const produtosOrigem = linhasVinculo.map((linha) => textoDaFotografia(linha.dadosOrigem, ["matricula", "produtoOrigem"])).filter((id): id is string => !!id);
      const turmasOrigem = linhasVinculo.map((linha) => linha.turmaOrigemId).filter((id): id is string => !!id);
      const statusOrigem = linhasVinculo.map((linha) => textoDaFotografia(linha.dadosOrigem, ["matricula", "situacao"])).filter((id): id is string => !!id);
      const [revisoesProduto, revisoesTurma, revisoesStatus] = await Promise.all([
        tx.correspondenciaProdutoMigracao.findMany({ where: { origem: lote.origem, produtoOrigemId: { in: produtosOrigem } }, orderBy: { versao: "desc" }, select: { id: true, produtoOrigemId: true, produtoId: true, paisId: true, versao: true, ativa: true, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } }, pais: { select: { nome: true, codigoISO: true } }, moeda: true } }),
        tx.correspondenciaTurmaMigracao.findMany({ where: { origem: lote.origem, turmaOrigemId: { in: turmasOrigem } }, orderBy: { versao: "desc" }, select: { id: true, turmaOrigemId: true, turmaId: true, versao: true, ativa: true, turma: { select: { codigo: true, nome: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } } } } }),
        tx.correspondenciaStatusMatriculaMigracao.findMany({ where: { origem: lote.origem, statusOrigem: { in: statusOrigem } }, orderBy: { versao: "desc" }, select: { id: true, statusOrigem: true, versao: true, ativa: true, statusDestino: true } }),
      ]);
      const atual = <T extends { versao: number } & Record<string, unknown>>(itens: T[], chave: (item: T) => string) => new Map<string, T>(itens.reduce((mapa, item) => mapa.has(chave(item)) ? mapa : mapa.set(chave(item), item), new Map<string, T>()));
      const produtoAtual = atual(revisoesProduto, (item) => item.produtoOrigemId);
      const turmaAtual = atual(revisoesTurma, (item) => item.turmaOrigemId);
      const statusAtual = atual(revisoesStatus, (item) => item.statusOrigem);
      return { ...lote, destinosVinculo: { produtos: ofertasProduto.map((oferta) => ({ produtoId: oferta.produtoId, paisId: oferta.paisId, moeda: oferta.moeda, rotulo: `${oferta.produto.idioma.nome} · ${oferta.produto.modalidade.nome} · ${oferta.pais.nome} (${oferta.pais.codigoISO}, ${oferta.moeda})` })), turmas: turmas.map((turma) => ({ id: turma.id, rotulo: [turma.codigo, turma.nome, `${turma.nivel.idioma.nome} ${turma.nivel.codigo}`].filter(Boolean).join(" · ") })) }, conflitosEntrada: lote.conflitosEntrada.map((conflito) => ({ ...conflito, registradoPorNome: autorPorHash.get(conflito.entradaHash)?.nome ?? null, registradoEm: autorPorHash.get(conflito.entradaHash)?.criadoEm ?? conflito.criadoEm })), linhas: lote.linhas.map((linha) => {
        const colisoes = new Map<string, { tipo: string; identificadorOrigem: string; outraLinhaOrigem: string }>();
        for (const colisao of linha.colisoesComoConflitante) colisoes.set(colisao.id, { tipo: colisao.tipo, identificadorOrigem: colisao.identificadorOrigem, outraLinhaOrigem: colisao.linhaExistente.linhaOrigem });
        for (const colisao of linha.colisoesComoExistente) colisoes.set(colisao.id, { tipo: colisao.tipo, identificadorOrigem: colisao.identificadorOrigem, outraLinhaOrigem: colisao.linhaConflitante.linhaOrigem });
        const produtoId = textoDaFotografia(linha.dadosOrigem, ["matricula", "produtoOrigem"]); const statusId = textoDaFotografia(linha.dadosOrigem, ["matricula", "situacao"]);
        const produto = produtoId ? produtoAtual.get(produtoId) : undefined; const turma = linha.turmaOrigemId ? turmaAtual.get(linha.turmaOrigemId) : undefined; const situacao = statusId ? statusAtual.get(statusId) : undefined;
        return { ...linha, origemVinculo: linha.tipoEntrada === "VINCULO_MATRICULA" ? { produtoOrigemId: produtoId, statusOrigem: statusId, produtoAtual: produto ? { id: produto.id, produtoId: produto.produtoId, paisId: produto.paisId, moeda: produto.moeda, versao: produto.versao, ativa: produto.ativa, rotulo: `${produto.produto.idioma.nome} · ${produto.produto.modalidade.nome} · ${produto.pais.nome} (${produto.pais.codigoISO}, ${produto.moeda})` } : null, turmaAtual: turma ? { id: turma.id, turmaId: turma.turmaId, versao: turma.versao, ativa: turma.ativa, rotulo: [turma.turma.codigo, turma.turma.nome, `${turma.turma.nivel.idioma.nome} ${turma.turma.nivel.codigo}`].filter(Boolean).join(" · ") } : null, statusAtual: situacao ? { id: situacao.id, versao: situacao.versao, ativa: situacao.ativa, destino: situacao.statusDestino } : null } : null, ensaiosVinculo: linha.ensaiosVinculo.map((ensaio) => ({ ...ensaio, vigente: ensaio.correspondenciaProdutoId === produto?.id && ensaio.correspondenciaTurmaId === turma?.id && ensaio.correspondenciaStatusId === situacao?.id && !!produto?.ativa && !!turma?.ativa && !!situacao?.ativa, requisitos: Array.isArray(ensaio.requisitos) ? ensaio.requisitos.flatMap((item) => item && typeof item === "object" && typeof (item as { codigo?: unknown }).codigo === "string" ? [(item as { codigo: string }).codigo] : []) : [] })), colisoes: [...colisoes.values()] };
      }) };
    });
  });
}
