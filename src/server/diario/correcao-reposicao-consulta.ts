"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { conferirAutorCorrecaoReposicaoTx, conferirFonteCorrecaoReposicaoTx } from "./correcao-reposicao-tx";
import { revisarImpactosCorrecaoReposicaoTx } from "./revisao-correcao-reposicao-tx";

const filtro = z.object({
  reposicaoId: z.string().min(1),
  conclusaoVersao: z.number().int().positive().safe().optional(),
  antesVersao: z.number().int().positive().optional(),
  limite: z.number().int().min(1).max(50).default(20),
}).strict();
const contextoAcademico = z.object({
  matriculaId: z.string(), nivelId: z.string(), alocacaoFonteId: z.string(),
  impactos: z.array(z.object({ id: z.string(), status: z.enum(["APROVADA", "EXECUTADA"]), turmaDestinoId: z.string(), decididoEm: z.string().nullable(), executadoEm: z.string().nullable() })),
}).strict();

const filaDocente = z.object({ antesId: z.string().min(1).optional(), limite: z.number().int().min(1).max(50).default(20) }).strict();

/** Entrada docente para Q54: conclusão existente e atribuição atual, sem
 * exigir que a matrícula siga ativa nem abrir a ficha do aluno. */
export async function listarReposicoesConcluidasDesignadas(input: z.input<typeof filaDocente> = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = filaDocente.parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo || !fresco.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
      const agora = new Date();
      const linhas = await tx.reposicaoIndividual.findMany({
        where: {
          ...(d.antesId ? { id: { lt: d.antesId } } : {}),
          conclusoes: { some: {} },
          designacoes: { some: { professorId: usuario.id, inicio: { lte: agora }, OR: [{ fim: null }, { fim: { gt: agora } }] } },
        }, orderBy: { id: "desc" }, take: d.limite + 1,
        select: { id: true, modalidade: true, aulaOriginal: { select: { inicio: true, fim: true, fusoOrigem: true } } },
      });
      return { itens: linhas.slice(0, d.limite).map(r => ({ id: r.id, modalidade: r.modalidade,
        origem: { inicio: r.aulaOriginal.inicio.toISOString(), fim: r.aulaOriginal.fim.toISOString(), fuso: r.aulaOriginal.fusoOrigem } })),
        proximoAntesId: linhas.length > d.limite ? linhas[d.limite - 1]!.id : null };
    });
  });
}

type Fonte = {
  concluida: boolean;
  encontro: null | { id: string; inicio: string; fim: string; fuso: string; realizadaEm: string };
  entrega: null | { id: string; versao: number; entregueEm: string; resumo: string; atividade: string };
  validadaEm: string | null;
  evidencia: string;
};

function fonteConclusao(conclusao: {
  concluida: boolean; encontroReposicaoId: string | null; realizadaEm: Date | null;
  entregaId: string | null; validadaEm: Date | null; evidencia: string;
  encontroReposicao: { id: string; inicio: Date; fim: Date; fusoOrigem: string } | null;
  entrega: { id: string; versao: number; entregueEm: Date; resumo: string; atividade: string } | null;
}): Fonte {
  return {
    concluida: conclusao.concluida,
    encontro: conclusao.encontroReposicao ? {
      id: conclusao.encontroReposicao.id,
      inicio: conclusao.encontroReposicao.inicio.toISOString(),
      fim: conclusao.encontroReposicao.fim.toISOString(),
      fuso: conclusao.encontroReposicao.fusoOrigem,
      realizadaEm: conclusao.realizadaEm?.toISOString() ?? conclusao.encontroReposicao.fim.toISOString(),
    } : null,
    entrega: conclusao.entrega ? {
      id: conclusao.entrega.id,
      versao: conclusao.entrega.versao,
      entregueEm: conclusao.entrega.entregueEm.toISOString(),
      resumo: conclusao.entrega.resumo,
      atividade: conclusao.entrega.atividade,
    } : null,
    validadaEm: conclusao.validadaEm?.toISOString() ?? null,
    evidencia: conclusao.evidencia,
  };
}

/** Q54: leitura restrita à Gestão/Admin ou ao docente atualmente designado.
 * Não reutiliza a consulta ampla de equipe, que também atende Secretaria. */
