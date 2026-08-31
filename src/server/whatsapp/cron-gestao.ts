import { EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { garantirContato } from "./identidade";

// C5 — GESTÃO (doc 27 Onda 3): alerta de SLA (lead NOVO parado) e relatório diário no
// WhatsApp do gestor, pela MESMA outbox/despachante (origem GESTAO — mensagens para a
// equipe: isentas de janela/teto/silêncio; kill switch congela; shadow = gestaoEstado).
// O ranking de GARGALOS entra no relatório: etapas com mais leads parados há 3+ dias,
// projetado dos eventos que mudam etapa (mesma fonte do `etapaDesde` — issue #15).

const DIAS_GARGALO = 3;
/** Etapas terminais/estacionadas ficam fora do ranking de gargalos. */
const ETAPAS_FUNIL_ATIVO: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
  EtapaLead.EXPERIMENTAL_REALIZADA,
  EtapaLead.PROPOSTA,
  EtapaLead.AGUARDANDO_MATRICULA,
  EtapaLead.NO_SHOW,
];

const ETAPA_ROTULO: Record<string, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em atendimento",
  QUALIFICADO: "Qualificado",
  EXPERIMENTAL_AGENDADA: "Experimental agendada",
  EXPERIMENTAL_REALIZADA: "Experimental realizada",
  PROPOSTA: "Proposta",
  AGUARDANDO_MATRICULA: "Aguardando matrícula",
  NO_SHOW: "No-show",
};

export interface ResultadoCronGestao {
  executou: boolean;
  motivoParada: string | null;
  alertaSla: { leadsAlertados: number; enfileirada: boolean };
  relatorio: { enviado: boolean; motivo: string | null };
}

const zerado = (motivo: string): ResultadoCronGestao => ({
  executou: false,
  motivoParada: motivo,
  alertaSla: { leadsAlertados: 0, enfileirada: false },
  relatorio: { enviado: false, motivo: null },
});

function minutosDesde(quando: Date, agora: Date): number {
  return Math.floor((agora.getTime() - quando.getTime()) / 60_000);
}

function diaISO(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

export async function rodarGestao(agora: Date = new Date()): Promise<ResultadoCronGestao> {
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  // Regra de ouro (doc 27): nasce DESLIGADA — nem intenção é gerada.
  if (!config || config.gestaoEstado === "DESLIGADA") return zerado("gestao_desligada");
  if (!config.gestaoTelefoneE164) return zerado("sem_telefone_gestor");
  if (!config.gestaoNumeroId) return zerado("sem_numero_remetente");
  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: config.gestaoNumeroId } });
  if (!numero || !numero.ativo) return zerado("numero_remetente_inativo");

  const r: ResultadoCronGestao = { ...zerado(""), executou: true, motivoParada: null };

  // ── 1. ALERTA DE SLA: leads NOVO parados além do limite, ainda não alertados ──────────
  // Idempotência por LEAD (evento `AlertaSlaEnviado`): cada lead estourado gera UM alerta,
  // agregado numa única mensagem por tick (nada de metralhar o gestor). O evento é gravado
  // no ENFILEIRAMENTO — em ensaio (shadow) o alerta é "consumido" pelo ensaio, deliberado.
  const limiteSla = new Date(agora.getTime() - config.gestaoSlaMinutos * 60_000);
  const estourados = await prisma.lead.findMany({
    where: { etapa: EtapaLead.NOVO, criadoEm: { lt: limiteSla } },
    select: { id: true, codigo: true, nome: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });
  const jaAlertados = new Set(
    (
      await prisma.evento.findMany({
        where: {
          agregadoTipo: "Lead",
          agregadoId: { in: estourados.map((l) => l.id) },
          tipo: "AlertaSlaEnviado",
        },
        select: { agregadoId: true },
      })
    ).map((e) => e.agregadoId),
  );
  const novos = estourados.filter((l) => !jaAlertados.has(l.id));

  if (novos.length > 0) {
    const linhas = novos
      .slice(0, 10)
      .map((l) => `• ${l.nome}${l.codigo ? ` (${l.codigo})` : ""} — há ${minutosDesde(l.criadoEm, agora)} min`)
      .join("\n");
    const extra = novos.length > 10 ? `\n…e mais ${novos.length - 10}.` : "";
    const corpo =
      `⚠️ Alerta de SLA — ${novos.length} lead(s) novo(s) sem 1º contato há mais de ` +
      `${config.gestaoSlaMinutos} min:\n${linhas}${extra}`;

    await prisma.$transaction(async (tx) => {
      const contato = await garantirContato(tx, {
        telefoneE164: config.gestaoTelefoneE164!,
        waId: config.gestaoTelefoneE164!.replace(/\D/g, ""),
        nomeExibicao: "Gestor comercial",
      });
      await tx.intencaoMensagem.create({
        data: {
          numeroId: numero.id,
          contatoId: contato.id,
          origem: "GESTAO",
          corpoRenderizado: corpo,
          autorId: null,
        },
      });
      for (const l of novos) {
        await tx.evento.create({
          data: {
            tipo: "AlertaSlaEnviado",
            agregadoTipo: "Lead",
            agregadoId: l.id,
            autorId: null,
            payload: { slaMinutos: config.gestaoSlaMinutos, minutosParado: minutosDesde(l.criadoEm, agora) },
          },
        });
      }
    });
    r.alertaSla = { leadsAlertados: novos.length, enfileirada: true };
  }

  // ── 2. RELATÓRIO DIÁRIO: uma vez por dia, a partir da hora configurada ────────────────
  const dia = diaISO(agora);
  if (agora.getHours() < config.gestaoRelatorioHora) {
    r.relatorio = { enviado: false, motivo: "antes_da_hora" };
    return r;
  }
  const jaEnviado = await prisma.evento.count({
    where: {
      agregadoTipo: "ConfigComercial",
      agregadoId: "comercial",
      tipo: "RelatorioDiarioGestor",
      payload: { path: ["dia"], equals: dia },
    },
  });
  if (jaEnviado > 0) {
    r.relatorio = { enviado: false, motivo: "ja_enviado_hoje" };
    return r;
  }

  const corpo = await montarRelatorioDiario(agora, config.gestaoSlaMinutos);
  await prisma.$transaction(async (tx) => {
    const contato = await garantirContato(tx, {
      telefoneE164: config.gestaoTelefoneE164!,
      waId: config.gestaoTelefoneE164!.replace(/\D/g, ""),
      nomeExibicao: "Gestor comercial",
    });
    await tx.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "GESTAO",
        corpoRenderizado: corpo,
        autorId: null,
      },
    });
    await tx.evento.create({
      data: {
        tipo: "RelatorioDiarioGestor",
        agregadoTipo: "ConfigComercial",
        agregadoId: "comercial",
        autorId: null,
        payload: { dia },
      },
    });
  });
  r.relatorio = { enviado: true, motivo: null };
  return r;
}

