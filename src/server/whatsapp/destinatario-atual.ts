import { type FinalidadeAtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula, type DestinoFinanceiro } from "./destinatario-financeiro";

export function contatoCorrespondeDestinoFinanceiro(
  contato: { telefoneE164: string; responsavelId: string | null },
  destino: DestinoFinanceiro,
) {
  if (contato.telefoneE164 !== destino.telefoneE164) return false;
  if (destino.origem === "PAGADOR_PREPARACAO") return true;
  return contato.responsavelId === destino.responsavelId;
}

export async function destinatarioAtualDoAtendimento(a: {
  finalidade: FinalidadeAtendimentoWhatsApp; leadId: string | null; alunoId: string | null; matriculaId: string | null;
  autorizacaoComunicacaoAcademicaId?: string | null;
  conversa: { contato: { telefoneE164: string; responsavelId: string | null; alunoId?: string | null } };
}, db: Prisma.TransactionClient = prisma): Promise<boolean> {
  const contato = a.conversa.contato;
  if (a.finalidade === "FINANCEIRO") {
    if (!a.matriculaId || !a.alunoId) return false;
    const matricula = await db.matricula.findFirst({ where: { id: a.matriculaId, alunoId: a.alunoId }, include: INCLUDE_MATRICULA_DESTINO });
    const destino = matricula && resolverDestinoFinanceiroDaMatricula(matricula);
    return !!destino && contatoCorrespondeDestinoFinanceiro(contato, destino);
  }
  if (a.leadId) {
    const lead = await db.oportunidade.findUnique({ where: { id: a.leadId }, select: { telefoneE164: true } });
    return !!lead?.telefoneE164 && lead.telefoneE164 === contato.telefoneE164;
  }
  if (a.finalidade === "PEDAGOGICO" && a.alunoId) {
    if (!a.matriculaId) return false;
    if (contato.responsavelId) {
      if (!a.autorizacaoComunicacaoAcademicaId) return false;
      const autorizacao = await db.autorizacaoComunicacaoAcademica.findFirst({
        where: {
          id: a.autorizacaoComunicacaoAcademicaId,
          matriculaId: a.matriculaId,
          responsavelId: contato.responsavelId,
          vigenteEm: { lte: new Date() },
          revogadaEm: null,
          matricula: { alunoId: a.alunoId },
          responsavel: { telefoneE164: contato.telefoneE164, alunos: { some: { alunoId: a.alunoId, papel: "PEDAGOGICO" } } },
        },
        select: { id: true },
      });
      return !!autorizacao;
    }
    if (contato.alunoId !== a.alunoId || a.autorizacaoComunicacaoAcademicaId) return false;
    const matricula = await db.matricula.findFirst({
      where: { id: a.matriculaId, alunoId: a.alunoId },
      select: { aluno: { select: { telefoneE164: true, whatsapp: true } } },
    });
    return !!matricula?.aluno.whatsapp
      && !!matricula.aluno.telefoneE164
      && matricula.aluno.telefoneE164 === contato.telefoneE164;
  }
  if (a.alunoId) {
    const aluno = await db.aluno.findUnique({ where: { id: a.alunoId }, select: { telefoneE164: true,
      responsaveis: { where: { papel: "PEDAGOGICO" },
        select: { responsavelId: true, responsavel: { select: { telefoneE164: true } } } } } });
    if (!aluno) return false;
    if (aluno.responsaveis.length) return aluno.responsaveis.some((r) => r.responsavelId === contato.responsavelId && r.responsavel.telefoneE164 === contato.telefoneE164);
    return !contato.responsavelId && !!aluno.telefoneE164 && aluno.telefoneE164 === contato.telefoneE164;
  }
  return a.finalidade === "COMERCIAL" || a.finalidade === "SECRETARIA";
}
