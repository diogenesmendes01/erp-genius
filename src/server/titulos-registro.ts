import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { exigirSessao, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoAlunos } from "@/server/alunos/consultas";

// Título de aba das fichas (docs/42-auditoria-frontend-ux.md, E2): todas as abas se chamavam
// "ERP Genius" — com três fichas abertas, não dava para saber qual era qual. Consultas mínimas (só o
// nome) e com o MESMO escopo da página: quem não pode abrir a ficha não lê o nome pelo título.
// Qualquer falha (sem sessão, sem acesso, inexistente) cai no título genérico — a página decide.

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

const PAPEIS_LEAD: Papel[] = [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR];

export async function tituloLead(id: string): Promise<string> {
  const usuario = await usuarioOuNull();
  if (!usuario || !usuario.papeis.some((p) => PAPEIS_LEAD.includes(p))) return "Lead";
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id }, await escopoComercialAtual(usuario)] }, select: { nome: true } });
  return lead ? `${lead.nome} · Lead` : "Lead";
}

export async function tituloEmpresa(id: string): Promise<string> {
  const usuario = await usuarioOuNull();
  if (!usuario || !usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)) return "Empresa";
  const empresa = await prisma.empresa.findUnique({ where: { id }, select: { nome: true } });
  return empresa ? `${empresa.nome} · Empresa` : "Empresa";
}
