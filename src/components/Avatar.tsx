import { IconSparkles } from "@tabler/icons-react";

const TAMANHOS = {
  32: "h-8 w-8 text-xs font-medium",
  40: "h-10 w-10 text-sm font-medium",
  44: "h-11 w-11 text-sm font-semibold",
  48: "h-12 w-12 text-base font-medium",
  132: "h-[132px] w-[132px] text-[44px] font-medium tracking-[-0.01em]",
} as const;
const TONS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5", "bg-avatar-6", "bg-avatar-7", "bg-avatar-8"] as const;

/** Até duas iniciais de palavras com letras; números e emoji não identificam um nome. */
export function iniciais(nome: string | null): string {
  const letras = (nome ?? "").trim().split(/\s+/).flatMap((palavra) => palavra.match(/\p{L}/u)?.[0] ?? []);
  if (!letras.length) return "";
  return (letras[0]! + (letras.length > 1 ? letras[letras.length - 1]! : "")).toLocaleUpperCase("pt-BR");
}

/** FNV-1a mantém a mesma cor do contato entre renders, sem depender do tema. */
export function tomDoAvatar(chave: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < chave.length; i++) { hash ^= chave.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return ((hash >>> 0) % 8) + 1;
}

export function Avatar({ nome, tamanho = 40, quadrado = false, tom, selo }: {
  nome: string | null; tamanho?: 32 | 40 | 44 | 48 | 132; quadrado?: boolean; tom?: number; selo?: "ia";
}) {
  const fundo = tom === undefined ? undefined : TONS[tom - 1];
  const raio = !quadrado ? "rounded-full" : tamanho === 132 ? "rounded-[34px]" : tamanho === 44 ? "rounded-lg" : "rounded-md";
  return (
    <span
      aria-hidden="true"
      className={"inline-flex shrink-0 items-center justify-center " + (fundo ? fundo + " text-white" : "bg-brand-bg text-brand-800") + " " + raio + " " + TAMANHOS[tamanho] + (selo ? " relative" : "")}
    >
      {iniciais(nome) || "#"}
      {selo === "ia" && <span className="absolute -bottom-[3px] -right-[3px] flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-surface bg-ai-solid text-white"><IconSparkles size={10} /></span>}
    </span>
  );
}
