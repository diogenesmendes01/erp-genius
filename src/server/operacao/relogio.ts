import { Prisma } from "@prisma/client";
import { FusoInstitucionalSchema } from "./fuso";

export async function carregarFusoInstitucionalTx(tx: Prisma.TransactionClient) {
  // Mantém a referência estável durante a conferência/aplicação.
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
  return fuso.success ? fuso.data : null;
}
