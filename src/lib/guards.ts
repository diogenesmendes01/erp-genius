import { Papel } from "@prisma/client";
import { memoPorRequisicao } from "@/server/_shared/memo-requisicao";

// Guards server-side por papel para Server Components (page.tsx).
// Diferente dos guards de Server Action (src/server/_shared/sessao.ts), estes rodam na
// RENDERIZAÇÃO da página: barram a LEITURA de dados sensíveis ANTES de buscar/renderizar.
// Regra inegociável (docs/13 §"Regras inegociáveis"): permissão é verificada no servidor —
// o menu role-aware (nav.ts) é só UX, não segurança.

/**
 * Papéis da sessão atual (vazio se não autenticado). Admin é tratado pelos helpers abaixo.
 * Papéis FRESCOS do banco — nunca do JWT (mesma regra de `_shared/sessao.ts`): papel
 * revogado ou usuário desativado perde a leitura AGORA, não no próximo login.
 *
 * Memoizado por requisição (ganho rápido 15): várias leituras na mesma renderização viram uma.
 */
export const papeisDaSessao = memoPorRequisicao(async (): Promise<Papel[]> => {
  // imports dinâmicos: mantém papeisTem() (regra pura) testável sem carregar NextAuth/Prisma
  // (mesmo padrão de src/server/_shared/sessao.ts).
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return [];
  // O mesmo memo de usuário de exigirSessao/exigirSessaoPagina: uma leitura por requisição na árvore
  // inteira, mesmo quando a página usa os dois guards. Inativo ou inexistente → sem papéis.
  const { carregarUsuarioFresco } = await import("@/server/_shared/sessao");
  return (await carregarUsuarioFresco(id))?.papeis ?? [];
});

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
