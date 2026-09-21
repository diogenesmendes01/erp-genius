"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { docenteAtual } from "@/server/diario/permissoes";
import { bloquearLancamento } from "./lancamento-tx";
import { notaVigente } from "./nota-vigente";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { identificarMatriculaAvaliacao } from "./identificacao";

export async function consultarCorrecoesNota(input: { lancamentoId: string; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ lancamentoId: z.string().min(1).max(100), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.versaoLancamentoAvaliacao.findUnique({ where: { id: d.lancamentoId }, select: { registro: { select: { alocacaoId: true } } } });
      if (!ref) throw new ErroRegra("Lançamento não encontrado.");
      const a = await bloquearLancamento(tx, ref.registro.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const gestao = fresco?.ativo && fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      if (!fresco?.ativo || !(gestao || (fresco.papeis.includes(Papel.PROFESSOR) && docenteAtual(u.id, t)))) throw new ErroPermissao();
      const v = await tx.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: d.lancamentoId }, include: { decisao: true, registro: { include: { regra: true } } } });
      if (!v.decisao?.aprovada) throw new ErroRegra("Esta avaliação ainda não possui notas oficiais.");
      const vigente = await notaVigente(tx, v), regra = ConteudoRegraAvaliacaoSchema.parse(v.registro.regra.conteudo);
      const ultima = await tx.propostaCorrecaoNota.findFirst({ where: { lancamentoId: v.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const propostas = await tx.propostaCorrecaoNota.findMany({ where: { lancamentoId: v.id }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, versao: true, notas: true, origemHash: true, motivo: true, criadaEm: true, autor: { select: { id: true, nome: true } },
          decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } } } });
      const origens = await tx.propostaCorrecaoNota.findMany({ where: { lancamentoId: v.id, entradaHash: { in: propostas.slice(0, 20).map(p => p.origemHash) }, decisao: { aprovada: true } }, select: { entradaHash: true, notas: true } });
      return { alocacaoId: a.id, codigoAvaliacao: v.registro.codigoAvaliacao, titulo: regra.avaliacoes.find(av => av.codigo === v.registro.codigoAvaliacao)?.titulo ?? v.registro.codigoAvaliacao,
        identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId),
        vigente, escala: regra.escala, versaoEsperada: ultima?.versao ?? 0, pagina: d.pagina, temProxima: propostas.length > 20,
        propostas: propostas.slice(0, 20).map(p => {
          const origem = p.origemHash === v.conteudoHash ? v.notas : origens.find(o => o.entradaHash === p.origemHash)?.notas;
          if (!origem) throw new ErroRegra("Origem histórica da proposta precisa de conferência.");
          return { id: p.id, versao: p.versao, motivo: p.motivo, criadaEm: p.criadaEm, autor: p.autor, decisao: p.decisao,
            notas: NotasLancamentoSchema.parse(p.notas), anteriores: NotasLancamentoSchema.parse(origem), podeRevisar: !!gestao && p.autor.id !== u.id && !p.decisao };
        }),
      };
    });
  });
}
