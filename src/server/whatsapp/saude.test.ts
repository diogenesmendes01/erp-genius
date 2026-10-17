import { beforeEach, describe, expect, it, vi } from "vitest";

// Saúde do canal com Prisma mockado (complementa o saude.int.test.ts, que não roda no CI —
// issue #162). Fixa o filtro da PENDENTE mais velha: uma mensagem agendada pelo atendente
// para o futuro (`agendadaPara > agora`) fica PENDENTE desde a criação, mas o despachante
// só a pega a partir de `agendadaPara` — ela não pode disparar "o cron está rodando?".

const m = vi.hoisted(() => ({
  groupBy: vi.fn(), findFirst: vi.fn(), count: vi.fn(), numeros: vi.fn(), inbound: vi.fn(), politica: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    intencaoMensagem: { groupBy: m.groupBy, findFirst: m.findFirst, count: m.count },
    numeroWhatsApp: { findMany: m.numeros },
    mensagemWhatsApp: { findFirst: m.inbound },
  },
}));
vi.mock("@/server/cobrancas/politica", () => ({ carregarPoliticaRegua: m.politica }));

import { medirSaudeCanal } from "./saude";

const AGORA = new Date("2026-10-17T12:00:00.000Z");
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3600_000);

type Filtro = null | { lte: Date };
type Where = { status?: string; agendadaPara?: Filtro | { not: null }; OR?: { agendadaPara: Filtro }[]; avisoAlteracaoAgendaId?: null };
type Linha = { criadaEm: Date; agendadaPara: Date | null; agenda?: boolean };

const casaFiltro = (v: Date | null, f: Filtro | { not: null } | undefined) =>
  f === undefined ? true : f === null ? v === null : "not" in f ? v !== null : v !== null && v <= f.lte;

