import { Papel } from "@prisma/client";

// Configuração do WhatsApp por rota (docs/42-auditoria-frontend-ux.md, E8): a página única fazia 9
// consultas em paralelo e empilhava 6 painéis — quem ia ajustar a saudação pagava por números,
// templates e política. Agora cada seção é uma rota com as próprias consultas e o próprio guard.
// - Canal (número/QR, templates, política da régua, avisos da agenda): só o ADMINISTRADOR (D21).
// - O Gerente Comercial não tem seção de configuração desde a E1.

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
