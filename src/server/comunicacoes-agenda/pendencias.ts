import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { MotivoPendenciaAvisoAgenda, Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";

export const motivosPendenciaAvisoAgenda = [
  MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO,
  MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL,
  MotivoPendenciaAvisoAgenda.CONTATO_SEM_OPT_IN,
  MotivoPendenciaAvisoAgenda.CONTATO_INDISPONIVEL,
] as const;

type EntradaPendencia = { eventoId: string; matriculaId: string; motivo: MotivoPendenciaAvisoAgenda };
const hashContato = (valor: string) => createHash("sha256").update(valor).digest("hex");
const ReconferirSchema = z.object({ pendenciaId: z.string().trim().min(1), motivo: z.string().trim().min(5).max(2_000) }).strict();

/** Registra uma falha operacional visível sem criar intenção, tentativa ou transporte. */
export async function registrarPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: EntradaPendencia) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${entrada.eventoId}:${entrada.matriculaId}:${entrada.motivo}`}, 0))`;
  const existente = await tx.pendenciaAvisoAgenda.findFirst({
    where: { eventoId: entrada.eventoId, matriculaId: entrada.matriculaId, motivo: entrada.motivo, situacao: "PENDENTE" },
    select: { id: true },
  });
  if (existente) return { id: existente.id, criada: false };
  const criada = await tx.pendenciaAvisoAgenda.create({ data: { id: randomUUID(), ...entrada }, select: { id: true } });
  return { id: criada.id, criada: true };
}

/** Só o fluxo que confirmou a condição corrigida deve encerrar a pendência; não reabre transporte. */
export async function resolverPendenciaAvisoAgendaTx(tx: Prisma.TransactionClient, entrada: { id: string; resolvidaPorId: string; observacaoResolucao: string }) {
  const autor = await tx.usuario.findFirst({ where: { id: entrada.resolvidaPorId, ativo: true, papeis: { hasSome: ["ADMINISTRADOR", "SECRETARIA_ACADEMICA"] } }, select: { id: true } });
  if (!autor) throw new Error("Resolutor sem papel atual.");
  const observacao = entrada.observacaoResolucao.trim();
  if (observacao.length < 5 || observacao.length > 2_000) throw new Error("Observação de resolução inválida.");
  const atual = await tx.pendenciaAvisoAgenda.findUnique({ where: { id: entrada.id }, select: { situacao: true, resolvidaPorId: true, observacaoResolucao: true } });
  if (!atual) return false;
  if (atual.situacao === "RESOLVIDA") return atual.resolvidaPorId === entrada.resolvidaPorId && atual.observacaoResolucao === observacao;
  await tx.pendenciaAvisoAgenda.update({ where: { id: entrada.id }, data: { situacao: "RESOLVIDA", resolvidaEm: new Date(), resolvidaPorId: entrada.resolvidaPorId, observacaoResolucao: observacao } });
  return true;
}

function encontrosDoEvento(payload: unknown) {
  const p = payload as { encontrosIds?: unknown; encontroOriginalId?: unknown; encontroNovoId?: unknown };
  if (Array.isArray(p.encontrosIds) && p.encontrosIds.every((id) => typeof id === "string" && id)) return [...new Set(p.encontrosIds)];
  const ids = [p.encontroOriginalId, p.encontroNovoId].filter((id): id is string => typeof id === "string" && !!id);
  return [...new Set(ids)];
}

/** Reconferência explícita: prepara apenas a intenção válida e nunca toca no driver. */
export async function reconferirPendenciaAvisoAgenda(input: unknown): Promise<Resultado<{ resolvida: boolean; explicacao: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const entrada = ReconferirSchema.parse(input);
    return prisma.$transaction(confirmarTransacao(async (tx) => {
      const pendencia = await tx.pendenciaAvisoAgenda.findUnique({ where: { id: entrada.pendenciaId }, include: { evento: true } });
      if (!pendencia) return { resolvida: false, explicacao: "Pendência não encontrada." };
      if (pendencia.situacao === "RESOLVIDA") return { resolvida: true, explicacao: "Pendência já encerrada por reconferência anterior." };
      const usuario = await tx.usuario.findFirst({ where: { id: autor.id, ativo: true, papeis: { hasSome: [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR] } }, select: { id: true } });
      if (!usuario) return { resolvida: false, explicacao: "Seu papel atual não permite reconferir esta pendência." };
      const encontrosIds = encontrosDoEvento(pendencia.evento.payload);
      if (!encontrosIds.length) return { resolvida: false, explicacao: "A origem aplicada não possui encontros reconferíveis." };
      const existentes = await tx.avisoAlteracaoAgenda.findMany({ where: { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId }, include: { aluno: true, itens: true } });
      if (existentes.some((aviso) => aviso.situacao === "INCERTO")) return { resolvida: false, explicacao: "Existe aviso com resultado incerto; a reconferência não o reemite." };
      const { criarAvisosAlteracaoAgendaTx } = await import("./avisos");
      await criarAvisosAlteracaoAgendaTx(tx, { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId, encontrosIds });
      const avisos = await tx.avisoAlteracaoAgenda.findMany({ where: { eventoId: pendencia.eventoId, matriculaId: pendencia.matriculaId }, include: { aluno: true, itens: true } });
      if (!avisos.length) return { resolvida: false, explicacao: "A matrícula ainda não possui destinatário acadêmico elegível." };
      const destinosAtuais = avisos.every((aviso) => {
        if (!aviso.aluno.aceitaComunicacoes) return false;
        if (aviso.canal === "EMAIL") return !!aviso.aluno.email && hashContato(aviso.aluno.email.trim().toLowerCase()) === aviso.contatoHash;
        return aviso.destinatarioAlunoId === aviso.alunoId && aviso.aluno.whatsapp && !!aviso.aluno.telefoneE164 && hashContato(aviso.aluno.telefoneE164) === aviso.contatoHash;
      });
      if (!destinosAtuais) return { resolvida: false, explicacao: "Há destinatário congelado sem consentimento ou contato atual; nenhuma intenção foi reemitida." };
      if (pendencia.motivo === MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL && avisos.some((aviso) => aviso.canal === "WHATSAPP")) {
        const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, include: { numeroAvisosAgenda: true, templateAvisosAgenda: true } });
        const numero = configuracao?.numeroAvisosAgenda, template = configuracao?.templateAvisosAgenda;
        if (!configuracao?.numeroAvisosAgendaId || !configuracao.templateAvisosAgendaId || !numero?.ativo || numero.finalidade !== "AGENDA" || numero.driver !== "META_CLOUD" || !numero.providerRef?.trim() || template?.statusMeta !== "APROVADO" || template.categoria !== "utility" || !template.metaTemplateId || !template.corpo.includes("{horarios}")) return { resolvida: false, explicacao: "A configuração institucional de WhatsApp continua indisponível." };
      }
      const resolvida = await resolverPendenciaAvisoAgendaTx(tx, { id: pendencia.id, resolvidaPorId: autor.id, observacaoResolucao: entrada.motivo });
      return resolvida ? { resolvida: true, explicacao: "Condição reconferida; a pendência foi encerrada sem envio." } : { resolvida: false, explicacao: "Não foi possível encerrar a pendência." };
    }));
  });
}
