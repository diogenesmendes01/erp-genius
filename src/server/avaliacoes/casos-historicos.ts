"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { registrarCasosRevisaoProgressaoTx } from "./casos-revisao-progressao-tx";
import { carregarAlocacoesAlcancadasPorEquivalenciaTx } from "./impactos-progressao-tx";

const entradaSchema = z.object({ tipo: z.enum(["REGULAR", "RECUPERACAO"]), decisaoId: z.string().trim().min(1).max(100) }).strict();
const impactosSchema = z.array(z.object({ id: z.string().min(1), status: z.enum(["APROVADA", "EXECUTADA"]),
  turmaDestinoId: z.string().min(1), decididoEm: z.string().nullable(), executadoEm: z.string().nullable(),
}).strict()).refine(itens => new Set(itens.map(i => i.id)).size === itens.length);

/** Prepara o registro de trabalho para decisões anteriores à persistência de
 * casos. Não recalcula impactos nem altera a decisão histórica. */
export async function materializarCasosHistoricosCorrecao(entrada: z.input<typeof entradaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = entradaSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await conferirGestorAvaliacao(tx, usuario.id);
      let fonte: { aprovada: boolean; matriculaId: string; alocacaoId: string; impactos: unknown };
      if (d.tipo === "REGULAR") {
        const decisao = await tx.decisaoCorrecaoNota.findUnique({ where: { id: d.decisaoId }, select: {
          aprovada: true, impactos: true, proposta: { select: { lancamento: { select: { registro: { select: { matriculaId: true, alocacaoId: true } } } } } },
        } });
        if (!decisao) throw new ErroRegra("Decisão de correção não encontrada.");
        fonte = { aprovada: decisao.aprovada, impactos: decisao.impactos, ...decisao.proposta.lancamento.registro };
      } else {
        const decisao = await tx.decisaoCorrecaoRecuperacao.findUnique({ where: { id: d.decisaoId }, select: {
          aprovada: true, impactos: true, proposta: { select: { notaOriginal: { select: { realizacao: { select: { itemReserva: { select: {
            reserva: { select: { proposta: { select: { matriculaId: true, alocacaoId: true } } } },
          } } } } } } } },
        } });
        if (!decisao) throw new ErroRegra("Decisão de correção não encontrada.");
        const envelope = z.object({ mudancas: z.unknown() }).safeParse(decisao.impactos);
        fonte = { aprovada: decisao.aprovada, impactos: envelope.success ? envelope.data.mudancas : undefined,
          ...decisao.proposta.notaOriginal.realizacao.itemReserva.reserva.proposta };
      }
      if (!fonte.aprovada) throw new ErroRegra("Somente correções aprovadas podem originar casos de revisão.");
      const analisados = impactosSchema.safeParse(fonte.impactos);
      if (!analisados.success) throw new ErroRegra("O histórico dos impactos precisa de conferência antes de preparar os casos.");
      const impactos = analisados.data;
      const existentes = await tx.casoRevisaoProgressao.findMany({ where: d.tipo === "REGULAR"
        ? { decisaoCorrecaoNotaId: d.decisaoId } : { decisaoCorrecaoRecuperacaoId: d.decisaoId },
        select: { id: true, matriculaId: true, solicitacaoId: true }, orderBy: { solicitacaoId: "asc" },
      });
      if (existentes.some(c => c.matriculaId !== fonte.matriculaId || !impactos.some(i => i.id === c.solicitacaoId))) {
        throw new ErroRegra("Os casos existentes não correspondem ao histórico desta correção.");
      }
      const faltantes = impactos.filter(i => !existentes.some(c => c.solicitacaoId === i.id));
      if (!faltantes.length) return { criados: 0, total: existentes.length, casos: existentes.map(c => ({ id: c.id, solicitacaoId: c.solicitacaoId })) };
      const alcancadas = await carregarAlocacoesAlcancadasPorEquivalenciaTx(tx, { matriculaId: fonte.matriculaId, alocacaoOrigemId: fonte.alocacaoId });
      const pedidos = await tx.solicitacaoMudancaAcademica.findMany({ where: { id: { in: faltantes.map(i => i.id) } },
        select: { id: true, matriculaId: true, alocacaoOrigemId: true },
      });
      for (const impacto of faltantes) {
        const pedido = pedidos.find(p => p.id === impacto.id);
        if (!pedido || (pedido.matriculaId ? pedido.matriculaId !== fonte.matriculaId || !alcancadas.has(pedido.alocacaoOrigemId)
          : pedido.alocacaoOrigemId !== fonte.alocacaoId)) {
          throw new ErroRegra("Um impacto histórico não possui vínculo ou equivalência aplicada conferida. Revise a origem antes de preparar os casos.");
        }
      }
      await registrarCasosRevisaoProgressaoTx(tx, { matriculaId: fonte.matriculaId, alocacaoFonteId: fonte.alocacaoId,
        origem: { tipo: d.tipo, decisaoId: d.decisaoId }, impactos: faltantes });
      const casos = await tx.casoRevisaoProgressao.findMany({ where: d.tipo === "REGULAR"
        ? { decisaoCorrecaoNotaId: d.decisaoId } : { decisaoCorrecaoRecuperacaoId: d.decisaoId },
        select: { id: true, solicitacaoId: true }, orderBy: { solicitacaoId: "asc" },
      });
      await registrarEvento(tx, { tipo: "CasosHistoricosCorrecaoPreparados", agregadoTipo: "Matricula", agregadoId: fonte.matriculaId, autorId: usuario.id,
        payload: { tipoCorrecao: d.tipo, decisaoId: d.decisaoId, casosCriados: casos.filter(c => !existentes.some(e => e.id === c.id)).map(c => c.id) } });
      return { criados: casos.length - existentes.length, total: casos.length, casos };
    });
  });
}
