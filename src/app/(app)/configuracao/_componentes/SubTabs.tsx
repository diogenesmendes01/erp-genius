"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-aba ativa = botão preenchido (destaque forte), conforme docs/09.
export function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const hrefAtivo = tabs
    .map((t) => t.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="mt-4 flex flex-wrap gap-1" aria-label="Sub-navegação">
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