/** KPIs do dia + funil + ranking de GARGALOS (etapas com mais leads parados há 3+ dias). */
async function montarRelatorioDiario(agora: Date, slaMinutos: number): Promise<string> {
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimDia = new Date(inicioDia.getTime() + 24 * 3600_000);

  const [leadsHoje, matriculasHoje, experimentaisHoje, slaEstourado, funil] = await Promise.all([
    prisma.lead.count({ where: { criadoEm: { gte: inicioDia, lt: fimDia } } }),
    prisma.matricula.count({ where: { ativadaEm: { gte: inicioDia, lt: fimDia } } }),
    prisma.lead.count({
      where: { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { gte: inicioDia, lt: fimDia } },
    }),
    prisma.lead.count({
      where: { etapa: EtapaLead.NOVO, criadoEm: { lt: new Date(agora.getTime() - slaMinutos * 60_000) } },
    }),
    prisma.lead.groupBy({
      by: ["etapa"],
      _count: { _all: true },
      where: { etapa: { in: ETAPAS_FUNIL_ATIVO } },
    }),
  ]);

  // GARGALOS: leads do funil ativo cuja etapa não muda há DIAS_GARGALO+ dias (projeção dos
  // eventos que mudam etapa — mesma fonte do etapaDesde, issue #15), agrupados por etapa.
  const leadsAtivos = await prisma.lead.findMany({
    where: { etapa: { in: ETAPAS_FUNIL_ATIVO } },
    select: { id: true, etapa: true, criadoEm: true },
  });
  const mudancas = leadsAtivos.length
    ? await prisma.evento.groupBy({
        by: ["agregadoId"],
        where: {
          agregadoTipo: "Lead",
          tipo: { in: TIPOS_MUDAM_ETAPA },
          agregadoId: { in: leadsAtivos.map((l) => l.id) },
        },
        _max: { criadoEm: true },
      })
    : [];
  const desdePorLead = new Map(mudancas.map((m) => [m.agregadoId, m._max.criadoEm!]));
  const limiteParado = new Date(agora.getTime() - DIAS_GARGALO * 24 * 3600_000);
  const paradosPorEtapa = new Map<string, number>();
  for (const l of leadsAtivos) {
    const desde = desdePorLead.get(l.id) ?? l.criadoEm;
    if (desde < limiteParado) paradosPorEtapa.set(l.etapa, (paradosPorEtapa.get(l.etapa) ?? 0) + 1);
  }
  const gargalos = [...paradosPorEtapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const funilLinhas = funil
    .sort((a, b) => b._count._all - a._count._all)
    .map((f) => `• ${ETAPA_ROTULO[f.etapa] ?? f.etapa}: ${f._count._all}`)
    .join("\n");
  const gargaloLinhas =
    gargalos.length === 0
      ? "Nenhum gargalo relevante (nada parado há 3+ dias). ✅"
      : gargalos
          .map(([etapa, n], i) => `${i + 1}º ${ETAPA_ROTULO[etapa] ?? etapa} — ${n} lead(s) parados há 3+ dias`)
          .join("\n");

  return (
    `📊 Relatório diário — ${agora.toLocaleDateString("pt-BR")}\n\n` +
    `Leads novos hoje: ${leadsHoje}\n` +
    `Matrículas ativadas hoje: ${matriculasHoje}\n` +
    `Experimentais de hoje: ${experimentaisHoje}\n` +
    `SLA estourado agora: ${slaEstourado} lead(s)\n\n` +
    `Funil ativo:\n${funilLinhas || "• vazio"}\n\n` +
    `Gargalos:\n${gargaloLinhas}`
  );
}
