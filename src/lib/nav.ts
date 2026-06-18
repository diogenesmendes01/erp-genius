import { Papel } from "@prisma/client";

// Navegação do app shell — role-aware (ver docs/10 §2 permissões).
export interface NavItem {
  href: string;
  label: string;
  icon: string; // nome do ícone lucide-react
  papeis: Papel[] | "all";
}

export const NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: "Home", papeis: "all" },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: "KanbanSquare",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR],
  },
  {
    href: "/leads",
    label: "Leads",
    icon: "Users",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR],
  },
  {
    href: "/alunos",
    label: "Alunos",
    icon: "UserCheck",
    papeis: [
      Papel.ADMINISTRADOR,
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.FINANCEIRO,
      Papel.PROFESSOR,
    ],
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: "Wallet",
    papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL],
  },
  {
    href: "/configuracao",
    label: "Configuração",
    icon: "Settings",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO],
  },
];

export function navParaPapeis(papeis: string[] = []): NavItem[] {
  return NAV.filter(
    (item) => item.papeis === "all" || item.papeis.some((p) => papeis.includes(p)),
  );
}
