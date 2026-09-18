"use server";

import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { obterTokenDrive } from "./credenciais";
import { consultarRevisaoDriveFixada } from "./drive-revisao";

const id = z.string().trim().min(1).max(200);
const texto = z.string().trim().min(5).max(4_000);
const EntradaProposta = z.object({ reposicaoId: id, motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();
const EntradaDecisao = z.object({ propostaId: id, aprovar: z.boolean(), motivo: texto }).strict();

type Fonte = {
  id: string;
  versao: number;
  arquivoOficialId: string;
  driveOrganizacaoId: string;
  driveRevisionId: string;
  driveRevisionMd5: string;
  driveRevisionSize: bigint;
  mimeType: string;
  origemPublicacaoId: string | null;
};

type Contexto = {
  materialId: string;
  reposicaoId: string;
  matriculaId: string;
  aulaOriginalId: string;
  publicacaoAulaId: string;
  materialDisponivel: boolean;
  disponibilizacaoId: string | null;
  fonteMaterialAnterior: Fonte;
  fontePublicacao: Fonte;
};

function canonizar(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonizar).join(",")}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((chave) => `${JSON.stringify(chave)}:${canonizar(objeto[chave])}`).join(",")}}`;
}

function fotografia(contexto: Contexto) {
  return {
    materialId: contexto.materialId,
    reposicaoId: contexto.reposicaoId,
    matriculaId: contexto.matriculaId,
    aulaOriginalId: contexto.aulaOriginalId,
    publicacaoAulaId: contexto.publicacaoAulaId,
    materialDisponivel: contexto.materialDisponivel,
    disponibilizacaoId: contexto.disponibilizacaoId,
    fonteMaterialAnterior: { id: contexto.fonteMaterialAnterior.id, versao: contexto.fonteMaterialAnterior.versao },
    fontePublicacao: {
      id: contexto.fontePublicacao.id,
      versao: contexto.fontePublicacao.versao,
      arquivoOficialId: contexto.fontePublicacao.arquivoOficialId,
      driveOrganizacaoId: contexto.fontePublicacao.driveOrganizacaoId,
      driveRevisionId: contexto.fontePublicacao.driveRevisionId,
      driveRevisionMd5: contexto.fontePublicacao.driveRevisionMd5,
      driveRevisionSize: contexto.fontePublicacao.driveRevisionSize.toString(),
      mimeType: contexto.fontePublicacao.mimeType,
    },
  };
}

function hashFotografia(foto: ReturnType<typeof fotografia>) {
  return createHash("sha256").update(canonizar(foto)).digest("hex");
}

async function exigirGestaoFresca(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

async function carregarContextoTx(tx: Prisma.TransactionClient, reposicaoId: string): Promise<Contexto> {
  const material = await tx.materialReposicaoGravacao.findUnique({ where: { reposicaoId }, select: {
    id: true, reposicaoId: true, publicacaoAulaId: true, disponivel: true,
    reposicao: { select: { matriculaId: true, aulaOriginalId: true, modalidade: true, decisao: { select: { aprovada: true } } } },
    disponibilizacao: { select: { id: true } },
  } });
  if (!material || material.reposicao.modalidade !== "GRAVACAO" || !material.reposicao.decisao?.aprovada || !material.publicacaoAulaId) {
    throw new ErroRegra("A reposição gravada aprovada com material derivado da aula original é obrigatória.");
  }
  const publicacao = await tx.publicacaoGravacaoAula.findUnique({ where: { id: material.publicacaoAulaId }, select: { encontroId: true } });
  if (!publicacao || publicacao.encontroId !== material.reposicao.aulaOriginalId) throw new ErroRegra("O material não corresponde à aula original da reposição.");
  const [fonteMaterialAnterior, fontePublicacao] = await Promise.all([
    tx.fonteRevisaoGravacao.findFirst({ where: { materialReposicaoId: material.id }, orderBy: { versao: "desc" }, select: { id: true, versao: true, arquivoOficialId: true, driveOrganizacaoId: true, driveRevisionId: true, driveRevisionMd5: true, driveRevisionSize: true, mimeType: true, origemPublicacaoId: true } }),
    tx.fonteRevisaoGravacao.findFirst({ where: { publicacaoAulaId: material.publicacaoAulaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true, arquivoOficialId: true, driveOrganizacaoId: true, driveRevisionId: true, driveRevisionMd5: true, driveRevisionSize: true, mimeType: true, origemPublicacaoId: true } }),
  ]);
  if (!fonteMaterialAnterior || !fontePublicacao) throw new ErroRegra("A troca exige revisões fixas tanto do material quanto da publicação.");
  if (fonteMaterialAnterior.origemPublicacaoId === fontePublicacao.id) throw new ErroRegra("O material já adota a revisão publicada atual; uma nova fonte exige outra publicação corrigida.");
  return {
    materialId: material.id, reposicaoId: material.reposicaoId, matriculaId: material.reposicao.matriculaId,
    aulaOriginalId: material.reposicao.aulaOriginalId, publicacaoAulaId: material.publicacaoAulaId,
    materialDisponivel: material.disponivel, disponibilizacaoId: material.disponibilizacao?.id ?? null,
    fonteMaterialAnterior, fontePublicacao,
  };
}

/** Prepara a adoção da revisão vigente da publicação, sem receber arquivo ou ID de fonte do navegador. */
export async function proporTrocaFonteReposicaoGravacao(input: unknown) {
  return executarAcao(async () => {
    const preparador = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = EntradaProposta.parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, preparador.id);
      const existente = await tx.propostaTrocaFonteReposicaoGravacao.findUnique({
        where: { preparadorId_chaveIdempotencia: { preparadorId: preparador.id, chaveIdempotencia: dados.chaveIdempotencia } },
      });
      if (existente) {
        const material = await tx.materialReposicaoGravacao.findUnique({ where: { reposicaoId: dados.reposicaoId }, select: { id: true } });
        if (!material || existente.materialReposicaoId !== material.id || existente.motivo !== dados.motivo) throw new ErroRegra("A chave já identifica outra troca de fonte.");
        return { id: existente.id };
      }
      const contexto = await carregarContextoTx(tx, dados.reposicaoId);
      const foto = fotografia(contexto);
      const proposta = await tx.propostaTrocaFonteReposicaoGravacao.create({ data: {
        materialReposicaoId: contexto.materialId, fontePublicacaoId: contexto.fontePublicacao.id,
        fonteMaterialAnteriorId: contexto.fonteMaterialAnterior.id, versaoMaterialEsperada: contexto.fonteMaterialAnterior.versao,
        fotografia: foto as Prisma.InputJsonValue, fotografiaHash: hashFotografia(foto), motivo: dados.motivo,
        preparadorId: preparador.id, chaveIdempotencia: dados.chaveIdempotencia,
      } });
      return { id: proposta.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

/** Decide de forma independente; aprovação relê a revisão fixa no Drive sem baixar ou enviar conteúdo. */
export async function decidirTrocaFonteReposicaoGravacao(input: unknown) {
  return executarAcao(async () => {
    const decisor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = EntradaDecisao.parse(input);
    const preflight = await prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, decisor.id);
      const proposta = await tx.propostaTrocaFonteReposicaoGravacao.findUnique({ where: { id: dados.propostaId }, include: { decisao: true, fontePublicacao: true, materialReposicao: { select: { reposicaoId: true } } } });
      if (!proposta || proposta.decisao) throw new ErroRegra("A proposta de troca não está disponível.");
      if (proposta.preparadorId === decisor.id) throw new ErroPermissao("Outra pessoa autorizada deve decidir a troca de fonte.");
      return proposta;
    });
    if (dados.aprovar) await consultarRevisaoDriveFixada({
      fonte: { fileId: preflight.fontePublicacao.arquivoOficialId, driveId: preflight.fontePublicacao.driveOrganizacaoId,
        revisionId: preflight.fontePublicacao.driveRevisionId, md5Checksum: preflight.fontePublicacao.driveRevisionMd5,
        size: preflight.fontePublicacao.driveRevisionSize.toString(), mimeType: preflight.fontePublicacao.mimeType }, token: obterTokenDrive,
    });
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, decisor.id);
      const proposta = await tx.propostaTrocaFonteReposicaoGravacao.findUnique({ where: { id: dados.propostaId }, include: { decisao: true, fontePublicacao: true, materialReposicao: { select: { reposicaoId: true } } } });
      if (!proposta || proposta.decisao) throw new ErroRegra("A proposta de troca não está disponível.");
      if (proposta.preparadorId === decisor.id) throw new ErroPermissao("Outra pessoa autorizada deve decidir a troca de fonte.");
      if (proposta.fontePublicacaoId !== preflight.fontePublicacaoId
        || proposta.fotografiaHash !== preflight.fotografiaHash
        || proposta.fontePublicacao.driveRevisionId !== preflight.fontePublicacao.driveRevisionId
        || proposta.fontePublicacao.driveRevisionMd5 !== preflight.fontePublicacao.driveRevisionMd5
        || proposta.fontePublicacao.driveRevisionSize !== preflight.fontePublicacao.driveRevisionSize
        || proposta.fontePublicacao.mimeType !== preflight.fontePublicacao.mimeType) throw new ErroRegra("A proposta mudou durante a conferência.");
      const contexto = await carregarContextoTx(tx, proposta.materialReposicao.reposicaoId);
      const fotoAtual = fotografia(contexto);
      if (contexto.fontePublicacao.id !== proposta.fontePublicacaoId
        || contexto.fonteMaterialAnterior.id !== proposta.fonteMaterialAnteriorId
        || contexto.fonteMaterialAnterior.versao !== proposta.versaoMaterialEsperada
        || hashFotografia(fotoAtual) !== proposta.fotografiaHash) throw new ErroRegra("As fontes ou o material mudaram desde a proposta; prepare uma nova troca.");
      const decisao = await tx.decisaoTrocaFonteReposicaoGravacao.create({ data: {
        propostaId: proposta.id, decisorId: decisor.id, aprovada: dados.aprovar, motivo: dados.motivo,
      } });
      if (!dados.aprovar) return { id: decisao.id, aprovada: false as const };
      const fonte = await tx.fonteRevisaoGravacao.create({ data: {
        alvo: "MATERIAL_REPOSICAO", materialReposicaoId: contexto.materialId, versao: contexto.fonteMaterialAnterior.versao + 1,
        propostaTrocaReposicaoId: proposta.id, origemPublicacaoId: contexto.fontePublicacao.id,
        arquivoOficialId: contexto.fontePublicacao.arquivoOficialId, driveOrganizacaoId: contexto.fontePublicacao.driveOrganizacaoId,
        driveRevisionId: contexto.fontePublicacao.driveRevisionId, driveRevisionMd5: contexto.fontePublicacao.driveRevisionMd5,
        driveRevisionSize: contexto.fontePublicacao.driveRevisionSize, mimeType: contexto.fontePublicacao.mimeType,
      } });
      await registrarEvento(tx, { tipo: "FonteReposicaoAdotada", agregadoTipo: "Matricula", agregadoId: contexto.matriculaId, autorId: decisor.id,
        payload: { propostaId: proposta.id, decisaoId: decisao.id, materialId: contexto.materialId, fonteAnteriorId: contexto.fonteMaterialAnterior.id, fontePublicacaoId: contexto.fontePublicacao.id, fonteMaterialId: fonte.id, versao: fonte.versao } });
      return { id: decisao.id, aprovada: true as const, fonteId: fonte.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

/** Consulta contextual para a gestão: o navegador só recebe o estado da reposição já escolhida. */
export async function consultarTrocaFonteReposicaoGravacao(input: unknown) {
  const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const dados = z.object({ reposicaoId: id }).strict().parse(input);
  return prisma.$transaction(async (tx) => {
    await exigirGestaoFresca(tx, autor.id);
    const contexto = await carregarContextoTx(tx, dados.reposicaoId);
    const propostas = await tx.propostaTrocaFonteReposicaoGravacao.findMany({ where: { materialReposicaoId: contexto.materialId }, orderBy: { criadaEm: "desc" }, select: {
      id: true, motivo: true, criadaEm: true, versaoMaterialEsperada: true, fotografiaHash: true,
      fonteMaterialAnterior: { select: { id: true, versao: true, driveRevisionId: true } },
      fontePublicacao: { select: { id: true, versao: true, driveRevisionId: true } },
      preparadorId: true, preparador: { select: { nome: true } },
      decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } },
      fonteMaterial: { select: { id: true, versao: true, driveRevisionId: true, origemPublicacaoId: true } },
    } });
    return {
      contexto: {
        reposicaoId: contexto.reposicaoId, materialId: contexto.materialId, matriculaId: contexto.matriculaId,
        fonteMaterialAtual: { id: contexto.fonteMaterialAnterior.id, versao: contexto.fonteMaterialAnterior.versao, revisao: contexto.fonteMaterialAnterior.driveRevisionId },
        fontePublicacaoAtual: { id: contexto.fontePublicacao.id, versao: contexto.fontePublicacao.versao, revisao: contexto.fontePublicacao.driveRevisionId },
        materialDisponivel: contexto.materialDisponivel, disponibilizacaoId: contexto.disponibilizacaoId,
      },
      propostas: propostas.map((proposta) => ({ ...proposta, podeDecidir: !proposta.decisao && proposta.preparadorId !== autor.id })),
    };
  });
}
