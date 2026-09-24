"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconHome, IconMail,
  IconLayoutKanban,
  IconUsers,
  IconUserCheck,
  IconWallet,
  IconSettings,
  IconLogout,
  IconSchool,
  IconSun,
  IconMoon,
  IconMessageCircle,
  IconBuilding,
  type IconProps,
} from "@tabler/icons-react";
import { navParaPapeis, hrefAtivoMaisLongo } from "@/lib/nav";

type Icone = React.ComponentType<IconProps>;

const ICONS: Record<string, Icone> = {
  Home: IconHome,
  // Chave "Mail" (antes `IconMail` solto virava a chave "IconMail" e "Envios do portal" caía no ícone de Home).
  Mail: IconMail,
  KanbanSquare: IconLayoutKanban,
  Users: IconUsers,
  UserCheck: IconUserCheck,
  Wallet: IconWallet,
  Settings: IconSettings,
  MessageCircle: IconMessageCircle,
  Building: IconBuilding,
};

/** Alternância de tema — compartilhada pela Sidebar e pela barra mobile. `className` ajusta a área de toque. */
export function ThemeToggle({ className = "text-gray-400 hover:text-gray-700" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem("tema", novo ? "dark" : "light");
    setDark(novo);
  }

  return (
    <button
      onClick={alternar}
      type="button"
      className={className}
      title={dark ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
    >
      {dark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </button>
  );
}

/**
 * Links da navegação principal por papel, com o ativo pelo prefixo mais longo (aria-current) e a
 * contagem de não lidas da inbox. Uma fonte só para a Sidebar (md+) e a gaveta da barra mobile —
 * as duas não podem divergir. `aoNavegar` fecha a gaveta ao escolher um item.
 */
export function NavLinks({ papeis, naoLidasInbox = 0, aoNavegar, rotulo = "Navegação principal" }: {
  papeis: string[];
  naoLidasInbox?: number;
  aoNavegar?: () => void;
  rotulo?: string;
}) {
  const pathname = usePathname();
  const itens = navParaPapeis(papeis);
  const hrefAtivo = hrefAtivoMaisLongo(pathname, itens.map((item) => item.href));
  return (
      <nav className="flex flex-col gap-1" aria-label={rotulo}>
        {itens.map((item) => {
          const Icon = ICONS[item.icon] ?? IconHome;
          const ativo = item.href === hrefAtivo;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                (ativo
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-gray-600 hover:bg-gray-50")
              }
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/inbox" && naoLidasInbox > 0 && (
                <span className="rounded-full bg-brand-solid px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {naoLidasInbox > 99 ? "99+" : naoLidasInbox}
                  <span className="sr-only"> mensagens não lidas</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
  );
}

export function Sidebar({
  papeis,
  nome,
  naoLidasInbox = 0,
}: {
  papeis: string[];
  nome: string;
  /** Notificação básica da inbox (doc 30 E3): soma de não-lidas no escopo do usuário. */
  naoLidasInbox?: number;
}) {
  // Só a partir de md; abaixo disso a navegação fica na barra mobile (BarraMobile), que abre a
  // mesma lista numa gaveta — antes a Sidebar de 224px fixos deixava ~87px de conteúdo em 375px.
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-surface p-3 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2 py-1 font-medium">
        <IconSchool className="h-5 w-5 text-brand-600" />
        Genius
      </div>

      <NavLinks papeis={papeis} naoLidasInbox={naoLidasInbox} />

      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-medium text-brand-700">
          {nome.slice(0, 2).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-sm text-gray-600">{nome}</span>
        <Link href="/preferencias" className="text-xs text-brand-700 underline" title="Preferências">Fuso</Link>
        <ThemeToggle />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-gray-400 hover:text-gray-700"
          title="Sair"
          aria-label="Sair"
        >
          <IconLogout className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
