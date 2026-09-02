"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirPapel,
  exigirSessao,
  paraDataLocal,
  registrarEvento,
  temPapel,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import {
  AvaliacaoSchema,
  CriarAcessoPortalSchema,
  LancarNotasSchema,
  RegistrarAulaSchema,
  TesteNivelSchema,
  type AvaliacaoInput,
  type CriarAcessoPortalInput,
  type LancarNotasInput,
  type RegistrarAulaInput,
  type TesteNivelInput,
} from "./schema";

// ACADÊMICO — Fase 3 (doc 03): diário de classe, avaliações/notas, teste de nível,
// PROGRESSÃO (o sistema calcula e sugere; um humano aprova — mesma filosofia híbrida do
// C4) e certificados. Toda mutação grava Evento (doc 13).

const PAPEIS_ACADEMICO: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR];
const PAPEIS_PROGRESSAO: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];
const PAPEIS_PORTAL: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];

function revalidar(turmaId?: string, alunoId?: string) {
  if (turmaId) revalidatePath(`/alunos/turma/${turmaId}`);
  if (alunoId) revalidatePath(`/alunos/${alunoId}`);
  revalidatePath("/portal");
}

/** Professor só opera as PRÓPRIAS turmas; secretaria/gerente pedagógico, todas (doc 07). */
async function exigirTurmaNoEscopo(turmaId: string, usuario: UsuarioSessao) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) throw new ErroRegra("Turma não encontrada.");
  const amplo = temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  if (!amplo && turma.professorId !== usuario.id) {
    throw new ErroPermissao("Esta turma não está no seu escopo.");
  }
  return turma;
}

/** Diário de classe: registra (ou re-registra) a aula do dia com a frequência da turma. */
export async function registrarAula(input: RegistrarAulaInput): Promise<Resultado<{ aulaId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ACADEMICO);
    const dados = RegistrarAulaSchema.parse(input);
    await exigirTurmaNoEscopo(dados.turmaId, autor);
    // Date-only vem de <input type="date"> ("YYYY-MM-DD"): parse LOCAL (meio-dia) pelo
    // helper compartilhado — `new Date("2026-08-20")` seria meia-noite UTC e a aula
    // apareceria no dia ANTERIOR em fusos negativos (review PR #60).
    const data = new Date(paraDataLocal(dados.dataISO) as string | Date);
    if (isNaN(data.getTime())) throw new ErroRegra("Data da aula inválida.");

    // Presenças só de alunos ATUALMENTE alocados na turma (alocação ativa).
    const alocados = new Set(
      (
        await prisma.alocacaoTurma.findMany({
          where: { turmaId: dados.turmaId, ativa: true },
          select: { alunoId: true },
        })
      ).map((a) => a.alunoId),
    );
    const fora = dados.presencas.filter((p) => !alocados.has(p.alunoId));
    if (fora.length > 0) throw new ErroRegra("Há presenças de alunos que não estão na turma.");

    const aulaId = await prisma.$transaction(async (tx) => {
      // Re-registrar a mesma data EDITA a aula (upsert por turma×data — @@unique).
      const aula = await tx.aula.upsert({
        where: { turmaId_data: { turmaId: dados.turmaId, data } },
        create: { turmaId: dados.turmaId, data, conteudo: dados.conteudo },
        update: { conteudo: dados.conteudo },
      });
      for (const p of dados.presencas) {
        await tx.presenca.upsert({
          where: { aulaId_alunoId: { aulaId: aula.id, alunoId: p.alunoId } },
          create: { aulaId: aula.id, alunoId: p.alunoId, presente: p.presente },
          update: { presente: p.presente },
        });
      }
      await registrarEvento(tx, {
        tipo: "AulaRegistrada",
        agregadoTipo: "Turma",
        agregadoId: dados.turmaId,
        autorId: autor.id,
        payload: {
          data: data.toISOString(),
          presentes: dados.presencas.filter((p) => p.presente).length,
          total: dados.presencas.length,
        },
      });
      return aula.id;
    });
    revalidar(dados.turmaId);
    return { aulaId };
  });
}

export async function salvarAvaliacao(input: AvaliacaoInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ACADEMICO);
    const dados = AvaliacaoSchema.parse(input);
    await exigirTurmaNoEscopo(dados.turmaId, autor);

    const id = await prisma.$transaction(async (tx) => {
      const avaliacao = await tx.avaliacao.upsert({
        where: { turmaId_nome: { turmaId: dados.turmaId, nome: dados.nome } },
        create: {
          turmaId: dados.turmaId,
          nome: dados.nome,
          peso: dados.peso,
          // Mesmo parse LOCAL de date-only da aula (review PR #60).
          data: dados.dataISO ? new Date(paraDataLocal(dados.dataISO) as string | Date) : null,
        },
        update: {
          peso: dados.peso,
          data: dados.dataISO ? new Date(paraDataLocal(dados.dataISO) as string | Date) : null,
        },
      });
      await registrarEvento(tx, {
        tipo: "AvaliacaoDefinida",
        agregadoTipo: "Turma",
        agregadoId: dados.turmaId,
        autorId: autor.id,
        payload: { nome: dados.nome, peso: dados.peso },
      });
      return avaliacao.id;
    });
    revalidar(dados.turmaId);
    return { id };
  });
}

