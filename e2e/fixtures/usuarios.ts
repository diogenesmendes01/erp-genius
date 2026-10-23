// =============================================================================
// Usuários de teste por papel.
//
// Os nomes dos papéis abaixo são os APELIDOS usados no roteiro de QA
// (docs/qa/03-roteiro-testes-manuais.md e docs/qa/02-usuarios-e-papeis.md).
// Cada papel tem um e-mail (com valor padrão do seed, prisma/seed.ts e
// prisma/seed-qa.ts) e uma senha (SEM valor padrão — vem do .env.e2e ou do terminal).
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

/**
 * E-mails padrão criados por prisma/seed.ts e prisma/seed-qa.ts. Todos são usuários
 * de UM papel só, exceto VENDEDOR_PROFESSOR (Vendedor + Professor, usado no AC03 do
 * doc 37: o escopo docente não abre o financeiro comercial).
 * Os segundos usuários (ADMIN2, GERENTE_PEDAGOGICO2, FINANCEIRO2) existem para as
 * decisões que exigem outra pessoa (aprovação independente).
 * Podem ser trocados pelas variáveis E2E_EMAIL_<PAPEL>.
 */
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

/** E-mail do papel (variável E2E_EMAIL_<PAPEL> ou o padrão do seed). Não exige senha. */
export function emailDe(papel: PapelE2E): string {
  return process.env[`E2E_EMAIL_${papel}`]?.trim() || EMAIL_PADRAO[papel];
}

/** A senha do papel foi configurada? (Usado pelo setup para pular papéis sem senha.) */
export function senhaConfigurada(papel: PapelE2E): boolean {
  return !!process.env[`E2E_PASSWORD_${papel}`];
}

/**
 * Devolve e-mail e senha do papel pedido, lidos do ambiente.
 * Lança um erro explicando qual variável falta (em vez de tentar logar com senha vazia).
 */
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
