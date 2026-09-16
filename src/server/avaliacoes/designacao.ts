"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { identificarMatriculaAvaliacao } from "./identificacao";
const id = z.string().min(1).max(100);
const schema = z.object({ alocacaoId: id, codigoAvaliacao: id, professorId: id.nullable(), versaoEsperada: z.number().int().min(0).max(2147483646),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function consultarDesignacoesAvaliacao(input: { alocacaoId: string; codigoAvaliacao: string; pagina?: number; busca?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: id, codigoAvaliacao: id, pagina: z.number().int().min(1).max(100000).default(1), busca: z.string().trim().max(100).default("") }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const a = await bloquearLancamento(tx, d.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { regraAvaliacao: true } });
      if (!t.regraAvaliacao) throw new ErroRegra("Confira a regra vinculada à turma.");
      const avaliacao = ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo).avaliacoes.find(av => av.codigo === d.codigoAvaliacao);
      if (!avaliacao) throw new ErroRegra("Avaliação não prevista na regra da turma.");
      const registro = await tx.registroAvaliacaoMatricula.findUnique({ where: { matriculaId_turmaId_codigoAvaliacao: { matriculaId: a.matriculaId, turmaId: a.turmaId, codigoAvaliacao: d.codigoAvaliacao } } });
      if (registro && (registro.alocacaoId !== a.id || registro.regraId !== t.regraAvaliacao.id)) throw new ErroRegra("Confira o aproveitamento de outro vínculo antes da designação.");
      const selecao = { id: true, versao: true, motivo: true, criadaEm: true, professor: { select: { id: true, nome: true, ativo: true } }, gestor: { select: { id: true, nome: true } } } as const;
      const atual = registro ? await tx.designacaoAvaliacao.findFirst({ where: { registroId: registro.id }, orderBy: { versao: "desc" }, select: selecao }) : null;
      const oficial = !!registro && await tx.versaoLancamentoAvaliacao.count({ where: { registroId: registro.id, decisao: { aprovada: true } } }) > 0;
      const historico = registro ? await tx.designacaoAvaliacao.findMany({ where: { registroId: registro.id }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21, select: selecao }) : [];
      const professores = oficial ? [] : await tx.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR }, ...(d.busca ? { nome: { contains: d.busca, mode: "insensitive" as const } } : {}) }, orderBy: [{ nome: "asc" }, { id: "asc" }], take: 51, select: { id: true, nome: true } });
      return { identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), titulo: avaliacao.titulo,
        atual, versaoEsperada: atual?.versao ?? 0, podeAlterar: !oficial, historico: historico.slice(0, 20), pagina: d.pagina, temProxima: historico.length > 20,
        professores: professores.slice(0, 50), refinarBusca: professores.length > 50, busca: d.busca };
    });
  });
}

export async function designarAvaliador(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const a = await bloquearLancamento(tx, d.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const repetida = await tx.designacaoAvaliacao.findUnique({ where: { gestorId_chaveIdempotencia: { gestorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra designação.");
        return { id: repetida.id, registroId: repetida.registroId, versao: repetida.versao };
      }
      if (d.professorId) {
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${d.professorId} FOR SHARE`;
        const p = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true } });
        if (!p?.ativo || !p.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Selecione um professor ativo.");
      }
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { regraAvaliacao: true } });
      if (!t.regraAvaliacao) throw new ErroRegra("Confira a regra vinculada à turma.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo);
      if (!regra.avaliacoes.some(av => av.codigo === d.codigoAvaliacao)) throw new ErroRegra("Avaliação não prevista na regra da turma.");
      let registro = await tx.registroAvaliacaoMatricula.findUnique({ where: { matriculaId_turmaId_codigoAvaliacao: { matriculaId: a.matriculaId, turmaId: a.turmaId, codigoAvaliacao: d.codigoAvaliacao } } });
      if (registro && (registro.alocacaoId !== a.id || registro.regraId !== t.regraAvaliacao.id)) throw new ErroRegra("Confira o aproveitamento de outro vínculo antes da designação.");
      if (registro && await tx.versaoLancamentoAvaliacao.count({ where: { registroId: registro.id, decisao: { aprovada: true } } })) throw new ErroRegra("A avaliação já possui notas oficiais.");
      const ultima = registro ? await tx.designacaoAvaliacao.findFirst({ where: { registroId: registro.id }, orderBy: { versao: "desc" } }) : null;
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe designação mais recente.");
      if ((ultima?.professorId ?? null) === d.professorId) throw new ErroRegra("A designação já corresponde ao responsável informado.");
      registro ??= await tx.registroAvaliacaoMatricula.create({ data: { matriculaId: a.matriculaId, turmaId: a.turmaId, alocacaoId: a.id, regraId: t.regraAvaliacao.id, codigoAvaliacao: d.codigoAvaliacao } });
      const designacao = await tx.designacaoAvaliacao.create({ data: { registroId: registro.id, professorId: d.professorId, gestorId: u.id, versao: d.versaoEsperada + 1,
        motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: d.professorId ? "AvaliadorDesignado" : "DesignacaoAvaliadorRevogada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id,
        payload: { designacaoId: designacao.id, registroId: registro.id, professorId: d.professorId, motivo: d.motivo, versao: designacao.versao } });
      return { id: designacao.id, registroId: registro.id, versao: designacao.versao };
    });
  });
}
