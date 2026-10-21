"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { bloquearMigracaoRegra, contextoMigracaoRegra, decidirMigracaoRegraTx, DecidirMigracaoSchema, proporMigracaoRegraTx, ProporMigracaoSchema, RevisarMigracaoSchema } from "./migracao-regra-tx";

export async function revisarMigracaoRegra(input: z.input<typeof RevisarMigracaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = RevisarMigracaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      await bloquearMigracaoRegra(tx, d.turmaId, u.id);
      const c = await contextoMigracaoRegra(tx, d.turmaId, d.destinoId);
      const ultima = await tx.propostaMigracaoRegraTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      return { estadoHash: c.estadoHash, versaoEsperada: ultima?.versao ?? 0, alteracoes: c.alteracoes,
        origem: c.snapshot.origem, destino: c.snapshot.destino, turma: c.snapshot.turma,
        encontrosAfetados: c.snapshot.encontros.length, alocacoesAfetadas: c.snapshot.alocacoes.filter(a => a.ativa).length };
    });
  });
}
export async function proporMigracaoRegra(input: z.input<typeof ProporMigracaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => proporMigracaoRegraTx(tx, u.id, input));
  });
}
export async function decidirMigracaoRegra(input: z.input<typeof DecidirMigracaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => decidirMigracaoRegraTx(tx, u.id, input));
  });
}

export async function consultarMigracoesRegra(input: { turmaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ turmaId: RevisarMigracaoSchema.shape.turmaId, pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await bloquearMigracaoRegra(tx, d.turmaId, u.id);
      const ps = await tx.propostaMigracaoRegraTurma.findMany({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, versao: true, estadoHash: true, motivo: true, criadaEm: true, snapshot: true,
          preparador: { select: { id: true, nome: true } }, origem: { select: { id: true, versao: true, conteudo: true } }, destino: { select: { id: true, versao: true, conteudo: true } },
          decisao: { select: { id: true, aprovada: true, motivo: true, criadaEm: true, decisor: { select: { id: true, nome: true } } } } } });
      const ultima = await tx.propostaMigracaoRegraTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, select: { id: true } });
      const propostas = [];
      for (const p of ps.slice(0, 20)) {
        let pendencia: string | null = null;
        if (!p.decisao) {
          if (ultima?.id !== p.id) pendencia = "Existe proposta mais recente.";
          else {
            try {
              const c = await contextoMigracaoRegra(tx, d.turmaId, p.destino.id);
              if (c.estadoHash !== p.estadoHash) pendencia = "Os impactos mudaram. Prepare outra proposta.";
            } catch (e) {
              if (!(e instanceof ErroRegra)) throw e;
              pendencia = e.message;
            }
          }
        }
        const { snapshot, ...resumo } = p;
        const impacto = z.object({ encontros: z.array(z.unknown()), alocacoes: z.array(z.object({ ativa: z.boolean() })) }).parse(snapshot);
        const origem = p.origem ? { ...p.origem, conteudo: ConteudoRegraAvaliacaoSchema.parse(p.origem.conteudo) } : null;
        const destino = { ...p.destino, conteudo: ConteudoRegraAvaliacaoSchema.parse(p.destino.conteudo) };
        const alteracoes = (Object.keys(destino.conteudo) as (keyof typeof destino.conteudo)[])
          .filter(c => JSON.stringify(origem?.conteudo[c]) !== JSON.stringify(destino.conteudo[c]));
        propostas.push({ ...resumo, origem, destino, pendencia, alteracoes,
          encontrosRevisados: impacto.encontros.length, alocacoesAtivasRevisadas: impacto.alocacoes.filter(a => a.ativa).length,
          podeDecidir: !p.decisao && p.preparador.id !== u.id, podeAprovar: !p.decisao && !pendencia && p.preparador.id !== u.id });
      }
      return { propostas, pagina: d.pagina, temProxima: ps.length > 20 };
    });
  });
}

/** Dados de apresentação; a confirmação sempre revalida a revisão no servidor. */
export async function consultarPreparacaoMigracao(input: { turmaId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ turmaId: RevisarMigracaoSchema.shape.turmaId }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await bloquearMigracaoRegra(tx, d.turmaId, u.id);
      const turma = await tx.turma.findUniqueOrThrow({ where: { id: d.turmaId }, select: { id: true, nome: true, codigo: true, nivelId: true,
        nivel: { select: { codigo: true, idioma: { select: { nome: true } } } }, regraAvaliacao: { select: { id: true, versao: true } } } });
      const destino = await tx.versaoRegraAvaliacao.findFirst({ where: { nivelId: turma.nivelId, decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
      if (!destino) return { turma, destino: null, revisao: null, pendencia: "Ainda não existe regra publicada para este nível." };
      if (destino.id === turma.regraAvaliacao?.id) return { turma, destino, revisao: null, pendencia: "A turma já utiliza a última versão publicada." };
      try {
        const c = await contextoMigracaoRegra(tx, d.turmaId, destino.id);
        const ultima = await tx.propostaMigracaoRegraTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, select: { versao: true } });
        return { turma, destino, pendencia: null, revisao: {
          estadoHash: c.estadoHash, versaoEsperada: ultima?.versao ?? 0, origem: c.snapshot.origem, destino: c.snapshot.destino, alteracoes: c.alteracoes,
          encontrosRevisados: c.snapshot.encontros.length, alocacoesAtivasRevisadas: c.snapshot.alocacoes.filter(a => a.ativa).length,
        } };
      } catch (e) {
        if (!(e instanceof ErroRegra)) throw e;
        return { turma, destino, revisao: null, pendencia: e.message };
      }
    });
  });
}
