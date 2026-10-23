import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { listarInformesPagamento } from "@/server/financeiro/consultas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/financeiro/acoes", () => ({ conferirPagamento: vi.fn() }));

import { InformesPagamento } from "./InformesPagamento";

const informes: Awaited<ReturnType<typeof listarInformesPagamento>> = [{
  id: "informe", versao: 1, valor: 100, moeda: "BRL", forma: "TRANSFERENCIA",
  aluno: "Ana Silva", cobranca: "COB-1", dataPagamento: "2026-01-15T12:00:00.000Z",
  comprovanteUrl: null, comprovanteNome: null, comentario: null, status: "A_CONFERIR",
  motivoConferencia: null, suspenderLembretesAte: "2026-01-01T02:30:00.000Z", podeConferir: false,
}];

describe("InformesPagamento", () => {
  it("exibe o prazo operacional na preferência pessoal e preserva pagamento e valor", () => {
    const html = renderToStaticMarkup(createElement(InformesPagamento, {
      informes,
      preferenciaFusoExibicao: "America/Costa_Rica",
      fusoEscola: "America/Sao_Paulo",
    }));

    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html).toContain("15/01/2026");
    expect(html).toContain("R$ 100,00");
  });

  it("usa UTC quando não há preferência", () => {
    const html = renderToStaticMarkup(createElement(InformesPagamento, { informes, fusoEscola: "America/Sao_Paulo" }));

    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");
  });

  // Fuso pessoal nas telas (pendência da Q176): a data do pagamento é dia civil da escola, sem fuso pessoal nem do
  // processo. A gravação legada à meia-noite UTC dava 14/01 com o servidor em São Paulo.
  it("data do pagamento é o dia civil da escola, para qualquer preferência", () => {
    for (const preferenciaFusoExibicao of ["Asia/Tokyo", "America/Costa_Rica", null]) {
      const html = renderToStaticMarkup(createElement(InformesPagamento, {
        informes: [{ ...informes[0], dataPagamento: "2026-01-15T00:00:00.000Z" }], preferenciaFusoExibicao, fusoEscola: "America/Sao_Paulo",
      }));
      expect(html).toContain("R$ 100,00 · 15/01/2026");
    }
  });
  it("informe sem data (instante do envio) à noite na escola fica no dia da escola", () => {
    for (const preferenciaFusoExibicao of ["Asia/Tokyo", null]) {
      const html = renderToStaticMarkup(createElement(InformesPagamento, {
        informes: [{ ...informes[0], dataPagamento: "2026-01-16T01:30:00.000Z" }], preferenciaFusoExibicao, fusoEscola: "America/Sao_Paulo",
      }));
      expect(html).toContain("R$ 100,00 · 15/01/2026");
    }
  });
});

