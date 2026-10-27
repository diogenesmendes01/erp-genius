import { Papel } from "@prisma/client";

export interface ConfigTab {
  href: string;
  label: string;
  papeis: Papel[];
}

export const CONFIG_TABS: ConfigTab[] = [
  { href: "/configuracao/paises", label: "Países", papeis: [Papel.ADMINISTRADOR] },
  { href: "/configuracao/contratos", label: "Modelos contratuais", papeis: [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] },
  { href: "/configuracao/catalogo", label: "Catálogo", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO] },
  {
    href: "/configuracao/turmas",
    label: "Turmas",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO],
  },
  { href: "/configuracao/usuarios", label: "Usuários", papeis: [Papel.ADMINISTRADOR] },
  { href: "/configuracao/operacao", label: "Operação", papeis: [Papel.ADMINISTRADOR] },
  { href: "/configuracao/migracao", label: "Preparação de migração", papeis: [Papel.ADMINISTRADOR] },
  { href: "/configuracao/crm", label: "CRM", papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL] },
  {
    href: "/configuracao/whatsapp",
    label: "WhatsApp",
    papeis: [Papel.ADMINISTRADOR],
  },
];

export function tabsParaPapeis(papeis: Papel[]): ConfigTab[] {
  return CONFIG_TABS.filter((t) => t.papeis.some((p) => papeis.includes(p)));
}
