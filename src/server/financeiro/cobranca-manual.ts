"use server";

import { Papel, StatusCobranca } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, ErroPermissao, ErroRegra, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import { suspensaoPorConferencia } from "@/server/cobrancas/conferencia";
import { MODELOS_WHATSAPP, type ModeloWhatsapp } from "./schema";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { PASSOS_POLITICA } from "@/server/whatsapp/schema";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "@/server/whatsapp/identidade";

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];
const Entrada = z.object({
  cobrancaId: z.string().min(1),
  modelo: z.enum(MODELOS_WHATSAPP),
  passo: z.enum(PASSOS_POLITICA),
  cicloRegua: z.number().int().nonnegative(),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "Mensagem longa demais (máx. 4096)."),
}).strict();

/**
 * Prepara um link wa.me para ação humana. Não grava evento, intenção, mensagem ou
 * contato e não chama driver; o destinatário é sempre resolvido da matrícula atual.
 */
export async function prepararCobrancaManual(input: {
  cobrancaId: string;
  modelo: ModeloWhatsapp;
  passo: PassoRegua;
  cicloRegua: number;
  texto: string;
}): Promise<Resultado<{ url: string; matriculaId: string }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = Entrada.parse(input);
    const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
    if (!usuario?.ativo || !usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || PAPEIS_BAIXA.includes(p))) throw new ErroPermissao();

    const cobranca = await prisma.cobranca.findUnique({
      where: { id: dados.cobrancaId },
      include: { matricula: { include: INCLUDE_MATRICULA_DESTINO } },
    });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
    if (cobranca.status !== StatusCobranca.PENDENTE && cobranca.status !== StatusCobranca.ATRASADO) throw new ErroRegra("Cobrança quitada ou cancelada não pode ser cobrada.");
    const saldo = cobranca.saldo ?? cobranca.valorNegociado.minus(cobranca.valorRecebido ?? 0);
    if (saldo.lte(0)) throw new ErroRegra("Cobrança sem saldo pendente não pode ser cobrada.");
    if (cobranca.cicloRegua !== dados.cicloRegua) throw new ErroRegra("O ciclo da cobrança mudou. Atualize antes de preparar a mensagem.");
    if (await suspensaoPorConferencia(cobranca.id)) throw new ErroRegra("Lembretes estão suspensos enquanto o pagamento está em conferência.");

    const destino = resolverDestinoFinanceiroDaMatricula(cobranca.matricula);
    if (!destino) throw new ErroRegra("Sem destinatário: confira o pagador e o telefone desta matrícula.");
    return { url: `https://wa.me/${destino.telefoneE164.slice(1)}?text=${encodeURIComponent(dados.texto)}`, matriculaId: cobranca.matriculaId };
  });
}
