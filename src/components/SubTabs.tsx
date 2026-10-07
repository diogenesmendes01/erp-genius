"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hrefDaAbaAtiva, type AbaSubnav } from "@/lib/nav";

// Sub-aba ativa = botão preenchido (destaque forte), conforme docs/09. Uma aba só por vez: prefixo
// mais longo, com `exato`/`prefixo` para as áreas de prefixos aninhados (ver AbaSubnav).
export function SubTabs({
  tabs,
  ariaLabel = "Sub-navegação",
}: {
  tabs: AbaSubnav[];
  /** Diferencie quando houver mais de um SubTabs na mesma página — o default serve só a
   *  instância única de hoje. */
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const hrefAtivo = hrefDaAbaAtiva(pathname ?? "", tabs);
  return (
    <nav className="mt-4 flex flex-wrap gap-1" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const ativo = t.href === hrefAtivo;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={ativo ? "page" : undefined}
            className={
              "rounded-md px-3 py-1.5 text-sm transition-colors " +
              (ativo
                ? "bg-brand-600 font-medium text-white"
                : "text-gray-600 hover:bg-gray-100")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
