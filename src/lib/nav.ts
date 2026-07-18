import { Papel } from "@prisma/client";

// Navegação do app shell — role-aware (ver docs/10 §2 permissões).
export interface NavItem {
  href: string;
  label: string;
  icon: string; // chave do ícone (mapeada p/ Tabler em Sidebar.tsx)
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
    // Inbox WhatsApp (doc 26 §Camada 3): escopo real é por NÚMERO (whatsapp/escopo.ts);
    // o menu é só UX. Vendas (dono do número) + cobrança (respostas da régua).
    href: "/inbox",
    label: "Inbox",
    icon: "MessageCircle",
    papeis: [
      Papel.ADMINISTRADOR,
      Papel.GERENTE_COMERCIAL,
      Papel.VENDEDOR,
      Papel.FINANCEIRO,
      Papel.SECRETARIA_ACADEMICA,
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
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO, Papel.GERENTE_COMERCIAL],
  },
];

export function navParaPapeis(papeis: string[] = []): NavItem[] {
  return NAV.filter(
    (item) => item.papeis === "all" || item.papeis.some((p) => papeis.includes(p)),
  );
}
