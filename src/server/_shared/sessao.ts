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
 * Exige uma sessão autenticada e retorna o usuário.
 * Use no início de toda Server Action.
 */
export async function exigirSessao(): Promise<UsuarioSessao> {
  // import dinâmico: mantém este módulo (guards/erros puros) testável sem carregar o NextAuth.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new ErroAutenticacao();
  return {
    id: user.id,
    nome: user.name ?? "Usuário",
    papeis: user.papeis ?? [],
  };
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
