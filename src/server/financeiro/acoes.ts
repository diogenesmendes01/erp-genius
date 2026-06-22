"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, StatusComissao, FormaPagamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
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

    const saldo = cobranca.valorNegociado - dados.valorRecebido;
    const quitada = saldo <= 0;

    await prisma.$transaction(async (tx) => {
      await tx.cobranca.update({
        where: { id: cobrancaId },
        data: {
          valorRecebido: dados.valorRecebido,
          saldo: saldo > 0 ? saldo : 0,
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
        payload: {
          valorRecebido: dados.valorRecebido,
          forma: dados.forma,
          quitada,
          saldo: Math.max(0, saldo),
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

    await registrarEvento(prisma, {
      tipo: "CobrancaEnviadaWhatsApp",
      agregadoTipo: "Cobranca",
      agregadoId: cobrancaId,
      autorId: autor.id,
      payload: { modelo },
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
