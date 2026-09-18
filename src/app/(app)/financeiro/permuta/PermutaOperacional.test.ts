import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({

  preparar: vi.fn(), confirmar: vi.fn(), propor: vi.fn(), decidir: vi.fn(),

  refresh: vi.fn(), useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn(),

}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));

vi.mock("@/server/financeiro/permuta-servico", () => ({

  prepararAcordoPermuta: mocks.preparar,

  confirmarServicoPermuta: mocks.confirmar,

  proporCompensacaoPermuta: mocks.propor,

  decidirCompensacaoPermuta: mocks.decidir,

}));

import { PermutaOperacional } from "./PermutaOperacional";

type No = { type?: unknown; props?: Record<string, unknown> };

function todos(no: unknown, tipo: string): No[] {

  if (Array.isArray(no)) return no.flatMap(item => todos(item, tipo));

  if (!no || typeof no !== "object") return [];

  const atual = no as No;

  if (typeof atual.type === "function") return todos((atual.type as (props: Record<string, unknown>) => unknown)(atual.props ?? {}), tipo);

  const filhos = atual.props?.children;

  return [...(atual.type === tipo ? [atual] : []), ...todos(Array.isArray(filhos) ? filhos : [filhos], tipo)];

}

const acordos = [{ id: "acordo", matriculaId: "matricula", matricula: "M-1", moeda: "BRL", unidade: "HORA", quantidadePactuada: "2.00", valorPorUnidade: "50.00", valorTotalPactuado: "100.00", contrapartida: "Serviço pedagógico comprovado", formulaDescricao: "2 horas x 50", cobrancas: [{ id: "cobranca", codigo: "C-1", saldo: "100.00", valorMaximo: "100.00" }], confirmacoes: [{ id: "confirmacao", periodoInicio: "2026-09-01", periodoFim: "2026-09-30", quantidadeComprovada: "2.00", referenciaServico: "SET-1", evidencia: "registro de serviço", propostas: [{ id: "proposta", valor: "100.00", destinos: [{ cobrancaId: "cobranca", valor: "100.00" }], decisao: null }] }] }];

function preparar() {

  mocks.useState.mockReturnValue([null, vi.fn()]);

  mocks.useTransition.mockReturnValue([false, (callback: () => void) => callback()]);

  mocks.useRef.mockImplementation((valor: unknown) => ({ current: valor }));

  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("chave-nova") });

}

function dados(valores: Record<string, string>) {

  vi.stubGlobal("FormData", class { valores = valores; get(nome: string) { return this.valores[nome] ?? null; } set(nome: string, valor: string) { this.valores[nome] = valor; } });

}

async function enviar(formulario: No) {

  await (formulario.props!.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => unknown)({ preventDefault: vi.fn(), currentTarget: { reset: vi.fn() } });

  await Promise.resolve(); await Promise.resolve();

}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("mantém chave e entrada para retry quando o acordo falha", async () => {

  preparar();

  dados({ matriculaId: "matricula", vigenciaInicio: "2026-09-01", vigenciaFim: "2026-12-31", moeda: "BRL", unidade: "HORA", quantidadePactuada: "2", valorPorUnidade: "50", contrapartida: "Serviço pedagógico comprovado", formulaDescricao: "2 horas x 50", cobrancaId: "cobranca", valorMaximo: "100" });

  mocks.preparar.mockResolvedValueOnce({ ok: false, erro: "Sem capacidade financeira." }).mockResolvedValueOnce({ ok: true });

  const formulario = todos(PermutaOperacional({ acordos, podeFinanceiro: true, podePedagogico: true, podeAprovar: true }), "form")[0];

  await enviar(formulario);
  dados({ matriculaId: "outra-matricula", valorPorUnidade: "999" });
  await enviar(formulario);

  expect(mocks.preparar).toHaveBeenNthCalledWith(1, expect.objectContaining({ chaveIdempotencia: "chave-nova", matriculaId: "matricula" }));

  expect(mocks.preparar).toHaveBeenNthCalledWith(2, expect.objectContaining({ chaveIdempotencia: "chave-nova", matriculaId: "matricula" }));

});

it("submete confirmação, proposta e decisão com os destinos explícitos", async () => {

  preparar();

  dados({ periodoInicio: "2026-09-01", periodoFim: "2026-09-30", quantidadeComprovada: "2", referenciaServico: "SET-2", evidencia: "diário", "destino:cobranca": "100", aprovar: "sim", motivo: "Condições conferidas" });

  mocks.confirmar.mockResolvedValue({ ok: true }); mocks.propor.mockResolvedValue({ ok: true }); mocks.decidir.mockResolvedValue({ ok: true });

  const formularios = todos(PermutaOperacional({ acordos, podeFinanceiro: true, podePedagogico: true, podeAprovar: true }), "form");

  await enviar(formularios[1]); await enviar(formularios[2]); await enviar(formularios[3]);

  expect(mocks.confirmar).toHaveBeenCalledWith(expect.objectContaining({ acordoId: "acordo", chaveIdempotencia: "chave-nova" }));

  expect(mocks.propor).toHaveBeenCalledWith(expect.objectContaining({ confirmacaoId: "confirmacao", destinos: [{ cobrancaId: "cobranca", valor: "100" }] }));

  expect(mocks.decidir).toHaveBeenCalledWith({ propostaId: "proposta", aprovar: true, motivo: "Condições conferidas" });

});

it("restringe formulários de acordo com as capacidades", () => {

  preparar();

  expect(todos(PermutaOperacional({ acordos, podeFinanceiro: false, podePedagogico: true, podeAprovar: false }), "form")).toHaveLength(1);

  expect(todos(PermutaOperacional({ acordos, podeFinanceiro: true, podePedagogico: false, podeAprovar: false }), "form")).toHaveLength(2);

});

it("distribui a proposta entre várias cobranças e omite as não selecionadas", async () => {
  preparar();
  dados({ "destino:cobranca": "40", "destino:segunda": "60" });
  mocks.propor.mockResolvedValue({ ok: true });
  const conjunto = [{ ...acordos[0], cobrancas: [...acordos[0].cobrancas, { ...acordos[0].cobrancas[0], id: "segunda" }, { ...acordos[0].cobrancas[0], id: "terceira" }] }];
  const formularios = todos(PermutaOperacional({ acordos: conjunto, podeFinanceiro: true, podePedagogico: false, podeAprovar: false }), "form");
  await enviar(formularios[1]);
  expect(mocks.propor).toHaveBeenCalledWith(expect.objectContaining({ destinos: [{ cobrancaId: "cobranca", valor: "40" }, { cobrancaId: "segunda", valor: "60" }] }));
});

it("permite corrigir entrada rejeitada com confirmação de que não foi aplicada", async () => {
  preparar();
  let chave = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `chave-${++chave}` });
  dados({ matriculaId: "matricula-invalida" });
  mocks.preparar.mockResolvedValueOnce({ ok: false, erro: "Dados inválidos", podeRevisar: true }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(PermutaOperacional({ acordos, podeFinanceiro: true, podePedagogico: false, podeAprovar: false }), "form")[0];
  await enviar(formulario);
  dados({ matriculaId: "matricula-corrigida" });
  await enviar(formulario);
  expect(mocks.preparar.mock.calls[0][0].matriculaId).toBe("matricula-invalida");
  expect(mocks.preparar.mock.calls[1][0].matriculaId).toBe("matricula-corrigida");
  expect(mocks.preparar.mock.calls[1][0].chaveIdempotencia).not.toBe(mocks.preparar.mock.calls[0][0].chaveIdempotencia);
});
