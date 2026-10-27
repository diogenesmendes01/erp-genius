"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { camposNavegacaoFila, lerPaginaDaFila, MENSAGEM_DOIS_SENTIDOS, umSentido, type NavegacaoDaPagina, type NavegacaoFila } from "@/lib/cursor-fila";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, type Resultado } from "@/server/_shared";
import { consultarDecisaoAdministrativaDesistencia } from "./desistencia-administrativa";

const entradaSchema = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);

export type ItemFilaAdministrativaDesistencia = {
  id: string;
  codigo: string | null;
  pedido: { id: string; versao: number; motivo: string; registradorNome: string };
  atual: boolean;
  podeAprovar: boolean;
  podeDecidir: boolean;
  exigeConferencia: boolean;
};

export type FilaAdministrativaDesistencia = NavegacaoDaPagina & {
  itens: ItemFilaAdministrativaDesistencia[];
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

export async function listarPendenciasAdministrativasDesistencia(
  input: NavegacaoFila = {},
): Promise<Resultado<FilaAdministrativaDesistencia>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const nav = entradaSchema.parse(input);
    await exigirLeitorAtual(sessao.id);

    const ler = (leitura: NavegacaoFila, take: number) => prisma.$queryRaw<Candidato[]>(Prisma.sql`
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
        ${leitura.depois !== undefined ? Prisma.sql`AND m.id > ${leitura.depois}` : leitura.antes !== undefined ? Prisma.sql`AND m.id < ${leitura.antes}` : Prisma.empty}
      ORDER BY m.id ${leitura.antes !== undefined ? Prisma.sql`DESC` : Prisma.sql`ASC`}
      LIMIT ${take}
    `);

    const { registros: daPagina, ...navegacao } = await lerPaginaDaFila(nav, 20, ler, (c) => c.matriculaId);
    const itens: ItemFilaAdministrativaDesistencia[] = [];
    for (const candidato of daPagina) {
      const consulta = await consultarDecisaoAdministrativaDesistencia({ matriculaId: candidato.matriculaId });
      if (!consulta.ok) throw new ErroPermissao();
      const dado = consulta.dado;
      if (!dado) throw new ErroPermissao();
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
    return { itens, ...navegacao };
  });
}
