import Link from "next/link";
import { rotuloDoDestino } from "@/lib/trilha";

/**
 * Link de volta (docs/42-auditoria-frontend-ux.md, E2): havia 65 redações de "Voltar" e 6 rótulos
 * diferentes para o mesmo destino /secretaria. Um formato só — "← Destino", com nome acessível
 * "Voltar para Destino" — e o nome do destino vem do MESMO mapa da trilha de navegação quando o
 * destino é uma página conhecida; `para` só é usado quando o mapa não sabe nomear o destino.
 */
export function VoltarPara({ href, para, className }: { href: string; para?: string; className?: string }) {
  const nome = rotuloDoDestino(href) ?? para ?? "página anterior";
  return (
    <Link
      href={href}
      aria-label={`Voltar para ${nome}`}
      className={"inline-flex items-center gap-1 text-sm text-brand-700 hover:underline" + (className ? ` ${className}` : "")}
    >
      <span aria-hidden="true">←</span> {nome}
    </Link>
  );
}
