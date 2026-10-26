import { telefoneE164 } from "@/server/_shared/validacao";

/** Prepara apenas formato internacional explícito; nunca deduz país nem valida existência do número. */
export function normalizarNumeroNovaConversa(entrada: string): string | null {
  const texto = entrada.trim();
  // Apenas separadores visuais. Remover qualquer não-dígito aceitaria letras/ramais como outro telefone.
  if (!/^\+[0-9 ()-]+$/.test(texto)) return null;
  const canonico = texto.replace(/[ ()-]/g, "");
  const resultado = telefoneE164.safeParse(canonico);
  return resultado.success ? resultado.data : null;
}
