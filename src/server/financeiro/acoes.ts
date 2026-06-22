"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, StatusComissao, FormaPagamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  acumularPagamento,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import { PagamentoSchema, type PagamentoInput, type ModeloWhatsapp } from "./schema";

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];
const PAPEIS_COMISSAO: Papel[] = [Papel.FINANCEIRO];

export async function registrarPagamento(
  cobrancaId: string,
  input: PagamentoInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = PagamentoSchema.parse(input);

    const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
    if (cobranca.status === StatusCobranca.PAGO) throw new ErroRegra("Cobrança já está paga.");
    if (cobranca.status === StatusCobranca.CANCELADA)
      throw new ErroRegra("Cobrança cancelada não recebe pagamento.");

    // ACUMULA baixas parciais (issues #1/#10): nunca sobrescreve o total já recebido; saldo/
    // quitação pelo ACUMULADO; excedente acima do negociado só passa como crédito explícito.
    const jaRecebido = cobranca.valorRecebido ?? 0;
    const { recebidoTotal, saldo, quitada, excedente } = acumularPagamento(
      jaRecebido,
      cobranca.valorNegociado,
      dados.valorRecebido,
      dados.permitirExcedente,
    );

    await prisma.$transaction(async (tx) => {
      await tx.cobranca.update({
        where: { id: cobrancaId },
        data: {
          valorRecebido: recebidoTotal,
          saldo,
          status: quitada ? StatusCobranca.PAGO : StatusCobranca.PENDENTE,
          pagoEm: quitada ? dados.dataPagamento ?? new Date() : null,
          formaPagamento: dados.forma as FormaPagamento,
          comprovanteUrl: dados.comprovanteUrl ?? null,
          comprovanteNome: dados.comprovanteNome ?? null,
          comentario: dados.comentario || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "PagamentoRegistrado",
        agregadoTipo: "Cobranca",
        agregadoId: cobrancaId,
        autorId: autor.id,
        // payload preserva o histórico da baixa: valor desta baixa + acumulado + saldo + excedente + comprovante.
        payload: {
          valorRecebido: dados.valorRecebido,
          recebidoAcumulado: recebidoTotal,
          forma: dados.forma,
          quitada,
          saldo,
          excedente,
          comprovanteUrl: dados.comprovanteUrl ?? null,
          comprovanteNome: dados.comprovanteNome ?? null,
        },
      });
    });
    revalidatePath("/financeiro");
  });
}

export async function registrarCobrancaWhatsApp(
  cobrancaId: string,
  modelo: ModeloWhatsapp,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");

    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "CobrancaEnviadaWhatsApp",
        agregadoTipo: "Cobranca",
        agregadoId: cobrancaId,
        autorId: autor.id,
        payload: { modelo },
      });
    });
    revalidatePath("/financeiro");
  });
}

/** Fecha o mês: comissões Aprovadas → Pagas. (doc 10: fechamento dia 30 · pagamento dia 05) */
export async function fecharMesComissoes(): Promise<Resultado<{ pagas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_COMISSAO);
    const aprovadas = await prisma.comissao.findMany({ where: { status: StatusComissao.APROVADA } });
    if (aprovadas.length === 0) throw new ErroRegra("Nenhuma comissão aprovada para pagar.");

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const c of aprovadas) {
        await tx.comissao.update({
          where: { id: c.id },
          data: { status: StatusComissao.PAGA, pagaEm: agora },
        });
        await registrarEvento(tx, {
          tipo: "ComissaoPaga",
          agregadoTipo: "Comissao",
          agregadoId: c.id,
          autorId: autor.id,
          payload: { pagaEm: agora.toISOString(), valor: c.valor },
        });
      }
    });
    revalidatePath("/financeiro");
    return { pagas: aprovadas.length };
  });
}
