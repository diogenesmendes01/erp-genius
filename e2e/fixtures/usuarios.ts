export const PAPEIS = [
  "ADMIN",
  "ADMIN2",
  "GERENTE_COMERCIAL",
  "VENDEDOR",
  "VENDEDOR2",
  "VENDEDOR3",
  "GERENTE_PEDAGOGICO",
  "GERENTE_PEDAGOGICO2",
  "PROFESSOR",
  "PROFESSOR2",
  "FINANCEIRO",
  "FINANCEIRO2",
  "SECRETARIA",
  "VENDEDOR_PROFESSOR",
] as const;

export type PapelE2E = (typeof PAPEIS)[number];

export interface Credenciais {
  email: string;
  senha: string;
}

const EMAIL_PADRAO: Record<PapelE2E, string> = {
  ADMIN: "admin@genius.com",
  ADMIN2: "admin2@genius.com",
  GERENTE_COMERCIAL: "gerente@genius.com",
  VENDEDOR: "joao@genius.com",
  VENDEDOR2: "vendedor2@genius.com",
  VENDEDOR3: "vendedor3@genius.com",
  GERENTE_PEDAGOGICO: "gp@genius.com",
  GERENTE_PEDAGOGICO2: "gp2@genius.com",
  PROFESSOR: "carla@genius.com",
  PROFESSOR2: "professor2@genius.com",
  FINANCEIRO: "financeiro@genius.com",
  FINANCEIRO2: "financeiro2@genius.com",
  SECRETARIA: "secretaria@genius.com",
  VENDEDOR_PROFESSOR: "venprof@genius.com",
};

export function emailDe(papel: PapelE2E): string {
  return process.env[`E2E_EMAIL_${papel}`]?.trim() || EMAIL_PADRAO[papel];
}

export function senhaConfigurada(papel: PapelE2E): boolean {
  return !!process.env[`E2E_PASSWORD_${papel}`];
}

export function credenciaisDe(papel: PapelE2E): Credenciais {
  const email = emailDe(papel);
  const senha = process.env[`E2E_PASSWORD_${papel}`];

  if (!senha) {
    throw new Error(
      `[e2e] Senha do papel ${papel} não definida. Preencha E2E_PASSWORD_${papel} no arquivo ` +
        ".env.e2e (modelo em .env.e2e.example) ou defina no terminal antes de rodar.",
    );
  }

  return { email, senha };
}
