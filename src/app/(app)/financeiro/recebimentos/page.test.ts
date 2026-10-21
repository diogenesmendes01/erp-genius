import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  historico: vi.fn(),
}));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: async () => ["FINANCEIRO"] }));
vi.mock("@/server/financeiro/consultas", () => ({ listarContextosRecebimentoDestinado: async () => [] }));
vi.mock("@/server/financeiro/recebimentos-historico", () => ({ consultarHistoricoRecebimentos: mocks.historico }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: async () => "America/Sao_Paulo" }));
vi.mock("./RecebimentoDestinadoForm", () => ({ RecebimentoDestinadoForm: () => null }));
vi.mock("@/components/VoltarPara", () => ({ VoltarPara: () => null }));

import Page from "./page";

const recebimento = (id: string, dataPagamento: string) => ({
  id, matriculaId: "m1", moeda: "BRL", valor: "100.00", dataPagamento, forma: "PIX", comprovante: null,
  evidenciaCaixaRegistrada: true, comentario: null, destinos: [],
});

describe("/financeiro/recebimentos: dia do pagamento (lote 2 do fuso pessoal)", () => {
  it("baixa sem data registrada à noite na escola sai no dia da escola; data digitada e legado mantêm o dia", async () => {
    mocks.historico.mockResolvedValue({ ok: true, dado: { temProxima: false, itens: [
      recebimento("noite", "2026-10-06T01:30:00.000Z"),
      recebimento("digitada", "2026-10-07T15:00:00.000Z"),
      recebimento("legado", "2026-10-08T00:00:00.000Z"),
    ] } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("pagamento em 05/10/2026");
    expect(html).not.toContain("06/10/2026");
    expect(html).toContain("pagamento em 07/10/2026");
    expect(html).toContain("pagamento em 08/10/2026");
  });
});
