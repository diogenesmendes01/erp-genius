import { telefoneE164 } from "@/server/_shared/validacao";

export function normalizarNumeroNovaConversa(entrada: string): string | null {
  const texto = entrada.trim();
  if (!/^\+[0-9 ()-]+$/.test(texto)) return null;
  const canonico = texto.replace(/[ ()-]/g, "");
  const resultado = telefoneE164.safeParse(canonico);
  return resultado.success ? resultado.data : null;
}
