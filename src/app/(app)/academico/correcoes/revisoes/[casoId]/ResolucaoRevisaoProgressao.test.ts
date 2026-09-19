import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/avaliacoes/resolucao-revisao-progressao", () => ({ decidirResolucaoRevisaoProgressao: vi.fn(), proporResolucaoRevisaoProgressao: vi.fn(), revisarResolucaoRevisaoProgressao: vi.fn() }));

import { ResolucaoRevisaoProgressao } from "./ResolucaoRevisaoProgressao";

const propostas = [{ id: "proposta", versao: 1, acao: "REGISTRAR_CANCELAMENTO" as const, motivo: "Cancelamento comprovado", estadoHash: "a".repeat(64), criadaEm: "2026-10-01T02:30:00.000Z", preparador: { id: "preparador", nome: "Gestão" }, casos: [{ id: "caso" }], decisao: { id: "decisao", aprovada: true, motivo: "Aprovada", decididaEm: "2026-10-01T03:30:00.000Z", decisor: { nome: "Administração" } }, podeDecidir: false, superada: false }];

describe("histórico da resolução de revisão", () => {
  it("usa a preferência somente para instantes administrativos", () => {
    const html = renderToStaticMarkup(createElement(ResolucaoRevisaoProgressao, { solicitacaoId: "solicitacao", statusSolicitacao: "PENDENTE", propostas, permitirPreparacao: false, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("Cancelamento comprovado");
  });

  it("recorre a UTC sem preferência", () => {
    const html = renderToStaticMarkup(createElement(ResolucaoRevisaoProgressao, { solicitacaoId: "solicitacao", statusSolicitacao: "PENDENTE", propostas, permitirPreparacao: false }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });
});
