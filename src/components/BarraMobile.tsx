"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { IconLogout, IconMenu2 } from "@tabler/icons-react";
import { hrefAtivoMaisLongo, navParaPapeis } from "@/lib/nav";
import { Drawer } from "./Drawer";
import { NavLinks, ThemeToggle } from "./Sidebar";
import { SeloNaoLidasInbox, useNaoLidasInbox } from "./SeloNaoLidasInbox";

export const CONSULTA_MD = "(min-width: 768px)";

export function rotuloBotaoMenu(aberta: boolean, naoLidas: number): string {
  if (aberta) return "Fechar menu";
  if (naoLidas <= 0) return "Abrir menu";
  return `Abrir menu, ${naoLidas > 99 ? "99+" : naoLidas} ${naoLidas === 1 ? "conversa não lida" : "conversas não lidas"}`;
}

export function BarraMobile({ papeis, nome, naoLidasInbox: inicialNaoLidas = 0 }: { papeis: string[]; nome: string; naoLidasInbox?: number }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const itens = navParaPapeis(papeis);
  const temInbox = itens.some((i) => i.href === "/inbox");
  const naoLidasInbox = useNaoLidasInbox(inicialNaoLidas, temInbox);
  const ativo = itens.find((i) => i.href === hrefAtivoMaisLongo(pathname, itens.map((x) => x.href)));
  const botao = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-item p-2 text-gray-800 hover:bg-highlight max-sm:min-h-11 max-sm:min-w-11";

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MD);
    const aoMudar = (e: { matches: boolean }) => { if (e.matches) setAberta(false); };
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-1 border-b border-gray-200 bg-surface-muted px-2 py-1.5 md:hidden">
        <button
          type="button"
          className={botao + " relative"}
          aria-label={rotuloBotaoMenu(aberta, naoLidasInbox)}
          aria-haspopup="dialog"
          aria-expanded={aberta}
          aria-controls="menu-navegacao"
          onClick={() => setAberta((a) => !a)}
        >
          <IconMenu2 className="h-6 w-6" aria-hidden />
          {temInbox && <SeloNaoLidasInbox inicial={inicialNaoLidas} variante="ponto" />}
        </button>
        <span className="flex-1 truncate px-1 text-sm font-medium">{ativo?.label ?? "Genius"}</span>
        <ThemeToggle className={botao} classeIcone="h-6 w-6" />
        <Link href="/preferencias" className={botao + " text-xs"} aria-label="Preferências de fuso">Fuso</Link>
        <button type="button" className={botao} aria-label="Sair" onClick={() => signOut({ callbackUrl: "/login" })}>
          <IconLogout className="h-6 w-6" />
        </button>
      </header>
      <Drawer
        id="menu-navegacao"
        open={aberta}
        onClose={() => setAberta(false)}
        title="Menu"
        lado="esquerda"
        largura="w-72 max-w-[85vw]"
        footer={<p className="truncate text-sm text-gray-600">{nome}</p>}
      >
        <NavLinks papeis={papeis} naoLidasInbox={inicialNaoLidas} rotulo="Menu de navegação" aoNavegar={() => setAberta(false)} />
      </Drawer>
    </>
  );
}
