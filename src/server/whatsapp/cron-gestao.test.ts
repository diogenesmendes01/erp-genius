import { EtapaLead } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// Só o que montarRelatorioDiario lê (R2 da #150, B4): contagens do dia, funil agrupado, leads ativos e mudanças de etapa.
const prismaMock = vi.hoisted(() => ({
  lead: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  matricula: { count: vi.fn() },
  evento: { groupBy: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { linhasDoFunil, linhasDosGargalos, montarRelatorioDiario } from "./cron-gestao";

// Relatório diário da gestão (WhatsApp): a etapa sai por extenso, do mapa central (ETAPA_EXTENSO_LABEL), nunca
// como código (R1 da #150, B6). MATRICULADO/PERDIDO não entram no funil ativo hoje, mas a função não depende disso.
describe("relatório da gestão: etapa por extenso", () => {
  it("funil: rótulo de cada etapa, da maior contagem para a menor", () => {
    expect(linhasDoFunil([
      { etapa: EtapaLead.NOVO, _count: { _all: 2 } },
      { etapa: EtapaLead.MATRICULADO, _count: { _all: 5 } },
      { etapa: EtapaLead.PERDIDO, _count: { _all: 1 } },
      { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, _count: { _all: 3 } },
    ])).toBe(["• Matriculado: 5", "• Experimental agendada: 3", "• Novo: 2", "• Perdido: 1"].join("\n"));
  });

  it("gargalos: posição, rótulo e quantidade; sem gargalo, a frase de tudo em dia", () => {
    expect(linhasDosGargalos([[EtapaLead.AGUARDANDO_MATRICULA, 4], [EtapaLead.PERDIDO, 2], [EtapaLead.EM_ATENDIMENTO, 1]])).toBe([
      "1º Aguardando matrícula — 4 lead(s) parados há 3+ dias",
      "2º Perdido — 2 lead(s) parados há 3+ dias",
      "3º Em atendimento — 1 lead(s) parados há 3+ dias",
    ].join("\n"));
    expect(linhasDosGargalos([])).toBe("Nenhum gargalo relevante (nada parado há 3+ dias). ✅");
  });

  it("nenhuma etapa sai como código", () => {
    const texto = linhasDoFunil(Object.values(EtapaLead).map((etapa) => ({ etapa, _count: { _all: 1 } })))
      + "\n" + linhasDosGargalos(Object.values(EtapaLead).map((etapa) => [etapa, 1] as const));
    for (const etapa of Object.values(EtapaLead)) expect(texto, etapa).not.toMatch(new RegExp(`(^|[^A-Z_])${etapa}([^A-Z_]|$)`));
  });
});

// O relatório enviado (não só as funções extraídas) usa as linhas por extenso: trocar `linhasDoFunil(funil)` ou
// `linhasDosGargalos(gargalos)` pela etapa crua quebra este teste (R2 da #150, B4).
describe("relatório da gestão: o texto enviado por montarRelatorioDiario", () => {
  it("traz funil e gargalos por extenso, com MATRICULADO/PERDIDO no funil, e nenhuma etapa como código", async () => {
    const agora = new Date(2026, 9, 7, 9, 0, 0);
    const haDias = (n: number) => new Date(agora.getTime() - n * 24 * 3600_000);
    prismaMock.lead.count.mockImplementation(async (a: { where: { etapa?: string } }) =>
      a.where.etapa === EtapaLead.NOVO ? 7 : a.where.etapa === EtapaLead.EXPERIMENTAL_AGENDADA ? 3 : 4);
    prismaMock.matricula.count.mockResolvedValue(2);
    prismaMock.lead.groupBy.mockResolvedValue([
      { etapa: EtapaLead.PERDIDO, _count: { _all: 1 } },
      { etapa: EtapaLead.MATRICULADO, _count: { _all: 5 } },
      { etapa: EtapaLead.NOVO, _count: { _all: 2 } },
    ]);
    prismaMock.lead.findMany.mockResolvedValue([
      { id: "l1", etapa: EtapaLead.AGUARDANDO_MATRICULA, criadoEm: haDias(10) },
      { id: "l2", etapa: EtapaLead.AGUARDANDO_MATRICULA, criadoEm: haDias(9) },
      { id: "l3", etapa: EtapaLead.AGUARDANDO_MATRICULA, criadoEm: haDias(9) },
      { id: "l4", etapa: EtapaLead.NO_SHOW, criadoEm: haDias(8) },
      { id: "l5", etapa: EtapaLead.EM_ATENDIMENTO, criadoEm: haDias(1) },
    ]);
    // l3 mudou de etapa ontem: não está parado.
    prismaMock.evento.groupBy.mockResolvedValue([{ agregadoId: "l3", _max: { criadoEm: haDias(1) } }]);

    const texto = await montarRelatorioDiario(agora, 30);

    expect(texto).toContain(["Leads novos hoje: 4", "Matrículas ativadas hoje: 2", "Experimentais de hoje: 3", "SLA estourado agora: 7 lead(s)", ""].join("\n"));
    expect(texto).toContain(["Funil ativo:", "• Matriculado: 5", "• Novo: 2", "• Perdido: 1", "", ""].join("\n"));
    expect(texto.endsWith(["Gargalos:", "1º Aguardando matrícula — 2 lead(s) parados há 3+ dias", "2º No-show — 1 lead(s) parados há 3+ dias"].join("\n"))).toBe(true);
    for (const etapa of Object.values(EtapaLead)) expect(texto, etapa).not.toMatch(new RegExp(`(^|[^A-Z_])${etapa}([^A-Z_]|$)`));
  });
});
