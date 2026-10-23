// Substitui "@/lib/auth" só nos seeds de QA (via prisma/tsconfig.seed-qa.json): a sessão é o usuário
// definido pelo seed em globalThis.__qaSessao. Nunca é importado pela aplicação.
declare global { var __qaSessao: string | undefined } // eslint-disable-line no-var
export async function auth() { return globalThis.__qaSessao ? { user: { id: globalThis.__qaSessao } } : null; }
export const signIn = async () => { throw new Error("Indisponível no seed de QA"); };
export const signOut = signIn;
export const handlers = {};
