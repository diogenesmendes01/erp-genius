import { DriverWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { chamarMotor } from "./motor/cliente";
import { envioAvisosAgendaHabilitado, MOTIVO_ENVIO_AGENDA_DESLIGADO } from "@/server/comunicacoes-agenda/envio-gate";

const LIMIAR_PENDENTE_MIN = 120;
const LIMIAR_ADIADA_VENCIDA_MIN = 120;
const LIMIAR_CLAIM_EXPIRADO_MIN = 30;
const LIMIAR_EVENTO_MOTOR_PARADO_MIN = 15;

export interface SaudeCanal {
  ok: boolean;
  alertas: string[];
  fila: {
    pendentes: number;
    adiadas: number;
    enviando: number;
    pendenteHaMin: number | null;
    adiadaVencidaHaMin: number | null;
    claimExpiradoHaMin: number | null;
    falhas24h: number;
    eventosMotorPendentes: number;
    eventosMotorAdiados: number;
    eventosMotorFalhos: number | null;
    retidasAgendaDesligada: number;
    envioAgendaHabilitado: boolean;
  };
  sessoes: { rotulo: string; driver: string; sessao: string }[];
  politica: { estado: string; killSwitch: boolean } | null;
  ultimoInboundEm: string | null;
}

async function contarEventosFalhosDoMotor(): Promise<{ falhos: number | null; inalcancavel: string | null }> {
  try {
    const r = await chamarMotor<{ eventos?: unknown[] }>("/v1/eventos/falhos", { metodo: "GET" });
    return { falhos: Array.isArray(r?.eventos) ? r.eventos.length : 0, inalcancavel: null };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    return { falhos: null, inalcancavel: motivo.slice(0, 200) };
  }
}

const minutosDesde = (agora: Date, quando: Date | null | undefined): number | null =>
  quando ? Math.round((agora.getTime() - quando.getTime()) / 60_000) : null;

const maiorOuNulo = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

export async function medirSaudeCanal(agora: Date = new Date()): Promise<SaudeCanal> {
  const envioAgendaHabilitado = envioAvisosAgendaHabilitado();
  const limiarEventoMotor = new Date(agora.getTime() - LIMIAR_EVENTO_MOTOR_PARADO_MIN * 60_000);
  const despachavel = envioAgendaHabilitado ? {} : { avisoAlteracaoAgendaId: null };
  const [porStatus, pendenteMaisVelha, agendadaMaisVencida, adiadaMaisVencida, claimMaisVelho, falhas24h, numeros, ultimoInbound, politica, eventosMotorPendentes, eventosMotorAdiados, eventoMotorParadoDesde, retidasAgendaDesligada] =
    await Promise.all([
      prisma.intencaoMensagem.groupBy({
        by: ["status"],
        where: { status: { in: ["PENDENTE", "ADIADA", "ENVIANDO"] } },
        _count: { _all: true },
      }),
      prisma.intencaoMensagem.findFirst({
        where: { status: "PENDENTE", agendadaPara: null, ...despachavel },
        orderBy: { criadaEm: "asc" },
        select: { criadaEm: true },
      }),
      prisma.intencaoMensagem.findFirst({
        where: { status: "PENDENTE", agendadaPara: { lte: agora }, ...despachavel },
        orderBy: { agendadaPara: "asc" },
        select: { agendadaPara: true },
      }),
      prisma.intencaoMensagem.findFirst({
        where: { status: "ADIADA", despacharAposEm: { not: null }, ...despachavel },
        orderBy: { despacharAposEm: "asc" },
        select: { despacharAposEm: true },
      }),
      prisma.intencaoMensagem.findFirst({
        where: { status: "ENVIANDO" },
        orderBy: { despacharAposEm: "asc" },
        select: { despacharAposEm: true },
      }),
      prisma.intencaoMensagem.count({
        where: { status: "FALHOU", atualizadoEm: { gte: new Date(agora.getTime() - 24 * 3600_000) } },
      }),
      prisma.numeroWhatsApp.findMany({
        where: { ativo: true },
        select: { rotulo: true, driver: true, sessao: true },
      }),
      prisma.mensagemWhatsApp.findFirst({
        where: { direcao: "ENTRADA" },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true },
      }),
      carregarPoliticaRegua(),
      prisma.eventoMotorRecebido.count({
        where: { processadoEm: null, OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: agora } }] },
      }),
      prisma.eventoMotorRecebido.count({ where: { processadoEm: null, proximaTentativaEm: { gt: agora } } }),
      Promise.all([
        prisma.eventoMotorRecebido.findFirst({
          where: { processadoEm: null, proximaTentativaEm: null, recebidoEm: { lt: limiarEventoMotor } },
          orderBy: { recebidoEm: "asc" },
          select: { recebidoEm: true },
        }),
        prisma.eventoMotorRecebido.findFirst({
          where: { processadoEm: null, proximaTentativaEm: { lt: limiarEventoMotor } },
          orderBy: { proximaTentativaEm: "asc" },
          select: { proximaTentativaEm: true },
        }),
      ]).then(([semBackoff, emBackoff]) => {
        const datas = [semBackoff?.recebidoEm, emBackoff?.proximaTentativaEm].filter((d): d is Date => !!d);
        return datas.length ? new Date(Math.min(...datas.map((d) => d.getTime()))) : null;
      }),
      envioAgendaHabilitado
        ? Promise.resolve(0)
        : prisma.intencaoMensagem.count({
            where: { status: { in: ["PENDENTE", "ADIADA"] }, motivoFalha: MOTIVO_ENVIO_AGENDA_DESLIGADO },
          }),
    ]);
  const consultaMotor = numeros.some((n) => n.driver === "MOTOR") ? await contarEventosFalhosDoMotor() : null;
  const eventosMotorFalhos = consultaMotor?.falhos ?? null;

  const contagem = new Map(porStatus.map((s) => [s.status, s._count._all]));
  const pendenteHaMin = maiorOuNulo(
    minutosDesde(agora, pendenteMaisVelha?.criadaEm),
    minutosDesde(agora, agendadaMaisVencida?.agendadaPara),
  );
  const adiadaVencidaHaMin = minutosDesde(agora, adiadaMaisVencida?.despacharAposEm);
  const claimExpiradoHaMin = minutosDesde(agora, claimMaisVelho?.despacharAposEm);

  const alertas: string[] = [];

  if (!politica.killSwitch && pendenteHaMin !== null && pendenteHaMin > LIMIAR_PENDENTE_MIN) {
    alertas.push(
      `Intenção PENDENTE há ${Math.round(pendenteHaMin / 60)}h sem despacho — o cron está rodando?`,
    );
  }

  if (adiadaVencidaHaMin !== null && adiadaVencidaHaMin > LIMIAR_ADIADA_VENCIDA_MIN) {
    alertas.push(
      `Intenção ADIADA venceu há ${Math.round(adiadaVencidaHaMin / 60)}h e não foi redespachada — o cron está rodando?`,
    );
  }

  if (claimExpiradoHaMin !== null && claimExpiradoHaMin > LIMIAR_CLAIM_EXPIRADO_MIN) {
    alertas.push(
      `Envio em claim expirado há ${claimExpiradoHaMin}min sem recuperação — o despachante não roda.`,
    );
  }

  for (const n of numeros) {
    if (n.driver === "MOTOR" && n.sessao === "CAIU") {
      alertas.push(`Sessão do número "${n.rotulo}" caiu — reconectar via QR na tela do canal.`);
    }
  }

  for (const n of numeros) {
    if (n.driver !== DriverWhatsApp.MOTOR) {
      alertas.push(
        `Número "${n.rotulo}" ativo em driver legado (${n.driver}) — não envia nem recebe; pareie a linha no motor e desative o número legado.`,
      );
    }
  }

  if (consultaMotor?.inalcancavel) {
    alertas.push(
      `Motor WhatsApp inalcançável (${consultaMotor.inalcancavel}) — mensagens recebidas não estão chegando.`,
    );
  }

  if (eventoMotorParadoDesde) {
    alertas.push(
      `Evento do motor parado há ${minutosDesde(agora, eventoMotorParadoDesde)}min sem processamento — o dreno está rodando?`,
    );
  }
  if (eventosMotorFalhos && eventosMotorFalhos > 0) {
    alertas.push(`${eventosMotorFalhos} evento(s) falharam no motor — reenviar em /v1/eventos/falhos.`);
  }

  if (falhas24h > 0) {
    alertas.push(`${falhas24h} envio(s) falharam nas últimas 24h — ver motivos na fila de cobrança.`);
  }

  if (politica.killSwitch) {
    alertas.push("Kill switch da régua está LIGADO — automação congelada.");
  }

  return {
    ok: alertas.length === 0,
    alertas,
    fila: {
      pendentes: contagem.get("PENDENTE") ?? 0,
      adiadas: contagem.get("ADIADA") ?? 0,
      enviando: contagem.get("ENVIANDO") ?? 0,
      pendenteHaMin,
      adiadaVencidaHaMin,
      claimExpiradoHaMin,
      falhas24h,
      eventosMotorPendentes,
      eventosMotorAdiados,
      eventosMotorFalhos,
      retidasAgendaDesligada,
      envioAgendaHabilitado,
    },
    sessoes: numeros.map((n) => ({ rotulo: n.rotulo, driver: n.driver, sessao: n.sessao })),
    politica: { estado: politica.estado, killSwitch: politica.killSwitch },
    ultimoInboundEm: ultimoInbound?.criadoEm.toISOString() ?? null,
  };
}
