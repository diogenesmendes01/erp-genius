"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, type Resultado } from "@/server/_shared";
import { consultarDecisaoAdministrativaDesistencia } from "./desistencia-administrativa";

const entradaSchema = z.object({
  cursor: z.string().trim().min(1).max(100).optional(),
}).strict();

export type ItemFilaAdministrativaDesistencia = {
  id: string;
  codigo: string | null;
  pedido: { id: string; versao: number; motivo: string; registradorNome: string };
  /** A fotografia do pedido ainda é a fotografia corrente da preparação. */
  atual: boolean;
  /** Indicação para a tela; a ação de decisão continua sendo a autoridade. */
  podeAprovar: boolean;
  podeDecidir: boolean;
  /** Há fonte financeira ou documental que exige nova conferência. */
  exigeConferencia: boolean;
};

export type FilaAdministrativaDesistencia = {
  itens: ItemFilaAdministrativaDesistencia[];
  proximoCursor: string | null;
};

type Candidato = { matriculaId: string; pedidoId: string };

async function exigirLeitorAtual(usuarioId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
    const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
    if (!usuario?.ativo || !usuario.papeis.some((papel) => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR)) {
      throw new ErroPermissao();
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/**
 * Fila operacional de pedidos que merecem apreciação administrativa.
 *
 * A seleção primária usa somente ids e sinais de avanço formal. O `snapshotJson`
 * do pedido participa deliberadamente: se a fonte que exigia a decisão mudou
 * depois do pedido, a pendência continua visível para revisão. Depois da página
 * de 21 ids, a consulta de cada matrícula recalcula os indicadores e a alçada
 * atuais; no máximo vinte consultas são feitas e nenhuma fotografia/URL/valor é
 * devolvido. Uma alteração concorrente pode, portanto, reduzir uma página, mas
 * nunca transforma esta lista em autorização para decidir.
 */
export async function listarPendenciasAdministrativasDesistencia(
  input: { cursor?: string } = {},
): Promise<Resultado<FilaAdministrativaDesistencia>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = entradaSchema.parse(input);
    await exigirLeitorAtual(sessao.id);

    // O LATERAL fixa somente o pedido mais recente da matrícula. Assim, uma
    // decisão no pedido atual não faz um pedido antigo sem decisão reaparecer.
    // Os jsonpaths cobrem a fotografia produzida por carregarConferencia…;
    // os EXISTS cobrem as mesmas fontes no estado corrente, sem carregar dados
    // financeiros para a fila.
    const candidatos = await prisma.$queryRaw<Candidato[]>(Prisma.sql`
      SELECT m.id AS "matriculaId", ultimo.id AS "pedidoId"
      FROM "Matricula" m
      JOIN LATERAL (
        SELECT p.id, p."snapshotJson"
        FROM "PedidoDesistenciaPreparacao" p
        WHERE p."matriculaId" = m.id
        ORDER BY p.versao DESC, p.id DESC
        LIMIT 1
      ) ultimo ON TRUE
      LEFT JOIN "DecisaoAdministrativaDesistencia" decisao ON decisao."pedidoId" = ultimo.id
      LEFT JOIN "EfetivacaoPedidoDesistenciaPreparacao" efetivacao ON efetivacao."matriculaId" = m.id
      WHERE m.status IN ('RASCUNHO', 'AGUARDANDO')
        AND m."ativadaEm" IS NULL
        AND efetivacao.id IS NULL
        AND decisao.id IS NULL
        AND (${dados.cursor ?? null}::text IS NULL OR m.id > ${dados.cursor ?? null})
        AND (
          m."contratoOk" = TRUE OR m."confirmacaoContratoEm" IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM "ProcessoAssinaturaContratual" processo
            JOIN "ConclusaoAssinaturaContratual" conclusao ON conclusao."processoId" = processo.id
            WHERE processo."matriculaId" = m.id
          )
          OR EXISTS (
            SELECT 1 FROM "Cobranca" c
            WHERE c."matriculaId" = m.id AND (
              c.status = 'PAGO' OR c."pagoEm" IS NOT NULL
              OR COALESCE(c."valorRecebido", 0) > 0 OR c."valorLiquidadoCredito" > 0 OR c."valorCompensadoPermuta" > 0
              OR EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId" = c.id AND i.status IN ('A_CONFERIR', 'CONFIRMADO'))
              OR EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId" = c.id)
            )
          )
          OR jsonb_path_exists(ultimo."snapshotJson", '$.matricula ? (@.contratoOk == true || @.confirmacaoContratoEm != null)')
          OR jsonb_path_exists(ultimo."snapshotJson", '$.processos[*] ? (@.conclusao != null)')
          OR jsonb_path_exists(ultimo."snapshotJson", '$.financeiro.cobrancas[*] ? (@.status == "PAGO" || @.pagoEm != null || (@.valorRecebido != null && @.valorRecebido != "0.00") || @.valorLiquidadoCredito != "0.00" || (@.valorCompensadoPermuta != null && @.valorCompensadoPermuta != "0.00") || @.informes[*].status == "A_CONFERIR" || @.informes[*].status == "CONFIRMADO" || @.recebimentos[*].id != null)')
        )
      ORDER BY m.id ASC
      LIMIT 21
    `);

    const pagina = candidatos.slice(0, 20);
    const itens: ItemFilaAdministrativaDesistencia[] = [];
    for (const candidato of pagina) {
      // Esta consulta repete a autorização fresca e a revalidação da fotografia
      // por matrícula. A página já foi limitada acima, evitando uma varredura
      // que adquira locks de todas as pendências.
      const consulta = await consultarDecisaoAdministrativaDesistencia({ matriculaId: candidato.matriculaId });
      // Falha de autorização ou de leitura não se converte em uma fila parcial.
      // A chamada já revalida o papel no banco, depois da seleção dos ids.
      if (!consulta.ok) throw new ErroPermissao();
      const dado = consulta.dado;
      if (!dado) throw new ErroPermissao();
      // Se surgiu nova versão entre o SQL e a revalidação, o candidato deixou
      // de ser o pedido atual; ele não pode aparecer como histórico pendente.
      if (dado.pedidos[0]?.id !== candidato.pedidoId) continue;
      const pedido = dado.pedidos.find((p) => p.id === candidato.pedidoId);
      if (!pedido || pedido.decisao) continue;
      itens.push({
        id: dado.matricula.id,
        codigo: dado.matricula.codigo,
        pedido: { id: pedido.id, versao: pedido.versao, motivo: pedido.motivo, registradorNome: pedido.registradorNome },
        atual: pedido.atual,
        podeAprovar: pedido.podeAprovar,
        podeDecidir: pedido.podeDecidir,
        exigeConferencia: !pedido.atual || !dado.exigeAprovacaoAdministrativa,
      });
    }
    await exigirLeitorAtual(sessao.id);
    return {
      itens,
      proximoCursor: candidatos.length > 20 ? candidatos[19].matriculaId : null,
    };
  });
}
