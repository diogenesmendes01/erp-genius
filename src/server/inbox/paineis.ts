import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { temPapel, type UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { cobrancaAtivaDoAtendimento, podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";

export type PainelSetor =
  | { setor: "COMERCIAL"; oportunidade: { id: string; titulo: string; etapa: string; valor: string | null } | null; pessoaId: string | null }
  | { setor: "FINANCEIRO"; matriculaCodigo: string | null; cobrancas: { id: string; vencimento: string; valor: string; status: string }[] }
  | { setor: "SECRETARIA"; matriculaCodigo: string | null; documentosPendentes: number }
  | { setor: "PEDAGOGICO"; turma: string | null; frequenciaPct: number | null };

/** Categorias que a Secretaria espera ver arquivadas na matrícula (não arquivadas) para considerá-la documentada. */
const CATEGORIAS_EXIGIDAS = ["CONTRATO", "COMPROVANTE"] as const;

/**
 * Painel lateral do setor do atendimento (Tarefa 32). Só leitura. null fora do escopo do usuário
 * (participante convidado entra no escopo; o conteúdo sensível do setor segue filtrado por papel).
 */
export async function carregarPainel(u: UsuarioSessao, atendimentoId: string): Promise<PainelSetor | null> {
  const a = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u)] },
    include: {
      matricula: { select: { id: true, codigo: true } },
      turma: { select: { id: true, codigo: true, nome: true } },
      conversa: { select: { contatoId: true } },
      lead: { select: { id: true, nome: true, etapa: true, valorPrevisto: true, pessoaId: true, pessoa: { select: { responsavel: { select: { id: true } } } } } },
    },
  });
  if (!a) return null;

  switch (a.finalidade) {
    case "COMERCIAL": {
      const ver = !!a.lead && await podeVerLeadNaThread(u, a.id, a.lead.id, Date.now());
      if (!ver || !a.lead) return { setor: "COMERCIAL", oportunidade: null, pessoaId: null };
      return { setor: "COMERCIAL",
        oportunidade: { id: a.lead.id, titulo: a.lead.nome, etapa: a.lead.etapa, valor: a.lead.valorPrevisto?.toString() ?? null },
        // Regra 6: o responsável legal não é a pessoa comercial.
        pessoaId: a.lead.pessoa?.responsavel ? null : a.lead.pessoaId };
    }
    case "FINANCEIRO": {
      const autorizado = temPapel(u, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
      const { alunoId, matriculaId } = a, contatoId = a.conversa.contatoId;
      const ativa = autorizado && alunoId && matriculaId && contatoId
        ? await cobrancaAtivaDoAtendimento(matriculaId, alunoId, contatoId) : null;
      return { setor: "FINANCEIRO", matriculaCodigo: autorizado ? a.matricula?.codigo ?? null : null,
        cobrancas: ativa ? [{ id: ativa.id,
          vencimento: ativa.vencimento.estado === "CONFIRMADO" ? ativa.vencimento.dataCivil : "A conferir",
          valor: ativa.saldo.toFixed(2), status: ativa.status }] : [] };
    }
    case "SECRETARIA": {
      let pendentes = 0;
      if (a.matriculaId) {
        const presentes = await prisma.documento.findMany({ where: { matriculaId: a.matriculaId, arquivado: false, categoria: { in: [...CATEGORIAS_EXIGIDAS] } }, select: { categoria: true } });
        const tem = new Set(presentes.map((d) => d.categoria));
        pendentes = CATEGORIAS_EXIGIDAS.filter((c) => !tem.has(c)).length;
      }
      return { setor: "SECRETARIA", matriculaCodigo: a.matricula?.codigo ?? null, documentosPendentes: pendentes };
    }
    case "PEDAGOGICO": {
      let pct: number | null = null;
      if (a.turmaId && a.alunoId) {
        const regs = await prisma.registroAulaAluno.findMany({
          where: { alunoId: a.alunoId, presente: { not: null }, aula: { turmaId: a.turmaId } }, select: { presente: true } });
        if (regs.length) pct = Math.round((regs.filter((r) => r.presente).length / regs.length) * 100);
      }
      return { setor: "PEDAGOGICO", turma: a.turma ? a.turma.nome ?? a.turma.codigo : null, frequenciaPct: pct };
    }
  }
}
