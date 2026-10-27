import { Papel } from "@prisma/client";
import { CABECALHO_CAMINHO, enderecoDoLogin } from "@/lib/destino-interno";
import { congelar, memoPorRequisicao } from "./memo-requisicao";

export interface UsuarioSessao {
  id: string;
  nome: string;
  papeis: Papel[];
  permissoes?: string[];
}

export function temPermissao(usuario: UsuarioSessao, capacidade: string): boolean {
  return (usuario.permissoes ?? []).includes(capacidade);
}

export class ErroAutenticacao extends Error {
  constructor(mensagem = "Não autenticado.") {
    super(mensagem);
    this.name = "ErroAutenticacao";
  }
}

export class ErroPermissao extends Error {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super(mensagem);
    this.name = "ErroPermissao";
  }
}

export class ErroRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRegra";
  }
}

export const carregarUsuarioFresco = memoPorRequisicao(async (id: string): Promise<UsuarioSessao | null> => {
  const { prisma } = await import("@/lib/prisma");
  const atual = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true, papeis: true, ativo: true, permissoes: true },
  });
  if (!atual || !atual.ativo) return null;
  return congelar({ id, nome: atual.nome, papeis: atual.papeis, permissoes: atual.permissoes });
});

export function apenasPortal(usuario: UsuarioSessao): boolean {
  return usuario.papeis.length > 0 && usuario.papeis.every((p) => p === Papel.ALUNO);
}

export async function exigirSessao(): Promise<UsuarioSessao> {
  return (await exigirSessaoComPrazo()).usuario;
}

export { prazoDoToken } from "@/lib/prazo-sessao";

export async function exigirSessaoComPrazo(): Promise<{ usuario: UsuarioSessao; expiraEm: number | null }> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new ErroAutenticacao();
  const usuario = await carregarUsuarioFresco(user.id);
  if (!usuario) throw new ErroAutenticacao();
  if (apenasPortal(usuario)) throw new ErroPermissao("Acesso restrito ao portal do aluno.");
  const expiraEm = typeof session?.expiraEm === "number" && Number.isFinite(session.expiraEm) ? session.expiraEm : null;
  return { usuario, expiraEm };
}

export function temPapel(usuario: UsuarioSessao, ...alvo: Papel[]): boolean {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  return usuario.papeis.some((p) => alvo.includes(p));
}

export function exigirPapel(usuario: UsuarioSessao, ...alvo: Papel[]): void {
  if (!temPapel(usuario, ...alvo)) throw new ErroPermissao();
}

export async function exigirSessaoComPapel(...alvo: Papel[]): Promise<UsuarioSessao> {
  const usuario = await exigirSessao();
  exigirPapel(usuario, ...alvo);
  return usuario;
}

async function loginComVolta(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return enderecoDoLogin((await headers()).get(CABECALHO_CAMINHO));
  } catch (e) {
    if (e && typeof e === "object" && (e as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE") throw e;
    return "/login";
  }
}

export async function exigirSessaoPagina(...alvo: Papel[]): Promise<UsuarioSessao> {
  const { auth } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect(await loginComVolta());
    throw new ErroAutenticacao();
  }
  const usuario = await carregarUsuarioFresco(user.id);
  if (!usuario) {
    redirect(await loginComVolta());
    throw new ErroAutenticacao();
  }
  if (apenasPortal(usuario)) {
    if (!alvo.includes(Papel.ALUNO)) redirect("/portal");
    return usuario;
  }
  if (alvo.length > 0 && !temPapel(usuario, ...alvo)) redirect("/acesso-negado");
  return usuario;
}
