// =============================================================================
// Usuários de teste por papel.
//
// Cada papel tem um e-mail (com valor padrão do seed de QA, prisma/seed-qa.ts) e
// uma senha (SEM valor padrão — vem do .env.e2e ou do terminal).
//
// As variáveis seguem o padrão:
//   E2E_EMAIL_<PAPEL>     ex.: E2E_EMAIL_PROFESSOR
//   E2E_PASSWORD_<PAPEL>  ex.: E2E_PASSWORD_PROFESSOR
//
// A leitura é "preguiçosa": só acontece quando um teste pede o usuário. Assim,
// `npx playwright test --list` funciona mesmo sem as senhas preenchidas.
// =============================================================================

/** Papéis disponíveis nos testes E2E (nomes usados nas variáveis de ambiente). */
export const PAPEIS = [
  "ADMIN",
  "GERENTE_COMERCIAL",
  "VENDEDOR",
  "VENDEDOR2",
  "VENDEDOR3",
  "GERENTE_PEDAGOGICO",
  "PROFESSOR",
  "PROFESSOR2",
  "FINANCEIRO",
  "SECRETARIA",
] as const;

export type PapelE2E = (typeof PAPEIS)[number];

export interface Credenciais {
  email: string;
  senha: string;
}

/**
 * E-mails padrão (usuários "puros", de um papel só) criados por prisma/seed.ts
 * e prisma/seed-qa.ts. Podem ser trocados pelas variáveis E2E_EMAIL_<PAPEL>.
 */
const EMAIL_PADRAO: Record<PapelE2E, string> = {
  ADMIN: "admin@genius.com",
  GERENTE_COMERCIAL: "gerente@genius.com",
  VENDEDOR: "joao@genius.com",
  VENDEDOR2: "vendedor2@genius.com",
  VENDEDOR3: "vendedor3@genius.com",
  GERENTE_PEDAGOGICO: "gp@genius.com",
  PROFESSOR: "carla@genius.com",
  PROFESSOR2: "professor2@genius.com",
  FINANCEIRO: "financeiro@genius.com",
  SECRETARIA: "secretaria@genius.com",
};

/**
 * Devolve e-mail e senha do papel pedido, lidos do ambiente.
 * Lança um erro explicando qual variável falta (em vez de tentar logar com senha vazia).
 */
export function credenciaisDe(papel: PapelE2E): Credenciais {
  const email = process.env[`E2E_EMAIL_${papel}`]?.trim() || EMAIL_PADRAO[papel];
  const senha = process.env[`E2E_PASSWORD_${papel}`];

  if (!senha) {
    throw new Error(
      `[e2e] Senha do papel ${papel} não definida. Preencha E2E_PASSWORD_${papel} no arquivo ` +
        ".env.e2e (modelo em .env.e2e.example) ou defina no terminal antes de rodar.",
    );
  }

  return { email, senha };
}
