import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/contratos/substituicao", () => ({ consultarPropostaSubstituicao: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../../TextoPrevia", () => ({ TextoPrevia: () => createElement("div") }));
vi.mock("../Formularios", () => ({ DecidirSubstituicao: () => createElement("div", { "data-decisao": "preservada" }) }));
vi.mock("../Andamento", () => ({ AndamentoSubstituicao: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string }) => createElement("div", { "data-fuso-andamento": preferenciaFusoExibicao }) }));

import Page from "./page";

const documento = { artefatoId: "artefato", texto: {}, assinatura: { participantes: [], regraTaxa: "SEM", taxa: { valor: "100.00", moeda: "BRL", confirmada: true }, reserva: { status: "ATIVA", expiraEm: "2026-10-01T04:30:00.000Z" } } };
const resposta = () => ({ ok: true, dado: {
  id: "proposta", versao: 3, propostaHash: "a".repeat(64), motivo: "Correção documental", criadaEm: new Date("2026-10-01T02:30:00.000Z"), preparadaPor: "Secretaria A",
  fonte: documento, substituto: documento, superada: false, podeDecidir: false,
  decisao: { aprovada: true, decisor: { nome: "Admin B" }, decididaEm: new Date("2026-10-01T03:30:00.000Z"), motivo: "Conferido" },
  andamento: {},
} });

describe("PropostaSubstituicaoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guarda.mockResolvedValue({ id: "secretaria" });
    mocks.consulta.mockResolvedValue(resposta());
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("formata proposta, decisão e prazo administrativo e entrega a preferência ao andamento", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula", propostaId: "proposta" }), searchParams: Promise.resolve({}) }));

    expect(html).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("30/09/2026, 22:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain('data-fuso-andamento="America/Costa_Rica"');
  });

  it("usa UTC sem preferência e não lê após falha da guarda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula", propostaId: "proposta" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("01/10/2026, 02:30 (UTC; origem UTC)");

    vi.clearAllMocks();
    mocks.guarda.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ id: "matricula", propostaId: "proposta" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
    expect(mocks.consulta).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
