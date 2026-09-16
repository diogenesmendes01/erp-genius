import { type FinalidadeAtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula, type DestinoFinanceiro } from "./destinatario-financeiro";

/**
 * A fotografia de pagador explícita governa aquele contrato, inclusive quando
 * o telefone já existe em um contato associado a outro aluno. No legado, o
 * responsável financeiro continua sendo a identidade estável; o aluno não é,
 * pois irmãos podem compartilhar o mesmo responsável.
 */
export function contatoCorrespondeDestinoFinanceiro(
  contato: { telefoneE164: string; responsavelId: string | null },
  destino: DestinoFinanceiro,
) {
  if (contato.telefoneE164 !== destino.telefoneE164) return false;
  if (destino.origem === "PAGADOR_PREPARACAO") return true;
  return contato.responsavelId === destino.responsavelId;
}

/** O histórico fica no contato original; novo envio exige o destinatário atual da finalidade. */
export async function destinatarioAtualDoAtendimento(a: {
  finalidade: FinalidadeAtendimentoWhatsApp; leadId: string | null; alunoId: string | null; matriculaId: string | null;
  conversa: { contato: { telefoneE164: string; responsavelId: string | null; alunoId?: string | null } };
}, db: Prisma.TransactionClient = prisma): Promise<boolean> {
  const contato = a.conversa.contato;
  if (a.finalidade === "FINANCEIRO") {
    if (!a.matriculaId || !a.alunoId) return false;
    const matricula = await db.matricula.findFirst({ where: { id: a.matriculaId, alunoId: a.alunoId }, include: INCLUDE_MATRICULA_DESTINO });
    const destino = matricula && resolverDestinoFinanceiroDaMatricula(matricula);
    // A origem do pagador também determina quais vínculos globais são lícitos
    // no Contato. Empresa/responsável explícitos nunca herdam aluno/responsável
    // do cadastro geral só porque usam o mesmo telefone.
    return !!destino && contatoCorrespondeDestinoFinanceiro(contato, destino);
  }
  if (a.leadId) {
    const lead = await db.lead.findUnique({ where: { id: a.leadId }, select: { telefoneE164: true } });
    return !!lead?.telefoneE164 && lead.telefoneE164 === contato.telefoneE164;
  }
  if (a.alunoId) {
    const aluno = await db.aluno.findUnique({ where: { id: a.alunoId }, select: { telefoneE164: true,
      responsaveis: { where: { papel: "PEDAGOGICO" },
        select: { responsavelId: true, responsavel: { select: { telefoneE164: true } } } } } });
    if (!aluno) return false;
    if (aluno.responsaveis.length) return aluno.responsaveis.some((r) => r.responsavelId === contato.responsavelId && r.responsavel.telefoneE164 === contato.telefoneE164);
    return !contato.responsavelId && !!aluno.telefoneE164 && aluno.telefoneE164 === contato.telefoneE164;
  }
  // Um atendimento comercial de triagem pode existir antes de virar lead.
  return a.finalidade === "COMERCIAL";
}
