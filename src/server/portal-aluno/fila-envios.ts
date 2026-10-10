"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { camposNavegacaoFila, corteDoId, direcaoDeLeitura, lerPaginaDaFila, MENSAGEM_DOIS_SENTIDOS, umSentido, type NavegacaoDaPagina, type NavegacaoFila } from "@/lib/cursor-fila";
import { ErroPermissao, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const Entrada = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);

export type ItemFilaEnviosPortalAluno = {
  id: string;
  alunoNome: string;
  finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL";
  situacao: "PREPARADO" | "CANCELADO" | "ENVIADO" | "FALHOU" | "INCERTO";
  criadoEm: Date;
  atualizadoEm: Date;
  conciliacao: null | { id: string; estadoHash: string; evidencia: string; versao: number; secretariaNome: string; criadaEm: Date; decisao: null | { aprovada: boolean; decididaEm: Date; solicitacaoReemitidaId: string | null } };
  podeRegistrarEvidencia: boolean;
  podeDecidirReemissao: boolean;
};

export type FilaEnviosPortalAluno = NavegacaoDaPagina & {
  itens: ItemFilaEnviosPortalAluno[];
};

/** Visão operacional sem destinatário, token, link ou recibo do provedor. Fila de trabalho com cursor nos dois sentidos
 * (E4, decisão de 10/10/2026), em ordem de id: a próxima continua do último item visto, e uma solicitação nova
 * (reemissão) não desloca a página de quem está conciliando. */
export async function consultarFilaEnviosPortalAluno(input: NavegacaoFila = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const nav = Entrada.parse(input);
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: sessao.id },
        select: { ativo: true, papeis: true },
      });
      if (!usuario?.ativo || !usuario.papeis.some((papel) =>
        papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR,
      )) throw new ErroPermissao("Sua permissão mudou; inicie a operação novamente.");

      const { registros, ...navegacao } = await lerPaginaDaFila(nav, 20, (leitura, take) => tx.solicitacaoEnvioPortalAluno.findMany({
        where: corteDoId(leitura, "asc"),
        orderBy: { id: direcaoDeLeitura(leitura)("asc") },
        take,
        select: {
          id: true,
          finalidade: true,
          situacao: true,
          criadoEm: true,
          atualizadoEm: true,
          conta: { select: { aluno: { select: { primeiroNome: true, sobrenome: true } } } },
          conciliacoes: { orderBy: { versao: "desc" }, take: 1, select: { id: true, estadoHash: true, evidencia: true, versao: true, criadaEm: true, secretariaId: true, secretaria: { select: { nome: true } }, decisao: { select: { aprovada: true, decididaEm: true, solicitacaoReemitidaId: true } } } },
        },
      }), (registro) => registro.id);
      const itens = registros.map((registro) => ({
        id: registro.id,
        alunoNome: [registro.conta.aluno.primeiroNome, registro.conta.aluno.sobrenome].filter(Boolean).join(" "),
        finalidade: registro.finalidade,
        situacao: registro.situacao,
        criadoEm: registro.criadoEm,
        atualizadoEm: registro.atualizadoEm,
        conciliacao: registro.conciliacoes[0] ? { id: registro.conciliacoes[0].id, estadoHash: registro.conciliacoes[0].estadoHash, evidencia: registro.conciliacoes[0].evidencia, versao: registro.conciliacoes[0].versao, secretariaNome: registro.conciliacoes[0].secretaria.nome, criadaEm: registro.conciliacoes[0].criadaEm, decisao: registro.conciliacoes[0].decisao } : null,
        podeRegistrarEvidencia: usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA) || usuario.papeis.includes(Papel.ADMINISTRADOR),
        podeDecidirReemissao: usuario.papeis.includes(Papel.ADMINISTRADOR) && registro.conciliacoes[0]?.secretariaId !== sessao.id,
      })) satisfies ItemFilaEnviosPortalAluno[];
      return { itens, ...navegacao } satisfies FilaEnviosPortalAluno;
    });
  });
}
