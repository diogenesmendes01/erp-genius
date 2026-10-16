const TAMANHOS = { 32: "h-8 w-8 text-xs", 40: "h-10 w-10 text-sm", 48: "h-12 w-12 text-base" } as const;

/** Até duas iniciais (primeira e última palavra); vazio quando não há nome. */
export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const primeira = partes[0]!;
  const ultima = partes.length > 1 ? partes[partes.length - 1]! : "";
  return (primeira.charAt(0) + ultima.charAt(0)).toLocaleUpperCase("pt-BR");
}

export function Avatar({ nome, tamanho = 40, quadrado = false }: { nome: string | null; tamanho?: 32 | 40 | 48; quadrado?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-brand-bg font-medium text-brand-800 ${quadrado ? "rounded-md" : "rounded-full"} ${TAMANHOS[tamanho]}`}
    >
      {iniciais(nome) || "#"}
    </span>
  );
}
