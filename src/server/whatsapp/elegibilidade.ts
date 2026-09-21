import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHAVE_LEAD_NOVO, CHAVE_NO_SHOW, CHAVE_PRE_EXPERIMENTAL } from "@/server/comercial/regua-fabrica";
import { INCLUDE_DESTINO, resolverDestinoCobranca, type DestinoCobranca } from "./identidade";

/** Falha incerta não é reaberta pelo cron nem pelo botão que apenas reenfileira um degrau. */
export function podeReabrirIntencao(status: string, motivo: string | null): boolean {
  if (["PENDENTE", "ENVIANDO", "DESPACHADA", "ADIADA", "FALHOU"].includes(status)) return false;
  return motivo !== "envio_interrompido" && motivo !== "resultado_incerto" && motivo !== "revisado_sem_reenvio";
}

export async function reagendamentoPendente(leadId: string, ocorrencia: string): Promise<boolean> {
  return (await prisma.evento.count({
    where: {
      agregadoTipo: "Lead", agregadoId: leadId, tipo: "ExperimentalReagendamentoSolicitado",
      payload: { path: ["ocorrencia"], equals: ocorrencia },
    },
  })) > 0;
}

/** Regras de domínio reavaliadas no envio, inclusive após um adiamento. */
export async function motivoCadenciaInvalida(
  it: { leadId: string | null; contatoId: string; numeroId: string; ocorrenciaComercial: string | null; politicaComercial: { chave: string } | null },
  agora: Date,
): Promise<string | null> {
  if (!it.leadId || !it.politicaComercial || !it.ocorrenciaComercial) return "cadencia_sem_contexto";
  const [lead, conversa] = await Promise.all([
    prisma.lead.findUnique({ where: { id: it.leadId } }),
    prisma.conversaWhatsApp.findUnique({ where: { numeroId_contatoId: { numeroId: it.numeroId, contatoId: it.contatoId } }, include: { contato: true } }),
  ]);
  if (!lead || conversa?.contato.leadId !== lead.id) return "vinculo_comercial_alterado";
  const chave = it.politicaComercial.chave;
  if (chave === CHAVE_LEAD_NOVO) {
    if (lead.etapa !== "NOVO") return "etapa_comercial_alterada";
    if (conversa.capturadaEm?.toISOString() !== it.ocorrenciaComercial) return "ocorrencia_comercial_alterada";
    const respostas = await prisma.mensagemWhatsApp.count({
      where: { conversaId: conversa.id, OR: [
        { direcao: "ENTRADA", criadoEm: { gt: conversa.capturadaEm } },
        { direcao: "SAIDA", OR: [{ origem: "HUMANO" }, { origem: null }] },
      ] },
    });
    return respostas > 0 ? "atendimento_comercial_iniciado" : null;
  }
  if (lead.dataExperimental?.toISOString() !== it.ocorrenciaComercial) return "ocorrencia_comercial_alterada";
  if (chave === CHAVE_PRE_EXPERIMENTAL) {
    if (lead.etapa !== "EXPERIMENTAL_AGENDADA") return "etapa_comercial_alterada";
    if (agora >= lead.dataExperimental) return "experimental_iniciada";
    if (await reagendamentoPendente(lead.id, it.ocorrenciaComercial)) return "reagendamento_solicitado";
    return null;
  }
  if (chave === CHAVE_NO_SHOW) return lead.etapa === "NO_SHOW" ? null : "etapa_comercial_alterada";
  return "cadencia_desconhecida";
}

/** Vincula o texto preparado à identidade, versão e contato conferidos. */
export function referenciaDestinoCobranca(destino: DestinoCobranca | null): string {
  return JSON.stringify(destino ? [destino.matriculaId, destino.referenciaFonte, destino.tipoPagador,
    destino.telefoneE164, destino.nome, destino.responsavelId, destino.contatoAlunoId] : null);
}

/** A quantia aprovada não pode continuar válida após recebimento parcial ou ajuste. */
export async function snapshotCobranca(cobrancaId: string, db: Prisma.TransactionClient = prisma) {
  const c = await db.cobranca.findUnique({ where: { id: cobrancaId }, include: INCLUDE_DESTINO });
  if (!c) return null;
  const destino = resolverDestinoCobranca(c);
  const saldo = c.saldo ?? c.valorNegociado.minus(c.valorRecebido ?? new Prisma.Decimal(0));
  return { c, destino, saldo, assinatura: JSON.stringify([
    c.id, c.moeda, c.valorNegociado.toFixed(), c.valorRecebido?.toFixed() ?? "0", saldo.toFixed(),
    c.vencimento.toISOString(), c.status, destino?.telefoneE164 ?? null,
    c.versao, c.cicloRegua, referenciaDestinoCobranca(destino),
  ]) };
}
