import { Papel } from "@prisma/client";

export interface SecaoWhatsApp {
  href: string;
  label: string;
  papeis: Papel[];
}

const ADMIN = [Papel.ADMINISTRADOR];

export const SECOES_WHATSAPP = {
  numeros: { href: "/configuracao/whatsapp/numeros", label: "Números", papeis: ADMIN },
  templates: { href: "/configuracao/whatsapp/templates", label: "Templates", papeis: ADMIN },
  politica: { href: "/configuracao/whatsapp/politica", label: "Política da régua", papeis: ADMIN },
  avisosAgenda: { href: "/configuracao/whatsapp/avisos-agenda", label: "Avisos da agenda", papeis: ADMIN },
} satisfies Record<string, SecaoWhatsApp>;

export const ORDEM_SECOES: SecaoWhatsApp[] = [
  SECOES_WHATSAPP.numeros,
  SECOES_WHATSAPP.templates,
  SECOES_WHATSAPP.politica,
  SECOES_WHATSAPP.avisosAgenda,
];

export function secoesParaPapeis(papeis: Papel[]): SecaoWhatsApp[] {
  return ORDEM_SECOES.filter((s) => s.papeis.some((p) => papeis.includes(p)));
}
