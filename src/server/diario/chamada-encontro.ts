"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { carregarChamadaTx } from "./chamada-tx";
import { estadoDiario } from "./estado";
import { carregarAlunoParticularTx } from "./particular-contexto";
import { exigirAcessoRegularizacaoAulaTx } from "./regularizacao-acesso";
import { alocacaoCobreAula } from "./alocacoes";

export async function listarChamadaEncontro(input: { encontroId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: d.encontroId });
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { id: true, finalidade: true, turmaId: true, matriculaId: true, professorId: true, inicio: true, fim: true, status: true, fusoOrigem: true,
        diario: { select: { id: true, professorId: true, conteudo: true, atualizadoEm: true, registros: { select: { alunoId: true, nomeAluno: true, presente: true, observacao: true, matriculaId: true, participacao: true } } } } } });
      if (!e) throw new ErroPermissao("Sem atribuição para este encontro.");
      if (e.finalidade !== "AULA") throw new ErroRegra("Recuperação não recebe chamada de aula.");
      if (e.status !== "PREVISTO" || e.fim > new Date()) throw new ErroRegra("A chamada exige encontro previsto já terminado.");
      if (e.diario && e.diario.professorId !== e.professorId) throw new ErroPermissao("O diário possui autoria diferente do professor original.");
      const chamada = e.turmaId ? await carregarChamadaTx(tx, e.turmaId, e.inicio) : await carregarAlunoParticularTx(tx, e.matriculaId!, e.inicio);
      // Edição continua dependente de vínculo ativo hoje; esta consulta não amplia acesso docente.
      const ativos = new Set(e.turmaId ? (await tx.alocacaoTurma.findMany({ where: { turmaId: e.turmaId, ativa: true }, select: { alunoId: true } })).map((a) => a.alunoId) : chamada.alunos.map(a => a.alunoId));
      const anteriores = new Map(e.diario?.registros.map((r) => [r.alunoId, r]));
      const candidatosIdentificados = e.turmaId ? await tx.alocacaoTurma.findMany({ where: { turmaId: e.turmaId, matriculaId: { not: null }, OR: [
        { provenienciaVinculo: "MIGRACAO" },
        { provenienciaVinculo: null, criadoEm: { lte: e.inicio }, OR: [{ encerradaEm: { gt: e.inicio } }, { ativa: true, encerradaEm: null }] },
      ] }, select: { alunoId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } }) : [];
      const identificados = new Set(e.turmaId ? candidatosIdentificados.filter((a) => alocacaoCobreAula(a, e.inicio)).map((a) => a.alunoId) : chamada.alunos.map(a => a.alunoId));
      const alunos = new Map(chamada.alunos.map((a) => {
        const anterior = anteriores.get(a.alunoId);
        return [a.alunoId, { ...a, nomeAluno: anterior?.nomeAluno ?? a.nomeAluno, presente: anterior?.presente ?? null,
          observacao: anterior?.observacao ?? null, participacao: anterior?.participacao ?? null, podeClassificar: identificados.has(a.alunoId), podeEditar: !e.diario || ativos.has(a.alunoId) }];
      }));
      for (const r of anteriores.values()) if (!alunos.has(r.alunoId)) alunos.set(r.alunoId, { ...r, podeClassificar: false, podeEditar: false });
      return { encontroId: e.id, turmaId: e.turmaId, ocorridaEm: e.inicio.toISOString(), fusoOrigem: e.fusoOrigem, diarioId: e.diario?.id ?? null,
        estadoAnterior: e.diario ? estadoDiario(e.diario) : null,
        conteudo: e.diario?.conteudo ?? "", exigeConferencia: chamada.exigeConferencia, alunos: [...alunos.values()].sort((a, b) => a.nomeAluno.localeCompare(b.nomeAluno)) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}
