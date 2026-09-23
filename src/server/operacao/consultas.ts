import { prisma } from "@/lib/prisma";
import { FusoInstitucionalSchema } from "./fuso";

/**
 * Fuso institucional configurado (ou null se a escola ainda não configurou um — o schema
 * permite, `ConfiguracaoOperacional.fusoInstitucional` é opcional). Uso típico: pré-preencher
 * o CampoFuso de um formulário com o fuso real da escola em vez de um valor fixo.
 *
 * Nunca devolve "UTC" como substituto silencioso — quem chama decide o fallback (o padrão
 * seguro é string vazia, forçando o operador a informar, não um fuso plausível-mas-errado).
 * Ver docs/42-auditoria-frontend-ux.md, ganho rápido 14; e carregarFusoInstitucionalTx em
 * ./relogio.ts para o equivalente dentro de uma transação (lê com FOR SHARE).
 */
export async function consultarFusoInstitucional(): Promise<string | null> {
  const config = await prisma.configuracaoOperacional.findUnique({
    where: { id: "escola" },
    select: { fusoInstitucional: true },
  });
  const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
  return fuso.success ? fuso.data : null;
}
