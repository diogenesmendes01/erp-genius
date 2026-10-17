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
type Where = { status?: string; agendadaPara?: Filtro | { not: null }; OR?: { agendadaPara: Filtro }[] };
type Linha = { criadaEm: Date; agendadaPara: Date | null };

const casaFiltro = (v: Date | null, f: Filtro | { not: null } | undefined) =>
  f === undefined ? true : f === null ? v === null : "not" in f ? v !== null : v !== null && v <= f.lte;

/** Banco fake de intenções PENDENTE: aplica o `where`/`orderBy` que o código pedir, como o Postgres faria. */
function pendentes(linhas: Linha[]) {
  m.findFirst.mockImplementation(
    async ({ where, orderBy }: { where: Where; orderBy: Partial<Record<keyof Linha, "asc">> }) => {
      if (where.status !== "PENDENTE") return null;
      const chave = Object.keys(orderBy)[0] as keyof Linha;
      const velha = linhas
        .filter((l) => casaFiltro(l.agendadaPara, where.agendadaPara))
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
