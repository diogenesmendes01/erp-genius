import { Papel } from "@prisma/client";

// Navegação do app shell — role-aware (ver docs/10 §2 permissões).
export interface NavItem {
  href: string;
  label: string;
  icon: string; // chave do ícone (mapeada p/ Tabler em Sidebar.tsx)
  papeis: Papel[] | "all";
}

export const NAV: NavItem[] = [
  { href: "/academico", label: "Mudanças acadêmicas", icon: "UserCheck", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR] },
  { href: "/comissoes", label: "Comissões", icon: "Wallet", papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR] },
  { href: "/secretaria", label: "Matrículas", icon: "UserCheck", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] },
  { href: "/secretaria/envios-portal", label: "Envios do portal", icon: "Mail", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] },
  { href: "/diario", label: "Diário de aulas", icon: "Users", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR] },
  { href: "/carteiras", label: "Carteiras", icon: "Users", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL] },
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
    // Cada atendimento valida finalidade e vínculos atuais; menu é apenas navegação.
    href: "/inbox",
    label: "Inbox",
    icon: "MessageCircle",
    papeis: [
      Papel.ADMINISTRADOR,
      Papel.GERENTE_COMERCIAL,
      Papel.VENDEDOR,
      Papel.FINANCEIRO,
      Papel.SECRETARIA_ACADEMICA,
      Papel.PROFESSOR,
      Papel.GERENTE_PEDAGOGICO,
    ],
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
    // Gerente Comercial entra p/ a config comercial (auto-lead/saudação — doc 27 C1);
    // as sub-abas (tabs.ts) filtram o que ele vê (só WhatsApp) — o index redireciona p/ ela.
    href: "/configuracao",
    label: "Configuração",
    icon: "Settings",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA],
  },
];

export function navParaPapeis(papeis: string[] = []): NavItem[] {
  return NAV.filter(
    (item) => item.papeis === "all" || item.papeis.some((p) => papeis.includes(p)),
  );
}
