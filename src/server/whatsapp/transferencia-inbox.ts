"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessao, type Resultado } from "@/server/_shared";
import { marcaIdempotencia } from "@/server/_shared/idempotencia";
import { atribuirAtendimentoTx } from "./transferencia-nucleo";
import { TransferirPessoaInboxSchema } from "./entrada-transferencia-inbox";
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
