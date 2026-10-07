import { EtapaLead } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { linhasDoFunil, linhasDosGargalos } from "./cron-gestao";

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
