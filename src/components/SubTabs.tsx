"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hrefDaAbaAtiva, type AbaSubnav } from "@/lib/nav";

export function mostrarAbaAtiva(nav: HTMLElement | null): void {
  if (!nav || nav.scrollWidth <= nav.clientWidth) return;
  const ativa = nav.querySelector<HTMLElement>('[aria-current="page"]');
  if (!ativa) return;
  const faixa = nav.getBoundingClientRect();
  const aba = ativa.getBoundingClientRect();
  if (aba.left < faixa.left) nav.scrollLeft -= faixa.left - aba.left;
  else if (aba.right > faixa.right) nav.scrollLeft += aba.right - faixa.right;
}

export function SubTabs({
  tabs,
  ariaLabel,
}: {
  tabs: AbaSubnav[];
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const hrefAtivo = hrefDaAbaAtiva(pathname ?? "", tabs);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { mostrarAbaAtiva(nav.current); }, [hrefAtivo]);
  return (
    <nav ref={nav} className="mt-4 flex gap-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:p-1 sm:flex-wrap" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const ativo = t.href === hrefAtivo;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={ativo ? "page" : undefined}
            className={
              "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors max-sm:min-h-11 max-sm:inline-flex max-sm:items-center " +
              (ativo
                ? "bg-brand-solid font-medium text-on-brand"
                : "text-gray-600 hover:bg-highlight")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
