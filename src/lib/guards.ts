import { Papel } from "@prisma/client";

// Guards server-side por papel para Server Components (page.tsx).
// Diferente dos guards de Server Action (src/server/_shared/sessao.ts), estes rodam na
// RENDERIZAÇÃO da página: barram a LEITURA de dados sensíveis ANTES de buscar/renderizar.
// Regra inegociável (docs/13 §"Regras inegociáveis"): permissão é verificada no servidor —
// o menu role-aware (nav.ts) é só UX, não segurança.

/** Papéis da sessão atual (vazio se não autenticado). Admin é tratado pelos helpers abaixo. */
export async function papeisDaSessao(): Promise<Papel[]> {
  // import dinâmico: mantém papeisTem() (regra pura) testável sem carregar o NextAuth
  // (mesmo padrão de src/server/_shared/sessao.ts).
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  return (session?.user?.papeis ?? []) as Papel[];
}

/** O conjunto de papéis tem pelo menos um dos alvos? (Administrador sempre passa.) */
export function papeisTem(papeis: Papel[], ...alvo: Papel[]): boolean {
  if (papeis.includes(Papel.ADMINISTRADOR)) return true;
  return papeis.some((p) => alvo.includes(p));
}

/**
 * Exige que a sessão atual tenha um dos papéis informados para LER a página.
 * Retorna os papéis quando autorizado; `null` quando não — a page renderiza <AcessoNegado/>
 * em vez de buscar dados (evita vazamento acidental / "dados vazios").
 */
export async function exigirPapelLeitura(...alvo: Papel[]): Promise<Papel[] | null> {
  const papeis = await papeisDaSessao();
  return papeisTem(papeis, ...alvo) ? papeis : null;
}
