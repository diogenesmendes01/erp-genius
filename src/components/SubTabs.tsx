"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hrefDaAbaAtiva, type AbaSubnav } from "@/lib/nav";

// Sub-aba ativa = botão preenchido (destaque forte), conforme docs/09. Uma aba só por vez: prefixo
// mais longo, com `exato`/`prefixo` para as áreas de prefixos aninhados (ver AbaSubnav).
export function SubTabs({
  tabs,
  ariaLabel,
}: {
  tabs: AbaSubnav[];
  /** Nome da navegação para o leitor de tela ("Seções do CRM"). Obrigatório (C45, #170): o antigo padrão
   *  "Sub-navegação" não dizia de que área eram as abas e se repetia quando dois SubTabs ficam na mesma
   *  página (/configuracao/whatsapp mostra o da configuração e o do WhatsApp). */
  ariaLabel: string;
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
              "rounded-full px-3 py-1.5 text-sm transition-colors max-sm:min-h-11 max-sm:inline-flex max-sm:items-center " +
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
