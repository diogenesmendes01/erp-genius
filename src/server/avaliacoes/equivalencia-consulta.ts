"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { janelaDaPagina, PAGINA_MAXIMA, recorteDaPagina } from "@/lib/pagina-url";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";

/** Paginada por número (E4), 50 por página, em ordem estável (criadaEm, id). */
export async function listarPropostasEquivalencia(input: unknown) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
    const entrada = z.object({ matriculaId: z.string().trim().min(1).max(100),
      pagina: z.number().int().min(1).max(PAGINA_MAXIMA).default(1) }).strict().parse(input);
    const lidas = await prisma.propostaEquivalenciaAvaliacao.findMany({
      where: { matriculaId: entrada.matriculaId }, ...janelaDaPagina(entrada.pagina, 50),
      orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
      select: { id: true, versao: true, criadaEm: true, motivo: true,
        turmaOrigem: { select: { nome: true, codigo: true } }, turmaDestino: { select: { nome: true, codigo: true } },
        decisao: { select: { aprovada: true, aplicacao: { select: { id: true } } } },
      },
    });
    const { registros: propostas, temProxima } = recorteDaPagina(lidas, 50);
    const itens = propostas.map(({ decisao, ...item }) => ({ ...item,
      estado: decisao?.aplicacao ? "APLICADA" : decisao ? (decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
    }));
    return { itens, pagina: entrada.pagina, temProxima };
  });
}

/** A Secretaria consulta a autorização para transferir, sem receber as notas,
 * fontes ou comentários usados na decisão pedagógica. */
export async function consultarPropostaEquivalencia(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
    const { propostaId } = z.object({ propostaId: z.string().trim().min(1).max(100) }).strict().parse(input);
    const proposta = await prisma.propostaEquivalenciaAvaliacao.findUnique({ where: { id: propostaId }, select: {
      id: true, matriculaId: true, alocacaoOrigemId: true, versao: true, motivo: true, criadaEm: true,
      preparadorId: true, mapeamentos: true, snapshot: true,
      matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } },
      turmaOrigem: { select: { id: true, nome: true, codigo: true } },
      turmaDestino: { select: { id: true, nome: true, codigo: true } },
      decisao: { select: { id: true, aprovada: true, motivo: true, decididaEm: true,
        aplicacao: { select: { id: true, aplicadaEm: true, alocacaoDestinoId: true } } } },
    } });
    if (!proposta) throw new ErroRegra("Proposta de aproveitamento não encontrada.");
    const gestao = autor.papeis.includes(Papel.GERENTE_PEDAGOGICO) || autor.papeis.includes(Papel.ADMINISTRADOR);
    const { snapshot, mapeamentos, ...identificacao } = proposta;
    const estado = proposta.decisao?.aplicacao ? "APLICADA" : proposta.decisao ? (proposta.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE";
    const comum = { ...identificacao, estado,
      podeDecidir: gestao && !proposta.decisao && autor.id !== proposta.preparadorId,
      podeExecutar: estado === "APROVADA" && (autor.papeis.includes(Papel.SECRETARIA_ACADEMICA) || autor.papeis.includes(Papel.ADMINISTRADOR)),
    };
    // Flags indicam a etapa/papel; as ações repetem a conferência completa de
    // validade, versão e disponibilidade antes da escrita.
    return gestao ? { ...comum, visao: "PEDAGOGICA" as const, snapshot, mapeamentos }
      : { ...comum, visao: "EXECUCAO" as const };
  });
}
