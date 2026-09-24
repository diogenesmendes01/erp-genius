"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trilhaDoCaminho } from "@/lib/trilha";

/**
 * Trilha de navegação (breadcrumb) do shell (E2): de onde a tela vem e como subir, sem depender do
 * "Voltar" de cada página. Aparece a partir do segundo nível conhecido (na área em si, o menu basta).
 */
export function Trilha() {
  const itens = trilhaDoCaminho(usePathname() ?? "");
  if (itens.length < 2) return null;
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 text-xs text-gray-500">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {itens.map((item, i) => (
          <li key={item.href + i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-gray-300">/</span>}
            {item.atual ? (
              <span aria-current="page" className="text-gray-700">{item.rotulo}</span>
            ) : (
              <Link href={item.href} className="hover:text-gray-800 hover:underline">{item.rotulo}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
