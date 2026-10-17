import { prisma } from "@/lib/prisma";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { envioAvisosAgendaHabilitado, MOTIVO_ENVIO_AGENDA_DESLIGADO } from "@/server/comunicacoes-agenda/envio-gate";

// SAÚDE DO CANAL (doc 30 E5 · gap A7 do doc 28): o "alerta" que o doc 26 cita 3× sem
// existir. Um monitor externo (UptimeRobot etc.) bate em GET /api/whatsapp/health a cada
// N minutos: 200 = tudo bem · 503 = tem alerta (a mensagem diz qual). Sem processo novo,
// sem dependência — leitura direta do estado operacional no banco.
//
// A régua de "fila não drena" é POR ESTADO (review PR #52): ADIADA com despacho no
// futuro é uma fila SAUDÁVEL (noite/fim de semana/teto) — o problema é o que já venceu
// e ninguém pegou. Cada estado tem seu relógio:
//   PENDENTE → idade desde que ficou DESPACHÁVEL: a criação, ou o `agendadaPara` da
//              mensagem agendada pelo atendente (Tarefas) — antes disso o despachante não
//              a pega e ela não é incidente (C1 · R1 do #202);
//   ADIADA   → quanto `despacharAposEm` está VENCIDO;
//   ENVIANDO → quanto o prazo do claim expirou sem a recuperação rodar.
//
// Aviso de agenda com COMUNICACOES_AGENDA_ENVIO_ENABLED desligado fica retido de propósito
// (R1 do #209, C2): conta em `retidasAgendaDesligada` e, enquanto o envio estiver desligado,
// fica fora dos relógios — não é sinal de cron parado, como a fila com kill switch ligado.

/** PENDENTE além disto (min) = o tick horário não está rodando. */
const LIMIAR_PENDENTE_MIN = 120;
/** ADIADA vencida além disto (min) sem redespachar = idem. */
const LIMIAR_ADIADA_VENCIDA_MIN = 120;
/** Claim ENVIANDO expirado além disto (min) = nem a recuperação de órfãos rodou. */
const LIMIAR_CLAIM_EXPIRADO_MIN = 30;

export interface SaudeCanal {
  ok: boolean;
  /** Motivos legíveis, um por problema — vira o corpo do alerta do monitor. */
  alertas: string[];
  fila: {
    pendentes: number;
    adiadas: number;
    enviando: number;
    /** Minutos desde que a PENDENTE mais velha ficou despachável (agendada no futuro não conta). */
    pendenteHaMin: number | null;
    /** Minutos desde que a ADIADA mais vencida passou do seu despacharAposEm (negativo = ainda no futuro). */
    adiadaVencidaHaMin: number | null;
    /** Minutos desde que o claim ENVIANDO mais velho expirou (negativo = claim ainda válido). */
    claimExpiradoHaMin: number | null;
    /** Intenções que TRANSICIONARAM para FALHOU nas últimas 24h (por atualizadoEm). */
    falhas24h: number;
    /** Avisos de agenda PENDENTE/ADIADA retidos pelo envio de agenda desligado
     *  (motivoFalha `envio_agenda_desligado`). Já contados em `pendentes`/`adiadas`. */
    retidasAgendaDesligada: number;
    /** Estado atual de COMUNICACOES_AGENDA_ENVIO_ENABLED. */
    envioAgendaHabilitado: boolean;
  };
  sessoes: { rotulo: string; driver: string; sessao: string }[];
  politica: { estado: string; killSwitch: boolean } | null;
  /** Último inbound recebido (webhook vivo?). null = nunca. */
  ultimoInboundEm: string | null;
}

const minutosDesde = (agora: Date, quando: Date | null | undefined): number | null =>
  quando ? Math.round((agora.getTime() - quando.getTime()) / 60_000) : null;

const maiorOuNulo = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

