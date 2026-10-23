"use client";

import { useSyncExternalStore } from "react";
import { SeloNaoLidasInbox } from "./SeloNaoLidasInbox";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconHome, IconMail,
  IconUsers,
  IconUserCheck,
  IconWallet,
  IconSettings,
  IconLogout,
  IconSchool,
  IconSun,
  IconMoon,
  IconMessageCircle,
  IconBriefcase,
  IconLayoutKanban,
  IconBuilding,
  IconChecklist,
  IconChartBar,
  IconSparkles,
  type IconProps,
} from "@tabler/icons-react";
import { navParaPapeis, hrefAtivoMaisLongo } from "@/lib/nav";
import { acompanharTema, alternarTema, temaEscuroAplicado, temaEscuroNoServidor } from "@/lib/tema";

type Icone = React.ComponentType<IconProps>;

const ICONS: Record<string, Icone> = {
  Home: IconHome,
  // Chave "Mail" (antes `IconMail` solto virava a chave "IconMail" e "Envios do portal" caía no ícone de Home).
  Mail: IconMail,
  KanbanSquare: IconLayoutKanban,
  Briefcase: IconBriefcase,
  Users: IconUsers,
  UserCheck: IconUserCheck,
  Wallet: IconWallet,
  Settings: IconSettings,
  MessageCircle: IconMessageCircle,
  Building: IconBuilding,
  Checklist: IconChecklist,
  ChartBar: IconChartBar,
  Sparkles: IconSparkles,
};

/**
 * Alternância de tema — compartilhada pela Sidebar e pela barra mobile. `className` ajusta a área de toque.
 * O estado é um só (src/lib/tema.ts): as duas instâncias leem a classe `dark` do <html> e são avisadas na
 * troca, então a Sidebar nunca fica com o ícone velho depois de trocar no celular (C21 da #170).
 * aria-pressed diz ao leitor de tela se o tema escuro está ligado — o ícone sozinho não dizia.
 */
export function ThemeToggle({ className = "text-gray-400 hover:text-gray-700", classeIcone = "h-4 w-4" }: { className?: string; classeIcone?: string }) {
  const dark = useSyncExternalStore(acompanharTema, temaEscuroAplicado, temaEscuroNoServidor);

  return (
    <button
      onClick={alternarTema}
      type="button"
      className={className}
      title={dark ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
      aria-pressed={dark}
    >
      {dark ? <IconSun className={classeIcone} /> : <IconMoon className={classeIcone} />}
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
                "flex min-h-10 items-center gap-3 rounded-item px-3 text-sm transition-colors max-sm:min-h-11 " +
                (ativo
                  ? "bg-brand-bg text-brand-800 font-medium"
                  : "text-gray-800 hover:bg-highlight")
              }
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/inbox" && <SeloNaoLidasInbox inicial={naoLidasInbox} variante="pilula" />}
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
  /** Notificação básica da inbox (doc 30 E3): conversas não lidas pessoais no escopo do usuário. */
  naoLidasInbox?: number;
}) {
  // Só a partir de md; abaixo disso a navegação fica na barra mobile (BarraMobile), que abre a
  // mesma lista numa gaveta — antes a Sidebar de 224px fixos deixava ~87px de conteúdo em 375px.
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-e border-gray-200 bg-surface-muted p-3 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2 py-1 font-medium">
        <IconSchool className="h-5 w-5 text-brand-600" />
        Genius
      </div>

      <NavLinks papeis={papeis} naoLidasInbox={naoLidasInbox} />

      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-xs font-medium text-brand-800">
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
