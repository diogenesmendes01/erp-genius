"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROTULO_ABA, hrefAba, type AbaFinanceiro } from "./abas";

/**
 * Barra de abas do /financeiro (E8): cada aba é uma rota; a ativa vem do caminho. As contagens das
 * filas pendentes aparecem no rótulo (A conferir, Retomadas sempre; Aprovações quando houver).
 */
export function BarraAbasFinanceiro({ abas, contagem }: { abas: AbaFinanceiro[]; contagem: Partial<Record<AbaFinanceiro, number>> }) {
  const pathname = usePathname() ?? "";
  const rotulo = (a: AbaFinanceiro) =>
    a === "informes" || a === "retomadas" ? `${ROTULO_ABA[a]} (${contagem[a] ?? 0})`
    : a === "aprovacoes" && contagem.aprovacoes ? `${ROTULO_ABA[a]} (${contagem.aprovacoes})`
    : ROTULO_ABA[a];
  return (
    <nav aria-label="Seções do financeiro" className="mb-5 flex flex-wrap gap-1">
      {abas.map((a) => {
        const ativa = pathname === hrefAba(a) || pathname.startsWith(`${hrefAba(a)}/`);
        return (
          <Link
            key={a}
            href={hrefAba(a)}
            scroll={false}
            aria-current={ativa ? "page" : undefined}
            className={"rounded-md px-3 py-1.5 text-sm " + (ativa ? "bg-brand-600 font-medium text-white" : "text-gray-600 hover:bg-gray-100")}
          >
            {rotulo(a)}
          </Link>
        );
      })}
    </nav>
  );
}
