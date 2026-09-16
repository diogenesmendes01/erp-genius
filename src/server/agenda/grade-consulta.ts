"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao } from "@/server/_shared";
import { carregarGradeInicialTx } from "./grade-turma-tx";
import { conferirDisponibilidadeGrade } from "./grade-disponibilidade";

/** Conferência para revisão; não concede aprovação nem reserva disponibilidade. */
export async function consultarPropostaGradeTurma(input: { propostaId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const proposta = await tx.propostaGradeTurma.findUnique({ where: { id: d.propostaId }, include: { decisao: true, turma: { select: { codigo: true } } } });
      if (!proposta) throw new ErroRegra("Proposta de grade não encontrada.");
      const ultima = await tx.propostaGradeTurma.findFirstOrThrow({ where: { turmaId: proposta.turmaId }, orderBy: { versao: "desc" } });
      const pendencias: string[] = [];
      if (!proposta.decisao && ultima.id !== proposta.id) pendencias.push("Existe uma versão mais recente da proposta de grade.");
      let parametrosCorrespondem = false;
      let disponibilidade: Awaited<ReturnType<typeof conferirDisponibilidadeGrade>> | null = null;
      if (!proposta.decisao) try {
        const atual = await carregarGradeInicialTx(tx, proposta);
        parametrosCorrespondem = isDeepStrictEqual(proposta.snapshot, atual);
        if (!parametrosCorrespondem) pendencias.push("A turma, modalidade ou calendário mudou; prepare uma nova versão da grade.");
        if (parametrosCorrespondem) disponibilidade = await conferirDisponibilidadeGrade(tx, atual);
      } catch (erro) {
        if (!(erro instanceof ErroRegra)) throw erro;
        pendencias.push(erro.message);
      }
      const exibicao = z.object({
        origem: z.object({ quantidadeAulas: z.number(), duracaoMinutos: z.number() }),
        grade: z.object({ dataInicialInformada: z.string(), primeiraAula: z.string().datetime(), previsaoTermino: z.string().datetime(),
          encontros: z.array(z.object({ inicio: z.string().datetime(), fim: z.string().datetime() })) }),
      }).parse(proposta.snapshot);
      return {
        encontrosFuturos: exibicao.grade.encontros.every((e) => Date.parse(e.inicio) > Date.now()),
        turmaCodigo: proposta.turma.codigo, fusoOrigem: proposta.fusoOrigem, exibicao,
        podeDecidir: !proposta.decisao && proposta.preparadorId !== autor.id && usuario.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p)),
        id: proposta.id, turmaId: proposta.turmaId, versao: proposta.versao,
        preparadorId: proposta.preparadorId, motivo: proposta.motivo,
        criadoEm: proposta.criadoEm.toISOString(), snapshot: proposta.snapshot,
        versaoMaisRecente: ultima.versao,
        parametrosCorrespondem: proposta.decisao ? null : parametrosCorrespondem,
        decisao: proposta.decisao,
        publicada: proposta.decisao?.aprovada ?? false,
        disponibilidade,
        necessitaNovaProposta: pendencias.length > 0,
        pendencias,
        publicacaoAutorizada: false as const,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
