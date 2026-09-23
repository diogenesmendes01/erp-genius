import { Papel } from "@prisma/client";

// Navegação do app shell — role-aware (ver docs/10 §2 permissões).
export interface NavItem {
  href: string;
  label: string;
  icon: string; // chave do ícone (mapeada p/ Tabler em Sidebar.tsx)
  papeis: Papel[] | "all";
}

export const NAV: NavItem[] = [
  { href: "/financeiro/permuta", label: "Permutas", icon: "Wallet", papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO] },
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
    // B2B — Fase 2 (doc 03): contrato corporativo, lote de colaboradores e fatura única.
    href: "/empresas",
    label: "Empresas",
    icon: "Building",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA],
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

/**
 * Escolhe, entre vários hrefs candidatos, o de prefixo mais longo que corresponde à rota
 * atual — usado para decidir qual item de navegação fica "ativo" quando dois hrefs
 * compartilham prefixo (ex. /financeiro e /financeiro/permuta; ver Sidebar.tsx e SubTabs.tsx,
 * que compartilham esta implementação para não divergir).
 *
 * Borda de segmento: um href só casa a rota exata ou um prefixo seguido de "/", nunca um
 * prefixo de string cru — /alunos não casaria um hipotético /alunos-outro-nome.
 */
export function hrefAtivoMaisLongo(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
}