export async function medirSaudeCanal(agora: Date = new Date()): Promise<SaudeCanal> {
  const envioAgendaHabilitado = envioAvisosAgendaHabilitado();
  // Com o envio de agenda desligado, o aviso de agenda não é despachável: fora dos relógios.
  const despachavel = envioAgendaHabilitado ? {} : { avisoAlteracaoAgendaId: null };
  const [porStatus, pendenteMaisVelha, agendadaMaisVencida, adiadaMaisVencida, claimMaisVelho, falhas24h, numeros, ultimoInbound, politica, retidasAgendaDesligada] =
    await Promise.all([
      // Contagem = ESTOQUE da fila, inclusive agendadas para o futuro (como as ADIADAS à
      // espera de janela): é informativa e nenhum alerta depende dela. O que alarma é o
      // relógio abaixo, que só olha o que já é despachável.
      prisma.intencaoMensagem.groupBy({
        by: ["status"],
        where: { status: { in: ["PENDENTE", "ADIADA", "ENVIANDO"] } },
        _count: { _all: true },
      }),
      // Mesmo critério do despachante: PENDENTE sem agendamento conta desde a criação...
      prisma.intencaoMensagem.findFirst({
        where: { status: "PENDENTE", agendadaPara: null, ...despachavel },
        orderBy: { criadaEm: "asc" },
        select: { criadaEm: true },
      }),
      // ...e a agendada só desde que venceu (agendadaPara > agora ainda não é fila).
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
        orderBy: { despacharAposEm: "asc" }, // despacharAposEm = prazo do claim (despachante §11)
        select: { despacharAposEm: true },
      }),
      // Momento da FALHA (atualizadoEm = última transição), não da criação (review PR #52).
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
      prisma.intencaoMensagem.count({
        where: { status: { in: ["PENDENTE", "ADIADA"] }, motivoFalha: MOTIVO_ENVIO_AGENDA_DESLIGADO },
      }),
    ]);

  const contagem = new Map(porStatus.map((s) => [s.status, s._count._all]));
  const pendenteHaMin = maiorOuNulo(
    minutosDesde(agora, pendenteMaisVelha?.criadaEm),
    minutosDesde(agora, agendadaMaisVencida?.agendadaPara),
  );
  const adiadaVencidaHaMin = minutosDesde(agora, adiadaMaisVencida?.despacharAposEm);
  const claimExpiradoHaMin = minutosDesde(agora, claimMaisVelho?.despacharAposEm);

  const alertas: string[] = [];

  // 1. PENDENTE parada: o tick não roda. Com kill switch LIGADO ficar PENDENTE é o
  //    comportamento esperado (congela sem cancelar) — o alerta 4 já cobre.
  if (!politica.killSwitch && pendenteHaMin !== null && pendenteHaMin > LIMIAR_PENDENTE_MIN) {
    alertas.push(
      `Intenção PENDENTE há ${Math.round(pendenteHaMin / 60)}h sem despacho — o cron está rodando?`,
    );
  }

  // 2. ADIADA que VENCEU e ninguém redespachou (a que ainda espera janela/teto é saudável).
  if (adiadaVencidaHaMin !== null && adiadaVencidaHaMin > LIMIAR_ADIADA_VENCIDA_MIN) {
    alertas.push(
      `Intenção ADIADA venceu há ${Math.round(adiadaVencidaHaMin / 60)}h e não foi redespachada — o cron está rodando?`,
    );
  }

  // 3. Claim ENVIANDO expirado: a recuperação de órfãos (despachante §recuperação) não roda.
  if (claimExpiradoHaMin !== null && claimExpiradoHaMin > LIMIAR_CLAIM_EXPIRADO_MIN) {
    alertas.push(
      `Envio em claim expirado há ${claimExpiradoHaMin}min sem recuperação — o despachante não roda.`,
    );
  }

  // 4. Sessão Baileys caída em número ativo: fila acumula até reconectar (doc 26 §sessão).
  for (const n of numeros) {
    if (n.driver === "BAILEYS" && n.sessao === "CAIU") {
      alertas.push(`Sessão do número "${n.rotulo}" caiu — reconectar via QR na tela do canal.`);
    }
  }

  // 5. Falhas de envio nas últimas 24h: itens voltaram à fila humana com motivo.
  if (falhas24h > 0) {
    alertas.push(`${falhas24h} envio(s) falharam nas últimas 24h — ver motivos na fila de cobrança.`);
  }

  // 6. Kill switch ligado é intencional, mas não pode ser esquecido ligado.
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
      retidasAgendaDesligada,
      envioAgendaHabilitado,
    },
    sessoes: numeros.map((n) => ({ rotulo: n.rotulo, driver: n.driver, sessao: n.sessao })),
    politica: { estado: politica.estado, killSwitch: politica.killSwitch },
    ultimoInboundEm: ultimoInbound?.criadoEm.toISOString() ?? null,
  };
}
