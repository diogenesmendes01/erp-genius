import { prisma } from "@/lib/prisma";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";

// SAÚDE DO CANAL (doc 30 E5 · gap A7 do doc 28): o "alerta" que o doc 26 cita 3× sem
// existir. Um monitor externo (UptimeRobot etc.) bate em GET /api/whatsapp/health a cada
// N minutos: 200 = tudo bem · 503 = tem alerta (a mensagem diz qual). Sem processo novo,
// sem dependência — leitura direta do estado operacional no banco.

/** Item na fila além disto = o despachante não está drenando (cron parado?). */
const LIMIAR_FILA_MIN = 6 * 60;

export interface SaudeCanal {
  ok: boolean;
  /** Motivos legíveis, um por problema — vira o corpo do alerta do monitor. */
  alertas: string[];
  fila: {
    pendentes: number;
    adiadas: number;
    enviando: number;
    /** Idade em minutos do item mais velho ainda na fila (PENDENTE/ADIADA). */
    maisAntigaMin: number | null;
    falhas24h: number;
  };
  sessoes: { rotulo: string; driver: string; sessao: string }[];
  politica: { estado: string; killSwitch: boolean } | null;
  /** Último inbound recebido (webhook vivo?). null = nunca. */
  ultimoInboundEm: string | null;
}

export async function medirSaudeCanal(agora: Date = new Date()): Promise<SaudeCanal> {
  const [porStatus, maisAntiga, falhas24h, numeros, ultimoInbound, politica] = await Promise.all([
    prisma.intencaoMensagem.groupBy({
      by: ["status"],
      where: { status: { in: ["PENDENTE", "ADIADA", "ENVIANDO"] } },
      _count: { _all: true },
    }),
    prisma.intencaoMensagem.findFirst({
      where: { status: { in: ["PENDENTE", "ADIADA"] } },
      orderBy: { criadaEm: "asc" },
      select: { criadaEm: true },
    }),
    prisma.intencaoMensagem.count({
      where: { status: "FALHOU", criadaEm: { gte: new Date(agora.getTime() - 24 * 3600_000) } },
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
  ]);

  const contagem = new Map(porStatus.map((s) => [s.status, s._count._all]));
  const maisAntigaMin = maisAntiga
    ? Math.max(0, Math.round((agora.getTime() - maisAntiga.criadaEm.getTime()) / 60_000))
    : null;

  const alertas: string[] = [];

  // 1. Fila não drena: item vivo há mais que o limiar = cron/despachante parado (gap A2).
  if (maisAntigaMin !== null && maisAntigaMin > LIMIAR_FILA_MIN) {
    alertas.push(
      `Item mais velho na fila há ${Math.round(maisAntigaMin / 60)}h (limiar ${LIMIAR_FILA_MIN / 60}h) — o cron está rodando?`,
    );
  }

  // 2. Sessão Baileys caída em número ativo: fila acumula até reconectar (doc 26 §sessão).
  for (const n of numeros) {
    if (n.driver === "BAILEYS" && n.sessao === "CAIU") {
      alertas.push(`Sessão do número "${n.rotulo}" caiu — reconectar via QR na tela do canal.`);
    }
  }

  // 3. Falhas de envio nas últimas 24h: itens voltaram à fila humana com motivo.
  if (falhas24h > 0) {
    alertas.push(`${falhas24h} envio(s) falharam nas últimas 24h — ver motivos na fila de cobrança.`);
  }

  // 4. Kill switch ligado é intencional, mas não pode ser esquecido ligado.
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
      maisAntigaMin,
      falhas24h,
    },
    sessoes: numeros.map((n) => ({ rotulo: n.rotulo, driver: n.driver, sessao: n.sessao })),
    politica: { estado: politica.estado, killSwitch: politica.killSwitch },
    ultimoInboundEm: ultimoInbound?.criadoEm.toISOString() ?? null,
  };
}
