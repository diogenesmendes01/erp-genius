import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ preparar: vi.fn(), decidir: vi.fn(), refresh: vi.fn(), useState: vi.fn(), useRef: vi.fn(), useTransition: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useRef: mocks.useRef, useTransition: mocks.useTransition }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/financeiro/revisao-correcao-aula", () => ({ proporRevisaoFinanceiraCorrecaoAula: mocks.preparar, decidirRevisaoFinanceiraCorrecaoAula: mocks.decidir, consultarRevisoesFinanceirasCorrecaoAula: vi.fn() }));

import { RevisoesCorrecaoAula } from "./RevisoesCorrecaoAula";

type No = { type?: unknown; props?: Record<string, unknown> };
function nos(no: unknown): No[] { if (Array.isArray(no)) return no.flatMap(nos); if (!no || typeof no !== "object") return []; const atual = no as No; return typeof atual.type === "function" ? [atual, ...nos((atual.type as (props: Record<string, unknown>) => unknown)(atual.props ?? {}))] : [atual, ...nos(atual.props?.children)]; }
function encontrar(no: unknown, predicado: (no: No) => boolean) { const encontrado = nos(no).find(predicado); if (!encontrado) throw new Error("Elemento não encontrado"); return encontrado; }

class DadosFormulario { get(nome: string) { return nome === "motivo" ? "Reconferência financeira necessária." : null; } }
function montar() {
  mocks.useTransition.mockReturnValue([false, (acao: () => void) => { void acao(); }]);
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useRef.mockReturnValue({ current: new Map() });
  return RevisoesCorrecaoAula({ matriculaId: "matricula", dados: { usuarioId: "fin", revisoes: [], candidatas: [{ id: "q23", encontroId: "encontro", versao: 1, encontro: { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo" }, podePreparar: true, preparoBloqueadoPor: null, tiposDisponiveis: [{ tipo: "SEM_ALTERACAO_VALORES", efeito: null }, { tipo: "AULA_NAO_COBRAVEL", efeito: { tipo: "GERA_CREDITO", valorAula: "156.25", moeda: "CRC", creditoValor: "156.25" } }] }] } as never });
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("gera nova chave depois de preparar com sucesso, sem reaproveitar o replay anterior", async () => {
  vi.stubGlobal("FormData", DadosFormulario); vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("chave-primeira").mockReturnValueOnce("chave-segunda") });
  mocks.preparar.mockResolvedValue({ ok: true });
  const formulario = encontrar(montar(), no => no.type === "form");
  const enviar = formulario.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void;

  enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); await Promise.resolve();
  enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); await Promise.resolve();

  expect(mocks.preparar).toHaveBeenNthCalledWith(1, { propostaCorrecaoAulaId: "q23", motivo: "Reconferência financeira necessária.", chaveIdempotencia: "chave-primeira" });
  expect(mocks.preparar).toHaveBeenNthCalledWith(2, { propostaCorrecaoAulaId: "q23", motivo: "Reconferência financeira necessária.", chaveIdempotencia: "chave-segunda" });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});

it("apresenta a fonte consumida, o preço preservado e as condições para a decisão financeira", () => {
  mocks.useTransition.mockReturnValue([false, vi.fn()]);
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useRef.mockReturnValue({ current: new Map() });
  const html = renderToStaticMarkup(createElement(RevisoesCorrecaoAula, { matriculaId: "matricula", dados: {
    usuarioId: "outro-financeiro", candidatas: [], revisoes: [{
      id: "revisao", versao: 2, tipo: "SEM_ALTERACAO_VALORES", motivo: "Conferência da reserva consumida.", criadaEm: new Date(),
      propostaCorrecaoAulaId: "q23", fotografiaHash: "a".repeat(64), preparador: { id: "fin", nome: "Preparador" },
      decisao: null, podeDecidir: true,
      propostaCorrecaoAula: { versao: 3, autorId: "professor", entradaHash: "b".repeat(64), encontro: { id: "encontro", inicio: new Date("2026-09-18T12:00:00Z"), fim: new Date("2026-09-18T12:01:00Z"), fusoOrigem: "UTC" } },
      fotografia: {
        fundamento: { participacaoAnterior: "PRESENTE", participacaoProposta: "FALTA", minutosEquivalentes: 1, valorPreservado: 1.67, moeda: "CRC", politica: "Q92_RESERVA_CONSUMIDA_SEM_DELTA", fonte: "DIARIO_REALIZADO" },
        ocorrencia: null, conferencia: null,
        reservaConsumida: { id: "reserva", consumoId: "consumo", minutos: 1, fonte: "DIARIO_REALIZADO", conferenciaOcorrenciaId: null },
        compraAntecipada: { id: "compra", cobrancaId: "cobranca", minutosComprados: 180, valorPagoAlocado: 300, moeda: "CRC" },
        condicoes: { id: "condicoes", versao: 1, documentoId: "contrato", regras: {} },
        cobranca: { id: "cobranca", status: "PAGO", valorNegociado: 300, valorRecebido: 300, saldo: 0, moeda: "CRC", valorLiquidadoCredito: 0, valorCompensadoPermuta: 0 },
        informesPagamento: [], recebimentos: [{ id: "recebimento", valor: 300, moeda: "CRC" }], destinacoes: [{ id: "destino", tipo: "COBRANCA", valor: 300 }],
      },
    }],
  } as never }));
  expect(html).toContain("Reserva consumida reserva");
  expect(html).toContain("valor preservado 1.67 CRC");
  expect(html).toContain("Condições contratuais v1");
  expect(html).toContain("Aprovar sem alteração de valores");
});

it("não oferece aprovação quando a fotografia histórica é incompatível, mas mantém a rejeição", () => {
  mocks.useTransition.mockReturnValue([false, vi.fn()]);
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useRef.mockReturnValue({ current: new Map() });
  const html = renderToStaticMarkup(createElement(RevisoesCorrecaoAula, { matriculaId: "matricula", dados: {
    usuarioId: "outro-financeiro", candidatas: [], revisoes: [{
      id: "revisao-invalida", versao: 1, tipo: "SEM_ALTERACAO_VALORES", motivo: "Memória antiga.", criadaEm: new Date(),
      propostaCorrecaoAulaId: "q23", fotografiaHash: "a".repeat(64), fotografia: {}, preparador: { id: "fin", nome: "Preparador" },
      decisao: null, podeDecidir: true,
      propostaCorrecaoAula: { versao: 1, autorId: "professor", entradaHash: "b".repeat(64), encontro: { id: "encontro", inicio: new Date("2026-09-18T12:00:00Z"), fim: new Date("2026-09-18T12:01:00Z"), fusoOrigem: "UTC" } },
    }],
  } as never }));
  expect(html).toContain("Fotografia histórica indisponível");
  expect(html).toContain("Rejeitar revisão incompleta");
  expect(html).not.toContain("Aprovar sem alteração de valores");
});
