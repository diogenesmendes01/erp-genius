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
  // Canal WhatsApp: admin vê tudo (número/templates/política); Gerente Comercial vê só a
  // seção Comercial (auto-lead/saudação — doc 27 C1). O gate real está na page.tsx.
  {
    href: "/configuracao/whatsapp",
    label: "WhatsApp",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL],
  },
];

export function tabsParaPapeis(papeis: Papel[]): ConfigTab[] {
  return CONFIG_TABS.filter((t) => t.papeis.some((p) => papeis.includes(p)));
}