export async function lancarNotas(input: LancarNotasInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ACADEMICO);
    const dados = LancarNotasSchema.parse(input);
    const avaliacao = await prisma.avaliacao.findUnique({ where: { id: dados.avaliacaoId } });
    if (!avaliacao) throw new ErroRegra("Avaliação não encontrada.");
    await exigirTurmaNoEscopo(avaliacao.turmaId, autor);

    await prisma.$transaction(async (tx) => {
      // Nota só de aluno ALOCADO na turma da avaliação (review PR #60): sem esta checagem,
      // um professor gravaria na avaliação da turma A nota de aluno da turma B,
      // contaminando boletim e progressão. Mesma regra do diário, na MESMA transação.
      const alocados = new Set(
        (
          await tx.alocacaoTurma.findMany({
            where: { turmaId: avaliacao.turmaId, ativa: true },
            select: { alunoId: true },
          })
        ).map((a) => a.alunoId),
      );
      const fora = dados.notas.filter((n) => !alocados.has(n.alunoId));
      if (fora.length > 0) throw new ErroRegra("Há notas de alunos que não estão na turma desta avaliação.");
      for (const n of dados.notas) {
        await tx.nota.upsert({
          where: { avaliacaoId_alunoId: { avaliacaoId: avaliacao.id, alunoId: n.alunoId } },
          create: { avaliacaoId: avaliacao.id, alunoId: n.alunoId, valor: n.valor },
          update: { valor: n.valor },
        });
      }
      await registrarEvento(tx, {
        tipo: "NotasLancadas",
        agregadoTipo: "Turma",
        agregadoId: avaliacao.turmaId,
        autorId: autor.id,
        payload: { avaliacao: avaliacao.nome, quantidade: dados.notas.length },
      });
    });
    revalidar(avaliacao.turmaId);
  });
}

/** Teste de nível: registro auditável no aluno (alimenta o nível inicial da matrícula). */
export async function registrarTesteNivel(input: TesteNivelInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ACADEMICO);
    const dados = TesteNivelSchema.parse(input);
    const nivel = await prisma.nivel.findUnique({ where: { id: dados.nivelId } });
    if (!nivel) throw new ErroRegra("Nível inexistente.");

    await prisma.$transaction(async (tx) => {
      await tx.testeNivel.create({
        data: {
          alunoId: dados.alunoId,
          nivelId: dados.nivelId,
          pontuacao: dados.pontuacao ?? null,
          observacao: dados.observacao,
        },
      });
      await registrarEvento(tx, {
        tipo: "TesteNivelRegistrado",
        agregadoTipo: "Aluno",
        agregadoId: dados.alunoId,
        autorId: autor.id,
        payload: { nivelId: dados.nivelId, nivel: nivel.codigo, pontuacao: dados.pontuacao ?? null },
      });
    });
    revalidar(undefined, dados.alunoId);
  });
}

/**
 * PROGRESSÃO (aprovação humana sobre o cálculo do sistema): marca o nível da turma como
 * CONCLUÍDO pelo aluno + emite o CERTIFICADO com código público de validação. A alocação
 * na próxima turma segue pelo fluxo existente de troca de turma (decisão humana).
 */
export async function aprovarNivelAluno(turmaId: string, alunoId: string): Promise<Resultado<{ codigoValidacao: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_PROGRESSAO);
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, include: { nivel: true } });
    if (!turma) throw new ErroRegra("Turma não encontrada.");
    const alocado = await prisma.alocacaoTurma.findFirst({ where: { turmaId, alunoId, ativa: true } });
    if (!alocado) throw new ErroRegra("O aluno não está (mais) nesta turma.");

    // Idempotência: um certificado por aluno×nível.
    const ja = await prisma.certificado.findFirst({ where: { alunoId, nivelId: turma.nivelId } });
    if (ja) throw new ErroRegra(`Este aluno já tem certificado do nível ${turma.nivel.codigo}.`);

    const codigoValidacao = randomBytes(6).toString("hex").toUpperCase();
    await prisma.$transaction(async (tx) => {
      await tx.certificado.create({
        data: { alunoId, nivelId: turma.nivelId, turmaId, codigoValidacao },
      });
      await registrarEvento(tx, {
        tipo: "NivelConcluido",
        agregadoTipo: "Aluno",
        agregadoId: alunoId,
        autorId: autor.id,
        payload: { nivelId: turma.nivelId, nivel: turma.nivel.codigo, turmaId, codigoValidacao },
      });
    });
    revalidar(turmaId, alunoId);
    return { codigoValidacao };
  });
}

/** Cria (uma vez) o acesso do PORTAL para um aluno: Usuario papel ALUNO vinculado 1:1. */
export async function criarAcessoPortal(input: CriarAcessoPortalInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_PORTAL);
    const dados = CriarAcessoPortalSchema.parse(input);

    const aluno = await prisma.aluno.findUnique({ where: { id: dados.alunoId } });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");
    if (aluno.usuarioId) throw new ErroRegra("Este aluno já tem acesso ao portal.");
    const emailEmUso = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (emailEmUso) throw new ErroRegra("Já existe um usuário com este e-mail.");

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" "),
          email: dados.email,
          senhaHash,
          papeis: [Papel.ALUNO], // SÓ o portal — nenhuma tela interna
        },
      });
      await tx.aluno.update({ where: { id: aluno.id }, data: { usuarioId: usuario.id } });
      await registrarEvento(tx, {
        tipo: "AcessoPortalCriado",
        agregadoTipo: "Aluno",
        agregadoId: aluno.id,
        autorId: autor.id,
        payload: { email: dados.email },
      });
    });
    revalidar(undefined, aluno.id);
  });
}
