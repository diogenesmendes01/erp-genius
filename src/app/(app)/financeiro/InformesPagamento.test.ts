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
    }));

    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html).toContain("15/01/2026");
    expect(html).toContain("R$ 100,00");
  });

  it("usa UTC quando não há preferência", () => {
    const html = renderToStaticMarkup(createElement(InformesPagamento, { informes }));

    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");
  });
});
