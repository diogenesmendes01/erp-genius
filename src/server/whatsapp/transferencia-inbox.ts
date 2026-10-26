"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessao, type Resultado } from "@/server/_shared";
import { marcaIdempotencia } from "@/server/_shared/idempotencia";
import type { Setor } from "./setor";
import { atribuirAtendimentoTx, transferirAtendimentoTx } from "./transferencia-nucleo";
import { TransferirPessoaInboxSchema, TransferirSetorInboxSchema } from "./entrada-transferencia-inbox";
/** Nova fronteira Inbox; nenhum parâmetro do cliente pode selecionar os defaults históricos. */
export async function transferirPessoaInbox(input: { atendimentoId: string; usuarioId: string; contexto?: string; chaveIdempotencia: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { chaveIdempotencia, ...dados } = TransferirPessoaInboxSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados)!;
    await prisma.$transaction(tx => atribuirAtendimentoTx(tx, u, dados.atendimentoId, dados.usuarioId, { contexto: dados.contexto, marca }));
    revalidatePath("/inbox");
  });
}
/** Opt-in interno D5: a API histórica transferirAtendimento mantém min12/hash/defaults. */
export async function transferirSetorInbox(input: { atendimentoId: string; destino: Setor; destinoChave: string | null; contexto?: string; anexarResumoAria?: boolean; chaveIdempotencia: string }): Promise<Resultado<{ novoAtendimentoId: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { chaveIdempotencia, ...dados } = TransferirSetorInboxSchema.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, dados)!;
    const novoAtendimentoId = await prisma.$transaction(tx => transferirAtendimentoTx(tx, u, dados, marca, { anexarResumoAria: dados.anexarResumoAria }));
    revalidatePath("/inbox");
    return { novoAtendimentoId };
  });
}
