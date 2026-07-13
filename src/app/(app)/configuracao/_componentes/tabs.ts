import { Papel } from "@prisma/client";

// Sub-abas da Configuração (doc 09): Países · Catálogo · Turmas · Usuários.
// Dono = ADM; Turmas também acessível ao Gerente Pedagógico.
export interface ConfigTab {
  href: string;
  label: string;
  papeis: Papel[];
}

export const CONFIG_TABS: ConfigTab[] = [
  { href: "/configuracao/paises", label: "Países", papeis: [Papel.ADMINISTRADOR] },
  { href: "/configuracao/catalogo", label: "Catálogo", papeis: [Papel.ADMINISTRADOR] },
  {
    href: "/configuracao/turmas",
    label: "Turmas",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO],
  },
  { href: "/configuracao/usuarios", label: "Usuários", papeis: [Papel.ADMINISTRADOR] },
  // Canal WhatsApp (docs 26/30 E3/E4): números, templates e política da régua — admin.
  { href: "/configuracao/whatsapp", label: "WhatsApp", papeis: [Papel.ADMINISTRADOR] },
];

export function tabsParaPapeis(papeis: Papel[]): ConfigTab[] {
  return CONFIG_TABS.filter((t) => t.papeis.some((p) => papeis.includes(p)));
}
