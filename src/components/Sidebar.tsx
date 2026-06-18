"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  KanbanSquare,
  Users,
  UserCheck,
  Wallet,
  Settings,
  LogOut,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { navParaPapeis } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  Home,
  KanbanSquare,
  Users,
  UserCheck,
  Wallet,
  Settings,
};

export function Sidebar({ papeis, nome }: { papeis: string[]; nome: string }) {
  const pathname = usePathname();
  const itens = navParaPapeis(papeis);

  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-1 font-medium">
        <GraduationCap className="h-5 w-5 text-brand-600" />
        Genius
      </div>

      <nav className="flex flex-col gap-1">
        {itens.map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          const ativo = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                (ativo
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-gray-600 hover:bg-gray-50")
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-medium text-brand-700">
          {nome.slice(0, 2).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-sm text-gray-600">{nome}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-gray-400 hover:text-gray-700"
          title="Sair"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
