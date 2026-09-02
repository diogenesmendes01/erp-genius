import { Papel } from "@prisma/client";

// Guards de Server Action (ver docs/13 §"Padrão de Server Action" e §"Regras inegociáveis").
// Permissão SEMPRE verificada no servidor — o menu role-aware é só UX, não segurança.

/** Usuário autenticado, com o que as ações precisam (id + papéis). */
export interface UsuarioSessao {
  id: string;
  nome: string;
  papeis: Papel[];
}

/** Lançado quando não há sessão válida. */
export class ErroAutenticacao extends Error {
  constructor(mensagem = "Não autenticado.") {
    super(mensagem);
    this.name = "ErroAutenticacao";
  }
}

/** Lançado quando o usuário não tem o papel exigido. */
export class ErroPermissao extends Error {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super(mensagem);
    this.name = "ErroPermissao";
  }
}

/** Lançado quando uma regra de negócio é violada (mensagem segura para exibir). */
export class ErroRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRegra";
  }
}

/**
 * Papéis/estado FRESCOS do banco — nunca do JWT. O token carrega os papéis do momento
 * do login; sem esta releitura, revogar um papel ou desativar um usuário só valeria no
 * próximo login (risco apontado no doc 16 §limitações). Custo: 1 query por ação/página.
 * Retorna null quando o usuário não existe mais ou foi desativado (sessão inválida).
 */
async function carregarUsuarioFresco(id: string): Promise<UsuarioSessao | null> {
  // import dinâmico: mantém este módulo (guards/erros puros) testável sem carregar o Prisma.
  const { prisma } = await import("@/lib/prisma");
  const atual = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true, papeis: true, ativo: true },
  });
  if (!atual || !atual.ativo) return null;
  return { id, nome: atual.nome, papeis: atual.papeis };
}

/**
 * Usuário EXCLUSIVO do portal (review PR #60): o papel ALUNO existe só para o /portal.
 * Quem tem apenas ALUNO não opera NENHUMA tela ou ação interna — a barreira é fail-closed
 * aqui no núcleo (toda página passa por exigirSessaoPagina/exigirPapelLeitura e toda ação
 * por exigirSessao), não espalhada por tela.
 */
export function apenasPortal(usuario: UsuarioSessao): boolean {
  return usuario.papeis.length > 0 && usuario.papeis.every((p) => p === Papel.ALUNO);
}

/**
 * Exige uma sessão autenticada e retorna o usuário (papéis frescos do banco).
 * Use no início de toda Server Action.
 * Usuário só-portal (papel ALUNO) é NEGADO: nenhuma Server Action interna é dele — o
 * portal é leitura via página própria (review PR #60).
 */
export async function exigirSessao(): Promise<UsuarioSessao> {
  // import dinâmico: mantém este módulo (guards/erros puros) testável sem carregar o NextAuth.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new ErroAutenticacao();
  const usuario = await carregarUsuarioFresco(user.id);
  if (!usuario) throw new ErroAutenticacao();
  if (apenasPortal(usuario)) throw new ErroPermissao("Acesso restrito ao portal do aluno.");
  return usuario;
}

/** O usuário tem pelo menos um dos papéis informados? (Admin sempre passa.) */
export function temPapel(usuario: UsuarioSessao, ...alvo: Papel[]): boolean {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  return usuario.papeis.some((p) => alvo.includes(p));
}

/**
 * Exige que o usuário tenha um dos papéis informados; senão lança ErroPermissao.
 * Administrador passa em qualquer verificação.
 */
export function exigirPapel(usuario: UsuarioSessao, ...alvo: Papel[]): void {
  if (!temPapel(usuario, ...alvo)) throw new ErroPermissao();
}

/** Atalho: exige sessão E papel numa só chamada. Retorna o usuário. */
export async function exigirSessaoComPapel(...alvo: Papel[]): Promise<UsuarioSessao> {
  const usuario = await exigirSessao();
  exigirPapel(usuario, ...alvo);
  return usuario;
}

/**
 * Guard de PÁGINA (Server Component). Diferente das Server Actions (que lançam e
 * devolvem {ok:false}), aqui bloqueamos a renderização ANTES de qualquer consulta:
 * sem sessão → /login; sem papel → /acesso-negado. Retorna o usuário para reuso
 * (id/papéis no escopo row-level). Permissão SEMPRE no servidor — menu é só UX.
 */
export async function exigirSessaoPagina(...alvo: Papel[]): Promise<UsuarioSessao> {
  // imports dinâmicos: mantém o módulo (guards/erros puros) testável sem Next/NextAuth.
  const { auth } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect("/login");
    throw new ErroAutenticacao(); // inalcançável: redirect lança NEXT_REDIRECT.
  }
  // Papéis frescos do banco (mesma razão de exigirSessao): usuário desativado ou com
  // papel revogado cai AGORA, não no próximo login.
  const usuario = await carregarUsuarioFresco(user.id);
  if (!usuario) {
    redirect("/login");
    throw new ErroAutenticacao(); // inalcançável: redirect lança NEXT_REDIRECT.
  }
  // Usuário só-portal (review PR #60): a única página dele é o /portal — qualquer outra
  // rota interna redireciona para lá (fail-closed; a UX de "só tenho portal" é o portal).
  if (apenasPortal(usuario)) {
    if (!alvo.includes(Papel.ALUNO)) redirect("/portal");
    return usuario;
  }
  if (alvo.length > 0 && !temPapel(usuario, ...alvo)) redirect("/acesso-negado");
  return usuario;
}
