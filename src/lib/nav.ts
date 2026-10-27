import { Papel } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  papeis: Papel[] | "all";
}

export const NAV: NavItem[] = [
  { href: "/financeiro/permuta", label: "Permutas", icon: "Wallet", papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO] },
  { href: "/academico", label: "Mudanças acadêmicas", icon: "UserCheck", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR] },
  { href: "/comissoes", label: "Comissões", icon: "Wallet", papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR] },
  { href: "/secretaria", label: "Matrículas", icon: "UserCheck", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] },
  { href: "/secretaria/envios-portal", label: "Envios do portal", icon: "Mail", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] },
  { href: "/diario", label: "Diário de aulas", icon: "Users", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR] },
  { href: "/home", label: "Home", icon: "Home", papeis: "all" },
  { href: "/funil", label: "Funil", icon: "KanbanSquare", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR] },
  { href: "/relatorios", label: "Relatórios", icon: "ChartBar", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR] },
  { href: "/aria", label: "Agente de IA", icon: "Sparkles", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL] },
  { href: "/carteira", label: "Carteira", icon: "Briefcase", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR] },
  { href: "/contatos", label: "Contatos", icon: "Users", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA] },
  {
    href: "/tarefas",
    label: "Tarefas",
    icon: "Checklist",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA],
  },
  {
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
    href: "/empresas",
    label: "Empresas",
    icon: "Building",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA],
  },
  {
    href: "/configuracao",
    label: "Configuração",
    icon: "Settings",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA],
  },
];

export function navParaPapeis(papeis: string[] = []): NavItem[] {
  return NAV.filter(
    (item) => item.papeis === "all" || item.papeis.some((p) => papeis.includes(p)),
  );
}

export function hrefAtivoMaisLongo(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

export type AbaSubnav = { href: string; label: string; exato?: boolean; prefixo?: string };

export function hrefDaAbaAtiva(pathname: string, abas: Pick<AbaSubnav, "href" | "exato" | "prefixo">[]): string | undefined {
  const candidatas = abas.filter((a) => !a.exato || pathname === a.href);
  const chave = (a: (typeof candidatas)[number]) => (a.exato ? a.href : a.prefixo ?? a.href);
  const ativa = hrefAtivoMaisLongo(pathname, candidatas.map(chave));
  return candidatas.find((a) => chave(a) === ativa)?.href;
}

export type SecaoArea = AbaSubnav & { papeis: Papel[] };

export function abasParaPapeis(secoes: SecaoArea[], papeis: readonly Papel[]): AbaSubnav[] {
  const admin = papeis.includes(Papel.ADMINISTRADOR);
  return secoes
    .filter((s) => admin || s.papeis.some((p) => papeis.includes(p)))
    .map((s) => ({
      href: s.href,
      label: s.label,
      ...(s.exato ? { exato: true } : {}),
      ...(s.prefixo ? { prefixo: s.prefixo } : {}),
    }));
}
