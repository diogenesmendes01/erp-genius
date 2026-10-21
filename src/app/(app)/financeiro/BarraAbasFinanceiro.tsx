"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { mostrarAbaAtiva } from "@/components/SubTabs";
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
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { mostrarAbaAtiva(nav.current); }, [pathname]);
  // Abaixo de sm, faixa só rolável na horizontal, como a SubTabs (C45); antes as 9 abas quebravam em 3 linhas
  // a 375 px (C6, #263).
  return (
    <nav ref={nav} aria-label="Seções do financeiro" className="mb-5 flex gap-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:p-1 sm:flex-wrap">
      {abas.map((a) => {
        const ativa = pathname === hrefAba(a) || pathname.startsWith(`${hrefAba(a)}/`);
        return (
          <Link
            key={a}
            href={hrefAba(a)}
            scroll={false}
            aria-current={ativa ? "page" : undefined}
            className={"shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors max-sm:inline-flex max-sm:min-h-11 max-sm:items-center " + (ativa ? "bg-brand-solid font-medium text-on-brand" : "text-gray-600 hover:bg-highlight")}
          >
            {rotulo(a)}
          </Link>
        );
      })}
    </nav>
  );
}
