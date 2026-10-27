import { prisma } from "@/lib/prisma";
import { FusoInstitucionalSchema } from "./fuso";

export async function consultarFusoInstitucional(): Promise<string | null> {
  const config = await prisma.configuracaoOperacional.findUnique({
    where: { id: "escola" },
    select: { fusoInstitucional: true },
  });
  const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
  return fuso.success ? fuso.data : null;
}
