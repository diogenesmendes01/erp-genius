"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hrefDaAbaAtiva, type AbaSubnav } from "@/lib/nav";

/**
 * Traz a aba ativa para a vista dentro da faixa rolável (abaixo de sm). `nearest` nos dois eixos: só rola o
 * que for preciso, e a página não pula na vertical quando a aba já está visível.
 */
export function mostrarAbaAtiva(nav: HTMLElement | null): void {
  const ativa = nav?.querySelector<HTMLElement>('[aria-current="page"]');
  ativa?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

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
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { mostrarAbaAtiva(nav.current); }, [hrefAtivo]);
  // Abaixo de sm (375 px), as abas ficam numa faixa só, rolável na horizontal, em vez de quebrar em várias
  // linhas e empurrar o conteúdo (C45, #170). Do sm para cima continuam quebrando como antes. O `p-1` da
  // faixa deixa o anel de foco (2 px + 2 px de afastamento) fora do corte do overflow.
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
