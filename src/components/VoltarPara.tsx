import Link from "next/link";
import { rotuloDoDestino } from "@/lib/trilha";

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