/** Banco fake de intenções PENDENTE: aplica o `where`/`orderBy` que o código pedir, como o Postgres faria. */
function pendentes(linhas: Linha[]) {
  m.findFirst.mockImplementation(
    async ({ where, orderBy }: { where: Where; orderBy: Partial<Record<"criadaEm" | "agendadaPara", "asc">> }) => {
      if (where.status !== "PENDENTE") return null;
      const chave = Object.keys(orderBy)[0] as "criadaEm" | "agendadaPara";
      const velha = linhas
        .filter((l) => casaFiltro(l.agendadaPara, where.agendadaPara))
        .filter((l) => !("avisoAlteracaoAgendaId" in where) || !l.agenda)
        .filter((l) => !where.OR || where.OR.some((c) => casaFiltro(l.agendadaPara, c.agendadaPara)))
        .sort((a, b) => (a[chave]?.getTime() ?? 0) - (b[chave]?.getTime() ?? 0))[0];
      return velha ?? null;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.groupBy.mockResolvedValue([]);
  m.count.mockResolvedValue(0);
  m.numeros.mockResolvedValue([]);
  m.inbound.mockResolvedValue(null);
  m.politica.mockResolvedValue({ estado: "ATIVA", killSwitch: false });
  pendentes([]);
});

describe("medirSaudeCanal — PENDENTE agendada para o futuro", () => {
  it("mensagem agendada para daqui a dias, criada há 3 dias, não dispara o alerta de cron parado", async () => {
    pendentes([{ criadaEm: horasAtras(72), agendadaPara: new Date(AGORA.getTime() + 48 * 3600_000) }]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.alertas.some((a) => a.includes("PENDENTE há"))).toBe(false);
    expect(s.ok).toBe(true);
    expect(s.fila.pendenteHaMin).toBeNull();
  });

  it("agendada que JÁ VENCEU e segue PENDENTE além do limiar → alerta, medido desde o agendadaPara", async () => {
    pendentes([{ criadaEm: horasAtras(72), agendadaPara: horasAtras(5) }]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.pendenteHaMin).toBe(5 * 60);
    expect(s.alertas.some((a) => a.includes("PENDENTE há 5h"))).toBe(true);
  });

  it("agendada que acabou de vencer (criada há dias) ainda está dentro do limiar → sem alerta", async () => {
    pendentes([{ criadaEm: horasAtras(72), agendadaPara: new Date(AGORA.getTime() - 30 * 60_000) }]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.pendenteHaMin).toBe(30);
    expect(s.ok).toBe(true);
  });

  it("a futura não esconde uma PENDENTE comum parada: mede a mais velha entre as despacháveis", async () => {
    pendentes([
      { criadaEm: horasAtras(72), agendadaPara: new Date(AGORA.getTime() + 48 * 3600_000) },
      { criadaEm: horasAtras(4), agendadaPara: null },
    ]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.pendenteHaMin).toBe(4 * 60);
    expect(s.alertas.some((a) => a.includes("PENDENTE há 4h"))).toBe(true);
  });
});

// Revisão R1 do #209 (C2): com COMUNICACOES_AGENDA_ENVIO_ENABLED desligado o despachante retém o
// aviso de agenda (PENDENTE/ADIADA, motivo `envio_agenda_desligado`). A saúde mostra quantos estão
// retidos e não confunde a retenção intencional com cron parado.
describe("medirSaudeCanal — aviso de agenda retido com o envio de agenda desligado", () => {
  const retidas = (n: number) =>
    m.count.mockImplementation(async ({ where }: { where: { motivoFalha?: string } }) =>
      where.motivoFalha === "envio_agenda_desligado" ? n : 0);

  it("conta as retidas pelo motivo próprio e não dispara o alerta de cron parado", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
    retidas(2);
    pendentes([{ criadaEm: horasAtras(30), agendadaPara: null, agenda: true }]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.retidasAgendaDesligada).toBe(2);
    expect(s.fila.envioAgendaHabilitado).toBe(false);
    expect(s.fila.pendenteHaMin).toBeNull();
    expect(s.alertas.some((a) => a.includes("PENDENTE há"))).toBe(false);
    expect(s.ok).toBe(true);
    expect(m.count).toHaveBeenCalledWith({
      where: { status: { in: ["PENDENTE", "ADIADA"] }, motivoFalha: "envio_agenda_desligado" },
    });
    vi.unstubAllEnvs();
  });

  it("a retenção não esconde uma PENDENTE comum parada", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
    pendentes([
      { criadaEm: horasAtras(30), agendadaPara: null, agenda: true },
      { criadaEm: horasAtras(4), agendadaPara: null },
    ]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.pendenteHaMin).toBe(4 * 60);
    expect(s.alertas.some((a) => a.includes("PENDENTE há 4h"))).toBe(true);
    vi.unstubAllEnvs();
  });

  // C1 do #212: o motivo `envio_agenda_desligado` só é limpo quando o despachante pega a intenção.
  // Entre religar o envio e o próximo tick, a contagem não pode seguir mostrando avisos retidos.
  it("com o envio de agenda ligado, nada conta como retido (motivo antigo até o próximo tick)", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
    retidas(3);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.envioAgendaHabilitado).toBe(true);
    expect(s.fila.retidasAgendaDesligada).toBe(0);
    expect(m.count).not.toHaveBeenCalledWith({
      where: { status: { in: ["PENDENTE", "ADIADA"] }, motivoFalha: "envio_agenda_desligado" },
    });
    vi.unstubAllEnvs();
  });

  it("com o envio de agenda ligado, o aviso de agenda parado volta a contar no relógio", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
    pendentes([{ criadaEm: horasAtras(30), agendadaPara: null, agenda: true }]);

    const s = await medirSaudeCanal(AGORA);

    expect(s.fila.envioAgendaHabilitado).toBe(true);
    expect(s.fila.pendenteHaMin).toBe(30 * 60);
    expect(s.alertas.some((a) => a.includes("PENDENTE há 30h"))).toBe(true);
    vi.unstubAllEnvs();
  });
});
