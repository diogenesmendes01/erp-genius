"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { obterDriveOrganizacaoId, obterTokenDrive } from "./credenciais";
import { obterTokenPublicacaoDrive } from "./credenciais-publicacao";
import { consultarRevisaoDriveFixada, fixarRevisaoDriveOrganizacional } from "./drive-revisao";

const id = z.string().trim().regex(/^[A-Za-z0-9_-]{3,500}$/);
const texto = z.string().trim().min(5).max(4_000);
const Entrada = z.object({ alvo: z.enum(["PUBLICACAO_AULA", "MATERIAL_REPOSICAO"]), alvoId: z.string().min(1), arquivoOficialId: id, motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();
const Decisao = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict();

const alvoPublicacao = "PUBLICACAO_AULA" as const;
type Alvo = typeof alvoPublicacao | "MATERIAL_REPOSICAO";

async function exigirPreparadorFresco(tx: Prisma.TransactionClient, usuarioId: string, alvo: Alvo, alvoId: string) {
  // A correção da aula ordena calendário, encontro e usuário. A proposta de
  // fonte segue a mesma ordem quando um professor é o preparador.
  if (alvo === alvoPublicacao) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    await tx.$queryRaw`SELECT e.id FROM "PublicacaoGravacaoAula" p JOIN "EncontroAgenda" e ON e.id = p."encontroId" WHERE p.id = ${alvoId} FOR UPDATE OF e`;
  }
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  const gestao = !!usuario?.ativo && usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
  if (alvo === "MATERIAL_REPOSICAO") {
    if (!gestao || !await tx.materialReposicaoGravacao.findUnique({ where: { id: alvoId }, select: { id: true } })) throw new ErroPermissao();
    return;
  }
  // A gestão mantém o percurso legado: só confirma que a publicação existe.
  // As provas de aula corrigível pertencem exclusivamente ao preparo docente.
  if (gestao) {
    if (!await tx.publicacaoGravacaoAula.findUnique({ where: { id: alvoId }, select: { id: true } })) {
      throw new ErroRegra("Fonte de gravação não encontrada.");
    }
    return;
  }
  const publicacao = await tx.publicacaoGravacaoAula.findUnique({ where: { id: alvoId }, select: {
    id: true,
    encontro: { select: { professorId: true, turmaId: true, matriculaId: true, inicio: true,
      finalidade: true, status: true, fim: true, diario: { select: { professorId: true, turmaId: true, ocorridaEm: true } },
      turma: { select: { professorId: true, vinculosDocentes: { where: { professorId: usuarioId, fim: null }, select: { inicio: true } } } },
    } },
  } });
  if (!publicacao) throw new ErroRegra("Fonte de gravação não encontrada.");
  const encontro = publicacao.encontro;
  const agora = new Date();
  const professorVigente = !!usuario?.ativo && usuario.papeis.includes(Papel.PROFESSOR)
    && encontro.professorId === usuarioId && encontro.finalidade === "AULA" && encontro.status === "MINISTRADO"
    && encontro.fim <= agora && !!encontro.diario && encontro.diario.professorId === encontro.professorId
    && encontro.diario.turmaId === encontro.turmaId && encontro.diario.ocorridaEm.getTime() === encontro.inicio.getTime()
    && (encontro.turmaId
      ? encontro.turma?.professorId === usuarioId && encontro.turma.vinculosDocentes.some(v => v.inicio <= encontro.inicio && v.inicio <= agora)
      : !!encontro.matriculaId);
  if (!professorVigente) throw new ErroPermissao("Somente a gestão ou o professor ainda vinculado à aula pode propor a correção da gravação.");
}

async function exigirGestaoFresca(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}
function mesmaEntrada(proposta: { alvo: string; publicacaoAulaId: string | null; materialReposicaoId: string | null; arquivoOficialId: string; motivo: string }, dados: z.infer<typeof Entrada>) {
  return proposta.alvo === dados.alvo && (dados.alvo === "PUBLICACAO_AULA" ? proposta.publicacaoAulaId === dados.alvoId : proposta.materialReposicaoId === dados.alvoId) && proposta.arquivoOficialId === dados.arquivoOficialId && proposta.motivo === dados.motivo;
}

/** Prepara uma fonte fixa; a decisão independente é quem a torna reproduzível. */
export async function proporRegularizacaoFonteGravacao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = Entrada.parse(input);
    const anterior = await prisma.$transaction(async (tx) => {
      await exigirPreparadorFresco(tx, autor.id, dados.alvo, dados.alvoId);
      return tx.propostaRegularizacaoFonteGravacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: dados.chaveIdempotencia } } });
    });
    if (anterior) {
      if (!mesmaEntrada(anterior, dados)) throw new ErroRegra("A chave já identifica outra regularização de gravação.");
      return { id: anterior.id };
    }
    const fixa = await fixarRevisaoDriveOrganizacional({ fileId: dados.arquivoOficialId, driveIdOrganizacao: obterDriveOrganizacaoId(), token: obterTokenPublicacaoDrive });
    return prisma.$transaction(async (tx) => {
      await exigirPreparadorFresco(tx, autor.id, dados.alvo, dados.alvoId);
      const anterior = await tx.propostaRegularizacaoFonteGravacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (anterior) {
        if (!mesmaEntrada(anterior, dados)) throw new ErroRegra("A chave já identifica outra regularização de gravação.");
        return { id: anterior.id };
      }
      const versaoEsperada = await tx.fonteRevisaoGravacao.count({ where: dados.alvo === "PUBLICACAO_AULA" ? { publicacaoAulaId: dados.alvoId } : { materialReposicaoId: dados.alvoId } });
      const proposta = await tx.propostaRegularizacaoFonteGravacao.create({ data: {
        alvo: dados.alvo, ...(dados.alvo === "PUBLICACAO_AULA" ? { publicacaoAulaId: dados.alvoId } : { materialReposicaoId: dados.alvoId }),
        versaoEsperada, arquivoOficialId: fixa.fileId, driveOrganizacaoId: fixa.driveId, driveRevisionId: fixa.revisionId,
        driveRevisionMd5: fixa.md5Checksum, driveRevisionSize: BigInt(fixa.size), mimeType: fixa.mimeType,
        motivo: dados.motivo, preparadorId: autor.id, chaveIdempotencia: dados.chaveIdempotencia,
      } });
      return { id: proposta.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

/** A aprovação cria uma nova versão append-only; rejeição preserva a fonte vigente. */
export async function decidirRegularizacaoFonteGravacao(input: unknown) {
  return executarAcao(async () => {
    const decisor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = Decisao.parse(input);
    const preflight = await prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, decisor.id);
      const proposta = await tx.propostaRegularizacaoFonteGravacao.findUnique({ where: { id: dados.propostaId }, include: { decisao: true } });
      if (!proposta || proposta.decisao) throw new ErroRegra("A proposta de regularização não está disponível.");
      if (proposta.preparadorId === decisor.id) throw new ErroPermissao("Outra pessoa autorizada deve decidir a regularização.");
      return proposta;
    });
    if (dados.aprovar) await consultarRevisaoDriveFixada({ fonte: { fileId: preflight.arquivoOficialId, driveId: preflight.driveOrganizacaoId, revisionId: preflight.driveRevisionId, md5Checksum: preflight.driveRevisionMd5, size: preflight.driveRevisionSize.toString(), mimeType: preflight.mimeType }, token: obterTokenDrive });
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, decisor.id);
      const proposta = await tx.propostaRegularizacaoFonteGravacao.findUnique({ where: { id: dados.propostaId }, include: { decisao: true } });
      if (!proposta || proposta.decisao) throw new ErroRegra("A proposta de regularização não está disponível.");
      if (proposta.driveRevisionId !== preflight.driveRevisionId || proposta.driveRevisionMd5 !== preflight.driveRevisionMd5 || proposta.driveRevisionSize !== preflight.driveRevisionSize || proposta.mimeType !== preflight.mimeType) throw new ErroRegra("A proposta mudou durante a conferência.");
      if (proposta.preparadorId === decisor.id) throw new ErroPermissao("Outra pessoa autorizada deve decidir a regularização.");
      const onde = proposta.alvo === "PUBLICACAO_AULA" ? { publicacaoAulaId: proposta.publicacaoAulaId! } : { materialReposicaoId: proposta.materialReposicaoId! };
      const atual = await tx.fonteRevisaoGravacao.count({ where: onde });
      if (dados.aprovar && atual !== proposta.versaoEsperada) throw new ErroRegra("A fonte mudou desde a proposta; prepare uma nova regularização.");
      const decisao = await tx.decisaoRegularizacaoFonteGravacao.create({ data: { propostaId: proposta.id, decisorId: decisor.id, aprovada: dados.aprovar, motivo: dados.motivo } });
      if (!dados.aprovar) return { id: decisao.id, aprovada: false as const };
      const fonte = await tx.fonteRevisaoGravacao.create({ data: { alvo: proposta.alvo, ...onde, versao: atual + 1, propostaId: proposta.id,
        arquivoOficialId: proposta.arquivoOficialId, driveOrganizacaoId: proposta.driveOrganizacaoId, driveRevisionId: proposta.driveRevisionId,
        driveRevisionMd5: proposta.driveRevisionMd5, driveRevisionSize: proposta.driveRevisionSize, mimeType: proposta.mimeType } });
      const agregado = proposta.alvo === "PUBLICACAO_AULA"
        ? { tipo: "EncontroAgenda" as const, id: (await tx.publicacaoGravacaoAula.findUniqueOrThrow({ where: { id: proposta.publicacaoAulaId! }, select: { encontroId: true } })).encontroId }
        : { tipo: "Matricula" as const, id: (await tx.materialReposicaoGravacao.findUniqueOrThrow({ where: { id: proposta.materialReposicaoId! }, select: { reposicao: { select: { matriculaId: true } } } })).reposicao.matriculaId };
      await registrarEvento(tx, { tipo: "FonteGravacaoRegularizada", agregadoTipo: agregado.tipo, agregadoId: agregado.id, autorId: decisor.id,
        payload: { propostaId: proposta.id, decisaoId: decisao.id, fonteId: fonte.id, versao: fonte.versao } });
      return { id: decisao.id, aprovada: true as const, fonteId: fonte.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

/** Dados operacionais mínimos para a tela de regularização; não incluem URL ou token do Drive. */
const Consulta = z.object({ cursor: z.string().optional(), busca: z.string().trim().max(120).optional() }).strict();
export async function consultarRegularizacoesFonteGravacao(entrada: unknown = {}) {
  const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const dados = Consulta.parse(entrada);
  let cursor: { p?: string | null; m?: string | null; q?: string | null } = {};
  if (dados.cursor) try { cursor = JSON.parse(Buffer.from(dados.cursor, "base64url").toString("utf8")); } catch { throw new ErroRegra("Cursor de regularização inválido."); }
  const busca = dados.busca || undefined;
  return prisma.$transaction(async (tx) => {
    await exigirGestaoFresca(tx, autor.id);
    const [publicacoes, materiais, propostas] = await Promise.all([
      cursor.p === null ? Promise.resolve([]) : tx.publicacaoGravacaoAula.findMany({ where: busca ? { OR: [{ id: { contains: busca } }, { arquivoOficialId: { contains: busca } }] } : undefined, orderBy: { id: "asc" }, ...(cursor.p ? { cursor: { id: cursor.p }, skip: 1 } : {}), take: 11, select: { id: true, encontroId: true, arquivoOficialId: true, criadaEm: true, encontro: { select: { inicio: true, fusoOrigem: true, turma: { select: { codigo: true, nome: true } } } }, fontesRevisao: { orderBy: { versao: "desc" }, take: 1, select: { versao: true } } } }),
      cursor.m === null ? Promise.resolve([]) : tx.materialReposicaoGravacao.findMany({ where: busca ? { OR: [{ id: { contains: busca } }, { arquivoOficialId: { contains: busca } }, { reposicao: { matricula: { codigo: { contains: busca } } } }] } : undefined, orderBy: { id: "asc" }, ...(cursor.m ? { cursor: { id: cursor.m }, skip: 1 } : {}), take: 11, select: { id: true, reposicaoId: true, arquivoOficialId: true, publicadoEm: true, reposicao: { select: { matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } } } }, fontesRevisao: { orderBy: { versao: "desc" }, take: 1, select: { versao: true } } } }),
      cursor.q === null ? Promise.resolve([]) : tx.propostaRegularizacaoFonteGravacao.findMany({ orderBy: { id: "asc" }, ...(cursor.q ? { cursor: { id: cursor.q }, skip: 1 } : {}), take: 21, select: { id: true, preparadorId: true, alvo: true, publicacaoAulaId: true, materialReposicaoId: true, arquivoOficialId: true, driveRevisionId: true, motivo: true, versaoEsperada: true, criadaEm: true, publicacaoAula: { select: { encontro: { select: { inicio: true, fusoOrigem: true, turma: { select: { codigo: true, nome: true } } } } } }, materialReposicao: { select: { reposicao: { select: { matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } } } } } }, preparador: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } }),
    ]);
    const maisP = publicacoes.length > 10, maisM = materiais.length > 10, maisQ = propostas.length > 20;
    return { publicacoes: publicacoes.slice(0, 10), materiais: materiais.slice(0, 10), propostas: propostas.slice(0, 20).map((p) => ({ ...p, podeDecidir: !p.decisao && p.preparadorId !== autor.id })), proximoCursor: maisP || maisM || maisQ ? Buffer.from(JSON.stringify({ p: maisP ? publicacoes[9]?.id : null, m: maisM ? materiais[9]?.id : null, q: maisQ ? propostas[19]?.id : null })).toString("base64url") : null };
  });
}
