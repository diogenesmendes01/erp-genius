"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { IconLogout, IconMenu2 } from "@tabler/icons-react";
import { hrefAtivoMaisLongo, navParaPapeis } from "@/lib/nav";
import { Drawer } from "./Drawer";
import { NavLinks, ThemeToggle } from "./Sidebar";

/** Largura em que a Sidebar volta (md do Tailwind). */
export const CONSULTA_MD = "(min-width: 768px)";

/** Nome acessível do botão de menu — carrega as não lidas (um aria-label substitui o texto interno). */
export function rotuloBotaoMenu(aberta: boolean, naoLidas: number): string {
  if (aberta) return "Fechar menu";
  if (naoLidas <= 0) return "Abrir menu";
  return `Abrir menu, ${naoLidas > 99 ? "99+" : naoLidas} ${naoLidas === 1 ? "mensagem não lida" : "mensagens não lidas"}`;
}

// Shell mobile (docs/42-auditoria-frontend-ux.md, E6): abaixo de md a Sidebar some e esta barra fica
// no topo — menu (a mesma navegação numa gaveta à esquerda), nome da área, tema, fuso e sair. As duas
// partes entram juntas: esconder a Sidebar sem a barra deixaria o usuário sem logout e sem tema.
// Alvos de toque ≥ 40px: todo controle da barra tem min-h-10/min-w-10 (ícones de 24px).
export function BarraMobile({ papeis, nome, naoLidasInbox = 0 }: { papeis: string[]; nome: string; naoLidasInbox?: number }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const itens = navParaPapeis(papeis);
  const ativo = itens.find((i) => i.href === hrefAtivoMaisLongo(pathname, itens.map((x) => x.href)));
  const botao = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800";

  // Ao cruzar para md+ (girar o tablet, redimensionar) a Sidebar volta: a gaveta aberta ficaria como
  // um overlay modal com a navegação duplicada. Fecha.
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MD);
    const aoMudar = (e: { matches: boolean }) => { if (e.matches) setAberta(false); };
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-1 border-b border-gray-200 bg-surface px-2 py-1.5 md:hidden">
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
          {naoLidasInbox > 0 && <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-solid" />}
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
        <NavLinks papeis={papeis} naoLidasInbox={naoLidasInbox} rotulo="Menu de navegação" aoNavegar={() => setAberta(false)} />
      </Drawer>
    </>
  );
}