export async function consultarCorrecoesConclusaoReposicao(input: z.input<typeof filtro>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = filtro.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "ReposicaoIndividual" WHERE id = ${d.reposicaoId} FOR SHARE`);
      const reposicao = await tx.reposicaoIndividual.findUnique({ where: { id: d.reposicaoId }, select: {
        id: true, modalidade: true, matriculaId: true,
        matricula: { select: { alunoId: true } },
        aulaOriginal: { select: { inicio: true, fim: true, fusoOrigem: true } },
      } });
      if (!reposicao) throw new ErroRegra("Reposição não encontrada.");
      await conferirAutorCorrecaoReposicaoTx(tx, reposicao.id, usuario.id);

      const atual = await tx.conclusaoReposicaoIndividual.findFirst({
        where: { reposicaoId: reposicao.id }, orderBy: { versao: "desc" }, select: { versao: true },
      });
      if (!atual) throw new ErroRegra("Esta reposição ainda não possui conclusão para corrigir.");
      const versaoSelecionada = d.conclusaoVersao ?? atual.versao;
      const consultaHistorica = versaoSelecionada !== atual.versao;
      const conclusaoSelecionada = await tx.conclusaoReposicaoIndividual.findFirst({
        where: { reposicaoId: reposicao.id, versao: versaoSelecionada },
        include: {
          concluidaPor: { select: { nome: true } },
          encontroReposicao: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } },
          entrega: { select: { id: true, versao: true, entregueEm: true, resumo: true, atividade: true } },
        },
      });
      if (!conclusaoSelecionada) throw new ErroRegra("Versão da conclusão não encontrada nesta reposição.");
      const [anterior, seguinte] = await Promise.all([
        tx.conclusaoReposicaoIndividual.findFirst({ where: { reposicaoId: reposicao.id, versao: { lt: versaoSelecionada } }, orderBy: { versao: "desc" }, select: { versao: true } }),
        tx.conclusaoReposicaoIndividual.findFirst({ where: { reposicaoId: reposicao.id, versao: { gt: versaoSelecionada } }, orderBy: { versao: "asc" }, select: { versao: true } }),
      ]);

      const correcoes = await tx.correcaoConclusaoReposicaoIndividual.findMany({
        where: {
          conclusaoId: conclusaoSelecionada.id,
          ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}),
        },
        orderBy: [{ versao: "desc" }, { id: "desc" }], take: d.limite + 1,
        include: {
          autor: { select: { nome: true } },
          encontroReposicao: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } },
          entrega: { select: { id: true, versao: true, entregueEm: true, resumo: true, atividade: true } },
          decisao: { include: { decisor: { select: { nome: true } } } },
        },
      });
      const pagina = correcoes.slice(0, d.limite);
      const ultimaAprovada = await tx.correcaoConclusaoReposicaoIndividual.findFirst({
        where: { conclusaoId: conclusaoSelecionada.id, decisao: { is: { aprovada: true } } },
        orderBy: [{ versao: "desc" }, { id: "desc" }],
        include: {
          encontroReposicao: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } },
          entrega: { select: { id: true, versao: true, entregueEm: true, resumo: true, atividade: true } },
        },
      });
      const versaoEsperada = await tx.correcaoConclusaoReposicaoIndividual.aggregate({
        where: { conclusaoId: conclusaoSelecionada.id }, _max: { versao: true },
      });

      const agora = new Date();
      const [encontros, entregas] = reposicao.modalidade === "PARTICULAR"
        ? [await tx.agendaReposicaoIndividual.findMany({
          where: { reposicaoId: reposicao.id, encontro: { is: {
            finalidade: "REPOSICAO", turmaId: null, matriculaId: reposicao.matriculaId, status: "MINISTRADO",
            fim: { lte: agora, gte: reposicao.aulaOriginal.fim },
            diario: { is: { registros: { some: { alunoId: reposicao.matricula.alunoId, matriculaId: reposicao.matriculaId, participacao: "PRESENTE" } } } },
          } } }, select: { encontro: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } } },
        }), []] as const
        : [[], await tx.entregaReposicaoGravacao.findMany({
          where: { reposicaoId: reposicao.id, alunoId: reposicao.matricula.alunoId, entregueEm: { lte: agora } },
          select: { id: true, versao: true, entregueEm: true, resumo: true, atividade: true, evidencia: true }, orderBy: [{ versao: "desc" }, { id: "desc" }],
        })] as const;

      const base = fonteConclusao(conclusaoSelecionada);
      const vigente = ultimaAprovada ? fonteConclusao(ultimaAprovada) : base;
      const podeGerir = usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
      const historico = await Promise.all(pagina.map(async (correcao) => {
        const anteriorAprovada = await tx.correcaoConclusaoReposicaoIndividual.findFirst({
          where: { conclusaoId: conclusaoSelecionada.id, versao: { lt: correcao.versao }, decisao: { is: { aprovada: true } } },
          orderBy: [{ versao: "desc" }, { id: "desc" }],
          include: {
            encontroReposicao: { select: { id: true, inicio: true, fim: true, fusoOrigem: true } },
            entrega: { select: { id: true, versao: true, entregueEm: true, resumo: true, atividade: true } },
          },
        });
        const podeRejeitar = !consultaHistorica && podeGerir && correcao.autorId !== usuario.id && !correcao.decisao;
        let podeAprovar = false;
        let impactosHash: string | null = null;
        let impactos: { id: string; status: "APROVADA" | "EXECUTADA"; destino: string; casoId?: string | null }[] = [];
        let temImpactos = false;
        let impedimentoAprovacao: string | null = null;
        if (podeRejeitar && correcao.versao === (versaoEsperada._max.versao ?? 0)) {
          try {
            await conferirAutorCorrecaoReposicaoTx(tx, reposicao.id, correcao.autorId);
            await conferirFonteCorrecaoReposicaoTx(tx, reposicao.id, correcao, correcao.validadaPorId);
            const revisao = await revisarImpactosCorrecaoReposicaoTx(tx, { ...correcao, conclusao: { reposicaoId: reposicao.id } });
            impactosHash = revisao.impactosHash;
            impactos = revisao.impactos;
            podeAprovar = true;
          } catch (erro) {
            if (!(erro instanceof ErroRegra) && !(erro instanceof ErroPermissao)) throw erro;
            impedimentoAprovacao = erro.message;
            // A ação sempre repete a prova. Esta flag só evita prometer aprovação inviável.
          }
        }
        if (correcao.decisao?.aprovada && correcao.decisao.contextoAcademico) {
          const contexto = contextoAcademico.parse(correcao.decisao.contextoAcademico);
          if (contexto.matriculaId !== reposicao.matriculaId) throw new ErroRegra("O contexto acadêmico desta correção não corresponde à reposição.");
          temImpactos = contexto.impactos.length > 0;
          if (podeGerir && temImpactos) {
            const [turmas, casos] = await Promise.all([
              tx.turma.findMany({ where: { id: { in: contexto.impactos.map((impacto) => impacto.turmaDestinoId) } }, select: { id: true, nome: true, codigo: true } }),
              tx.casoRevisaoProgressao.findMany({ where: { decisaoCorrecaoConclusaoReposicaoId: correcao.decisao.id }, select: { id: true, solicitacaoId: true } }),
            ]);
            impactos = contexto.impactos.map((impacto) => ({ id: impacto.id, status: impacto.status, destino: turmas.find((turma) => turma.id === impacto.turmaDestinoId)?.codigo || turmas.find((turma) => turma.id === impacto.turmaDestinoId)?.nome || "Turma sem identificação", casoId: casos.find((caso) => caso.solicitacaoId === impacto.id)?.id ?? null }));
          }
        }
        return {
          id: correcao.id, versao: correcao.versao, criadaEm: correcao.criadaEm.toISOString(), autor: correcao.autor.nome,
          motivo: correcao.motivo, propostaHash: correcao.entradaHash,
          antes: fonteConclusao(anteriorAprovada ?? conclusaoSelecionada), fonte: fonteConclusao(correcao),
          decisao: correcao.decisao ? { aprovada: correcao.decisao.aprovada, motivo: correcao.decisao.motivo, decididaEm: correcao.decisao.decididaEm.toISOString(), decisor: correcao.decisao.decisor.nome } : null,
          podeRejeitar, podeAprovar, impactos, temImpactos: temImpactos || impactos.length > 0, podeVerCasos: podeGerir, impactosHash, impedimentoAprovacao,
        };
      }));
      return {
        reposicao: {
          id: reposicao.id, modalidade: reposicao.modalidade,
          origem: { inicio: reposicao.aulaOriginal.inicio.toISOString(), fim: reposicao.aulaOriginal.fim.toISOString(), fuso: reposicao.aulaOriginal.fusoOrigem },
        },
        conclusao: {
          id: conclusaoSelecionada.id, versao: conclusaoSelecionada.versao,
          concluidaPor: conclusaoSelecionada.concluidaPor.nome, fonte: base,
        },
        consultaHistorica,
        conclusaoAnteriorVersao: anterior?.versao ?? null,
        conclusaoSeguinteVersao: seguinte?.versao ?? null,
        ultimaConclusaoVersao: atual.versao,
        vigente: { fonte: vigente, origem: ultimaAprovada ? "CORRECAO_APROVADA" as const : "CONCLUSAO_ORIGINAL" as const },
        versaoEsperada: versaoEsperada._max.versao ?? 0,
        podePropor: !consultaHistorica,
        fontesDisponiveis: reposicao.modalidade === "PARTICULAR" ? {
          encontros: encontros.flatMap(({ encontro }) => encontro ? [{ id: encontro.id, inicio: encontro.inicio.toISOString(), fim: encontro.fim.toISOString(), fuso: encontro.fusoOrigem, realizadaEm: encontro.fim.toISOString() }] : []),
          entregas: [],
        } : {
          encontros: [],
          entregas: entregas.filter((entrega) => entrega.resumo.trim() && entrega.atividade.trim()).map((entrega) => ({ id: entrega.id, versao: entrega.versao, entregueEm: entrega.entregueEm.toISOString(), resumo: entrega.resumo, atividade: entrega.atividade, evidencia: entrega.evidencia })),
        },
        correcoes: historico,
        proximaAntesVersao: correcoes.length > d.limite ? pagina.at(-1)?.versao ?? null : null,
      };
    });
  });
}
