import { Papel } from "@prisma/client";

// Sub-abas da Configuração (doc 09): Países · Catálogo · Turmas · Usuários.
// Currículo e turmas pertencem também à gerência pedagógica (política 36).
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
  // Canal WhatsApp: admin vê todas as seções; Gerente Comercial vê Comercial e Régua comercial
  // (doc 27 C1). O gate real está em whatsapp/secoes.ts + o guard de cada página de seção (E8).
  {
    href: "/configuracao/whatsapp",
    label: "WhatsApp",
    papeis: [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL],
  },
];

export function tabsParaPapeis(papeis: Papel[]): ConfigTab[] {
  return CONFIG_TABS.filter((t) => t.papeis.some((p) => papeis.includes(p)));
}
