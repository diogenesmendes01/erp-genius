import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { exigirSessao, type UsuarioSessao } from "@/server/_shared";
import { escopoAlunos } from "@/server/alunos/consultas";
import { PAPEIS_FICHA_EMPRESA } from "@/server/empresas/papeis";
import { papeisTem } from "@/lib/guards";

async function usuarioOuNull(): Promise<UsuarioSessao | null> {
  try {
    return await exigirSessao();
  } catch {
    return null;
  }
}

export async function tituloAluno(id: string): Promise<string> {
  const usuario = await usuarioOuNull();
  if (!usuario) return "Aluno";
  const aluno = await prisma.aluno.findFirst({ where: { AND: [{ id }, escopoAlunos(usuario)] }, select: { primeiroNome: true, sobrenome: true } });
  return aluno ? `${nomeCompleto(aluno)} · Aluno` : "Aluno";
}

export async function tituloEmpresa(id: string): Promise<string> {
  const usuario = await usuarioOuNull();
  if (!usuario || !papeisTem(usuario.papeis, ...PAPEIS_FICHA_EMPRESA)) return "Empresa";
  const empresa = await prisma.empresa.findUnique({ where: { id }, select: { nome: true } });
  return empresa ? `${empresa.nome} · Empresa` : "Empresa";
}
