import { prisma } from "@/lib/prisma";
import type { FinalidadeAtendimentoWhatsApp, Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos } from "./escopo";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";

export async function garantirAtendimento(tx: Prisma.TransactionClient, dados: {
  numeroId: string; contatoId: string; finalidade: FinalidadeAtendimentoWhatsApp;
  leadId?: string | null; alunoId?: string | null; matriculaId?: string | null; turmaId?: string | null; responsavelId?: string | null;
  autorizacaoComunicacaoAcademicaId?: string | null;
}) {
  if (dados.finalidade === "FINANCEIRO") {
    if (!dados.matriculaId || !dados.alunoId) throw new Error("Atendimento financeiro exige matrícula e aluno.");
  }
  if (dados.matriculaId) {
    if (!dados.alunoId) throw new Error("Atendimento com matrícula exige aluno.");
    const matricula = await tx.matricula.findFirst({ where: { id: dados.matriculaId, alunoId: dados.alunoId }, select: { id: true } });
    if (!matricula) throw new Error("Matrícula não pertence ao aluno do atendimento.");
  }
  const conversa = await tx.conversaWhatsApp.upsert({
    where: { numeroId_contatoId: { numeroId: dados.numeroId, contatoId: dados.contatoId } },
    create: { numeroId: dados.numeroId, contatoId: dados.contatoId }, update: {},
  });
  const contextoChave = [dados.finalidade, dados.leadId ?? "", dados.alunoId ?? "", dados.turmaId ?? "",
    ...(dados.matriculaId ? [dados.matriculaId] : []),
    ...(dados.finalidade === "PEDAGOGICO" && dados.alunoId ? [dados.autorizacaoComunicacaoAcademicaId ?? "ALUNO"] : [])].join(":");
  return tx.atendimentoWhatsApp.upsert({
    where: { conversaId_contextoChave: { conversaId: conversa.id, contextoChave } },
    create: { conversaId: conversa.id, contextoChave, finalidade: dados.finalidade,
      leadId: dados.leadId, alunoId: dados.alunoId, matriculaId: dados.matriculaId, turmaId: dados.turmaId, responsavelId: dados.responsavelId,
      autorizacaoComunicacaoAcademicaId: dados.autorizacaoComunicacaoAcademicaId },
    update: {}, // nunca reabre vínculo encerrado nem muda o proprietário por visita/telefone
  });
}

export async function atendimentoVisivel(usuario: UsuarioSessao, atendimentoId: string, enviar = false) {
  const a = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario, { enviar })] },
    include: { conversa: { include: { numero: true, contato: true } } },
  });
  if (!a || (enviar && !await destinatarioAtualDoAtendimento(a))) return null;
  return { ...a, transporteId: a.conversaId, numeroId: a.conversa.numeroId, contatoId: a.conversa.contatoId,
    numero: a.conversa.numero, contato: a.conversa.contato };
}

/** Não adivinha o assunto quando há mais de um atendimento aberto. O item fica na triagem. */
export async function atendimentoDoInbound(tx: Prisma.TransactionClient, conversaId: string): Promise<string | null> {
  const abertos = await tx.atendimentoWhatsApp.findMany({ where: { conversaId, encerradoEm: null }, include: { conversa: { include: { contato: true } } }, take: 2 });
  if (abertos.length === 1) {
    const aberto = abertos[0];
    // Atendimento financeiro legado continua consultável, mas não recebe inbound automático sem contrato explícito.
    if ((aberto.finalidade === "FINANCEIRO" && !aberto.matriculaId)
      || !await destinatarioAtualDoAtendimento(aberto, tx)) return null;
    return aberto.id;
  }
  if (abertos.length > 1) return null;
  const c = await tx.conversaWhatsApp.findUnique({ where: { id: conversaId }, include: { numero: true, contato: { include: { lead: true } } } });
  if (!c?.numero.ativo) return null;
  if (c.numero.finalidade === "VENDAS" && c.contato.leadId) {
    const atendimento = await garantirAtendimento(tx, { numeroId: c.numeroId, contatoId: c.contatoId, finalidade: "COMERCIAL",
      leadId: c.contato.leadId, responsavelId: c.contato.lead?.vendedorDonoId });
    return atendimento.encerradoEm ? null : atendimento.id;
  }
  if (c.numero.finalidade === "COBRANCA" && c.contato.alunoId) {
    // A identidade não escolhe contrato: só roteia quando existe uma única matrícula possível.
    const matriculas = await tx.matricula.findMany({ where: { alunoId: c.contato.alunoId }, select: { id: true }, take: 2 });
    if (matriculas.length !== 1) return null;
    const atendimento = await garantirAtendimento(tx, { numeroId: c.numeroId, contatoId: c.contatoId,
      finalidade: "FINANCEIRO", alunoId: c.contato.alunoId, matriculaId: matriculas[0].id });
    return atendimento.encerradoEm ? null : atendimento.id;
  }
  return null;
}
