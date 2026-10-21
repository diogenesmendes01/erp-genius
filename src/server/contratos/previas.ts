"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { carregarBasePrevia, hashPrevia } from "./previa-estado";
const Consulta = z.object({ matriculaId: z.string().min(1), modeloId: z.string().min(1) }).strict();
const Gerar = Consulta.extend({ revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), aplicacaoConferida: z.literal(true), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function consultarPreenchimentoContratual(input: z.input<typeof Consulta>) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA); const d = Consulta.parse(input);
    return prisma.$transaction((tx) => carregarBasePrevia(tx, d.matriculaId, d.modeloId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

export async function registrarPreviaContratual(input: z.input<typeof Gerar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Gerar.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`previa-autor:${autor.id}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [d.matriculaId]); await conferirAutor(tx, autor.id);
      const anterior = await tx.previaDocumentoContratual.findUnique({ where: { autorId_chaveIdempotencia: { autorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave já usada em outra prévia.");
        return { id: anterior.id };
      }
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { alunoId: true } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR SHARE`;
      const atual = await carregarBasePrevia(tx, d.matriculaId, d.modeloId);
      if (atual.revisaoHash !== d.revisaoHash) throw new ErroRegra("Os dados mudaram. Confira novamente o preenchimento.");
      const previa = await tx.previaDocumentoContratual.create({ data: { matriculaId: d.matriculaId, modeloId: d.modeloId, condicoesId: atual.condicoesId,
        autorId: autor.id, snapshot: atual.snapshot, conteudoHash: atual.revisaoHash, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: "PreviaContratualRegistrada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { previaId: previa.id, modeloId: d.modeloId, condicoesId: atual.condicoesId, conteudoHash: atual.revisaoHash, aplicacaoConferida: true } });
      return { id: previa.id };
    });
  });
}

export async function consultarPreviaContratual(id: string) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const p = await prisma.previaDocumentoContratual.findUnique({ where: { id: z.string().min(1).parse(id) }, select: { id: true, matriculaId: true, snapshot: true, conteudoHash: true, criadaEm: true, motivo: true, autor: { select: { id: true, nome: true } } } });
    if (!p) throw new ErroRegra("Prévia não encontrada.");
    return p;
  });
}

export async function consultarPainelPrevias(input: { matriculaId: string; paginaModelos?: number; paginaHistorico?: number }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ matriculaId: z.string().min(1), paginaModelos: z.number().int().min(1).max(100000).default(1), paginaHistorico: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, codigo: true, status: true, contratoOk: true, secretariaAssumiuEm: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } }, preparacaoComercial: { select: { regime: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const podePreparar = Boolean(m.preparacaoComercial && m.secretariaAssumiuEm && !m.contratoOk && ["RASCUNHO", "AGUARDANDO"].includes(m.status));
      const modelos = podePreparar ? await tx.versaoModeloContratual.findMany({
        where: { decisao: { aprovada: true }, AND: [{ conteudo: { path: ["finalidade"], equals: "CONTRATO" } }, { conteudo: { path: ["regimes"], array_contains: [m.preparacaoComercial!.regime] } }] },
        orderBy: [{ codigo: "asc" }, { versao: "desc" }], skip: (d.paginaModelos - 1) * 20, take: 21,
        select: { id: true, codigo: true, versao: true, conteudo: true },
      }) : [];
      const historico = await tx.previaDocumentoContratual.findMany({ where: { matriculaId: m.id }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.paginaHistorico - 1) * 20, take: 21,
        select: { id: true, criadaEm: true, motivo: true, autor: { select: { nome: true } }, modelo: { select: { codigo: true, versao: true } } } });
      return { matricula: { id: m.id, codigo: m.codigo, aluno: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" ") }, podePreparar,
        modelos: modelos.slice(0, 20).map((v) => ({ id: v.id, codigo: v.codigo, versao: v.versao, ...z.object({ titulo: z.string(), aplicacao: z.string() }).parse(v.conteudo) })),
        historico: historico.slice(0, 20), paginaModelos: d.paginaModelos, paginaHistorico: d.paginaHistorico, maisModelos: modelos.length > 20, maisHistorico: historico.length > 20 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
