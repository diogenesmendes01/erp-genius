import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { SETOR_ATENDIMENTO_LABEL } from "@/lib/labels";
import { nomeDoAtendimento } from "./nome-contato";
import type { Setor } from "./setor";

// ALERTA DE PRAZO ESTOURADO (SLA, P5 da Task 39). Só dentro do app: NotificacaoUsuario no sino + o
// `atendimento.atualizado` que o trigger notificar_inbox emite no UPDATE do claim (SSE do Inbox).
// Nada de WhatsApp nem e-mail; não confundir com o "alerta de SLA" da régua de gestão (cron-gestao).

/** Só estouros das últimas 24 h alertam: ligar os alertas com fila antiga não inunda o sino (D8). */
export const JANELA_ALERTA_SLA_MS = 24 * 60 * 60_000;

/** Gerente de cada setor. Financeiro e Secretaria não têm papel de gerente: vai ao Administrador (D4). */
export const GERENTE_DO_SETOR: Readonly<Record<Setor, readonly Papel[]>> = Object.freeze({
  COMERCIAL: [Papel.GERENTE_COMERCIAL],
  PEDAGOGICO: [Papel.GERENTE_PEDAGOGICO],
  FINANCEIRO: [Papel.ADMINISTRADOR],
  SECRETARIA: [Papel.ADMINISTRADOR],
});

/**
 * Quem recebe o alerta (D3–D5), sem repetição. Responsável, se `alertarResponsavel`; sem responsável, o
 * aviso vai ao gerente do setor (ou aos administradores, se o setor não tiver gerente ativo). Gerentes,
 * se `alertarGerente` (mesmo fallback). Participantes do rodízio não recebem.
 */
export function destinatariosAlertaSla(i: {
  responsavelId: string | null; alertarResponsavel: boolean; alertarGerente: boolean; gerentesIds: string[]; adminsIds: string[];
}): string[] {
  const gerentes = i.gerentesIds.length ? i.gerentesIds : i.adminsIds;
  const out: string[] = [];
  if (i.alertarResponsavel) out.push(...(i.responsavelId ? [i.responsavelId] : gerentes));
  if (i.alertarGerente) out.push(...gerentes);
  return [...new Set(out)];
}

type Reclamado = { id: string; finalidade: Setor; responsavelId: string | null; prazoRespostaEm: Date };

/**
 * Claim atômico (`slaAlertadoEm` nulo → agora, como em rodarLembretesTarefas): uma notificação por
 * destinatário e um `SlaEstouradoAlertado` por atendimento, uma única vez (D3), na mesma transação.
 * O atendimento é marcado mesmo sem destinatário (alertas desligados): não volta a ser avaliado.
 * Não alerta: respondido, encerrado, grupo, estouro fora da janela, ou a Aria já respondeu no prazo (D6).
 */
export async function rodarAlertasSla(agora: Date): Promise<{ alertados: number; notificacoes: number }> {
  const desde = new Date(agora.getTime() - JANELA_ALERTA_SLA_MS);
  return prisma.$transaction(async (tx) => {
    const reclamados = await tx.$queryRaw<Reclamado[]>`
      UPDATE "AtendimentoWhatsApp" a SET "slaAlertadoEm" = ${agora}
      FROM "ConversaWhatsApp" c
      WHERE c.id = a."conversaId" AND c."grupoId" IS NULL
        AND a.status <> 'ENCERRADO' AND a."primeiraRespostaEm" IS NULL AND a."slaAlertadoEm" IS NULL
        AND a."prazoRespostaEm" <= ${agora} AND a."prazoRespostaEm" > ${desde}
        AND NOT EXISTS (
          SELECT 1 FROM "MensagemWhatsApp" m
          WHERE m."atendimentoId" = a.id AND m.direcao = 'SAIDA' AND m.origem = 'IA'
            AND m.status IN ('ENVIADA', 'ENTREGUE', 'LIDA') AND m."criadoEm" <= a."prazoRespostaEm")
      RETURNING a.id, a.finalidade::text AS finalidade, a."responsavelId", a."prazoRespostaEm"`;
    if (!reclamados.length) return { alertados: 0, notificacoes: 0 };

    const contexto = await carregarContexto(tx, reclamados);
    let notificacoes = 0;
    for (const r of reclamados) {
      const cfg = contexto.config.get(r.finalidade);
      const responsavelAtivo = r.responsavelId && contexto.ativos.has(r.responsavelId) ? r.responsavelId : null;
      const destinatarios = destinatariosAlertaSla({
        responsavelId: responsavelAtivo,
        alertarResponsavel: cfg?.alertarResponsavel ?? true,
        alertarGerente: cfg?.alertarGerente ?? false,
        gerentesIds: contexto.comPapel(GERENTE_DO_SETOR[r.finalidade]),
        adminsIds: contexto.comPapel([Papel.ADMINISTRADOR]),
      });
      const titulo = `Prazo estourado: ${contexto.nomes.get(r.id) ?? "atendimento"} (${SETOR_ATENDIMENTO_LABEL[r.finalidade]})`;
      for (const usuarioId of destinatarios) {
        await tx.notificacaoUsuario.create({ data: { usuarioId, tipo: "SLA_ESTOURADO", refTipo: "AtendimentoWhatsApp", refId: r.id, titulo } });
      }
      notificacoes += destinatarios.length;
      await registrarEvento(tx, {
        tipo: "SlaEstouradoAlertado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: r.id, autorId: null,
        payload: { finalidade: r.finalidade, prazoRespostaEm: r.prazoRespostaEm.toISOString(), responsavelId: r.responsavelId, destinatarios },
      });
    }
    return { alertados: reclamados.length, notificacoes };
  });
}

async function carregarContexto(tx: Prisma.TransactionClient, reclamados: Reclamado[]) {
  const [configs, usuarios, atendimentos] = await Promise.all([
    tx.prazoRespostaSetor.findMany({ select: { finalidade: true, alertarResponsavel: true, alertarGerente: true } }),
    tx.usuario.findMany({ where: { ativo: true }, select: { id: true, papeis: true }, orderBy: { id: "asc" } }),
    tx.atendimentoWhatsApp.findMany({
      where: { id: { in: reclamados.map((r) => r.id) } },
      select: {
        id: true, finalidade: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } },
        lead: { select: { nome: true } },
        conversa: { select: { contato: { select: { nomeExibicao: true, nomePerfil: true, telefoneE164: true, responsavel: { select: { nome: true } } } } } },
      },
    }),
  ]);
  const nomes = new Map<string, string>();
  for (const a of atendimentos) if (a.conversa.contato) nomes.set(a.id, nomeDoAtendimento({ ...a, conversa: { contato: a.conversa.contato } }));
  return {
    config: new Map(configs.map((c) => [c.finalidade as Setor, c])),
    ativos: new Set(usuarios.map((u) => u.id)),
    comPapel: (papeis: readonly Papel[]) => usuarios.filter((u) => u.papeis.some((p) => papeis.includes(p))).map((u) => u.id),
    nomes,
  };
}
