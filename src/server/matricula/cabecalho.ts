import { Papel, type Prisma, type StatusMatricula } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoMatriculaComercial } from "@/server/financeiro/acesso";

// Cabeçalho de registro das telas /matriculas/[id]/* (E2): código · aluno · estado · produto.
// Consulta leve (um findFirst com select), feita uma vez pelo layout. Mesmo alcance das páginas:
// Secretaria, Financeiro e Gerência pedagógica leem sem filtro de carteira (como já fazem as
// seções delas); Vendedor e Gerente comercial só dentro da própria carteira; demais papéis, nada.

export type CabecalhoMatricula = {
  id: string;
  codigo: string | null;
  status: StatusMatricula;
  alunoId: string;
  aluno: string;
  produto: string;
};

const SEM_FILTRO: Papel[] = [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO];

export async function consultarCabecalhoMatricula(usuario: UsuarioSessao, matriculaId: string): Promise<CabecalhoMatricula | null> {
  if (!matriculaId.trim()) return null;
  const escopo: Prisma.MatriculaWhereInput = usuario.papeis.some((p) => SEM_FILTRO.includes(p)) ? {} : await escopoMatriculaComercial(usuario);
  const m = await prisma.matricula.findFirst({
    where: { AND: [{ id: matriculaId }, escopo] },
    select: {
      id: true, codigo: true, status: true, alunoId: true,
      aluno: { select: { primeiroNome: true, sobrenome: true } },
      produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } },
    },
  });
  if (!m) return null;
  return {
    id: m.id,
    codigo: m.codigo,
    status: m.status,
    alunoId: m.alunoId,
    aluno: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" "),
    produto: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}`,
  };
}
