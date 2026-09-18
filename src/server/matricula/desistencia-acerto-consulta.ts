"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

const entrada = z.object({ matriculaId: z.string().trim().min(1).max(100) }).strict();

/** Leitura operacional Q165. Não reproduz a autorização da escrita: as ações
 * sempre recalculam fotografia, contexto e alçada no banco. */
export async function consultarAcertoDesistenciaContratual(input: z.input<typeof entrada>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const { matriculaId } = entrada.parse(input);
    return prisma.$transaction(async tx => {
      await bloquearMatriculas(tx, [matriculaId]);
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const [matricula, pedido, condicoes, efetivacao] = await Promise.all([
        tx.matricula.findUnique({ where: { id: matriculaId }, select: { id: true, codigo: true, status: true, alunoId: true } }),
        tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true, estadoHash: true,
          decisaoAdministrativa: { select: { id: true, aprovada: true, estadoHash: true } },
        } }),
        tx.condicoesEncerramentoMatricula.findFirst({ where: { matriculaId, status: "APROVADA" }, orderBy: { versao: "desc" }, select: { id: true, versao: true } }),
        tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId }, select: { id: true } }),
      ]);
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      const aplicacaoExistente = pedido && await tx.aplicacaoAcertoDesistenciaContratual.findFirst({ where: { decisao: { proposta: { pedidoId: pedido.id } } }, select: { id: true } });
      const temRevisaoPosterior = condicoes && await tx.condicoesEncerramentoMatricula.count({ where: { matriculaId, versao: { gt: condicoes.versao } } }) > 0;
      const fontes = condicoes ? await tx.$queryRaw<Array<{ valida: boolean }>>`SELECT q165_fonte_condicoes_valida(${condicoes.id}, true) AS valida` : [];
      const fonteValida = fontes[0]?.valida === true;
      // A cadeia e sua versão pertencem ao pedido atual; versões de pedidos
      // anteriores são evidência histórica, nunca candidatas a nova decisão.
      const propostas = await tx.propostaAcertoDesistenciaContratual.findMany({ where: { pedidoId: pedido?.id ?? "__pedido_indisponivel__" }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, pedidoId: true, condicoesId: true, anteriorId: true, versao: true, motivoReapresentacao: true, fotografiaHash: true, criadaEm: true, preparadorId: true, preparador: { select: { nome: true } }, memoria: true,
          decisao: { select: { id: true, aprovada: true, motivo: true, decisorId: true, decisor: { select: { nome: true } }, aplicacao: { select: {
            id: true, criadaEm: true, origensCredito: { select: { credito: { select: { id: true } } } },
          } } } } },
      });
      const podeAprovar = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      const temAplicacao = !!aplicacaoExistente;
      const impedimento = efetivacao ? "A desistência já foi efetivada." : temAplicacao ? "O acerto já foi aplicado; aguarde a efetivação da Secretaria." : !pedido ? "A Secretaria deve registrar o pedido de desistência." : !condicoes || temRevisaoPosterior || !fonteValida ? "É necessária uma versão contratual estruturada, aprovada e vigente." : null;
      const ultima = propostas[0];
      const podeReapresentar = !!ultima?.decisao && !ultima.decisao.aplicacao;
      return { matricula, pedido, condicoes, impedimento, podePreparar: !impedimento && (!ultima || podeReapresentar),
        reapresentacao: !impedimento && podeReapresentar ? { id: ultima.id, versao: ultima.versao, aprovada: ultima.decisao!.aprovada } : null,
        temMaisPropostas: propostas.length > 20,
        propostas: propostas.slice(0, 20).map(p => {
          const itens = (p.memoria as { itens?: Array<{ cobrancaId: string; moeda: string; devido: string; saldoDevido: string; creditoApurado: string; creditoJaApurado: string }> }).itens ?? [];
          const decisao = p.decisao;
          return { id: p.id, pedidoId: p.pedidoId, condicoesId: p.condicoesId, anteriorId: p.anteriorId, versao: p.versao, motivoReapresentacao: p.motivoReapresentacao, fotografiaHash: p.fotografiaHash, criadaEmISO: p.criadaEm.toISOString(), preparadorNome: p.preparador.nome,
            itens, podeDecidir: !impedimento && p.id === ultima?.id && !decisao && podeAprovar && p.preparadorId !== sessao.id && p.pedidoId === pedido?.id && p.condicoesId === condicoes?.id,
            podeAplicar: !impedimento && !!decisao?.aprovada && !decisao.aplicacao && podeAprovar && decisao.decisorId === sessao.id
              && p.id === ultima?.id && p.pedidoId === pedido?.id && p.condicoesId === condicoes?.id && pedido?.decisaoAdministrativa?.aprovada === true
              && pedido.decisaoAdministrativa.estadoHash === pedido.estadoHash,
            decisao: !decisao ? null : { id: decisao.id, aprovada: decisao.aprovada, motivo: decisao.motivo, decisorNome: decisao.decisor.nome,
              aplicacao: decisao.aplicacao ? { id: decisao.aplicacao.id, criadaEmISO: decisao.aplicacao.criadaEm.toISOString(),
                creditos: decisao.aplicacao.origensCredito.flatMap(origem => origem.credito ? [origem.credito.id] : []),
              } : null },
          };
        }),
      };
    });
  });
}
