import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ destinacoes: vi.fn(), usos: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "fin", papeis: ["FINANCEIRO"], permissoes: [] })) }));
vi.mock("@/server/matricula/excedente-permuta-destinacao", () => ({ consultarDestinacoesExcedentePermuta: mocks.destinacoes }));
vi.mock("@/server/matricula/saldo-servico-permuta-uso", () => ({ consultarUsosSaldoServicoPermuta: mocks.usos }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: vi.fn(async () => ({ ok: true, dado: { fusoExibicao: "UTC" } })) }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: vi.fn(async () => null) }));
vi.mock("./Formulario", () => ({ ExcedenteFormulario: ({ modo, cobrancaId }: { modo: string; cobrancaId?: string }) => `formulario=${modo}:${cobrancaId ?? ""}` }));
import Pagina from "./page";

type Origem = { id: string; tipo: string; valor: string; usoSaldo: boolean };
const cobranca = (id: string, quitada: boolean, origens: Origem[]) => ({ id, tipo: "MENSALIDADE", versao: 1, moeda: "CRC", status: quitada ? "PAGO" : "PENDENTE", vencimento: "2099-10-01",
  valorNegociado: "100.00", liquidado: quitada ? "100.00" : "50.00", permuta: "50.00", emAndamento: false, destinada: false, quitada, fontes: { prontas: true, pendencias: [], origens } });
const render = async (cobrancas: unknown[]) => {
  mocks.destinacoes.mockResolvedValue({ ok: true, dado: { matriculaId: "m1", cobrancas, propostas: [], saldosServico: [] } });
  return renderToStaticMarkup(await Pagina({ params: Promise.resolve({ matriculaId: "m1" }) }));
};
beforeEach(() => { vi.clearAllMocks(); mocks.usos.mockResolvedValue({ ok: true, dado: { saldos: [], propostas: [] } }); });

// C7 da R2 da #283: a ação já recusa (B1 e B3 da R1 rigorosa); a tela não oferece o formulário nesses casos e diz por quê.
it("cobrança quitada com permuta propriamente dita oferece a preparação", async () => {
  const html = await render([cobranca("c1", true, [{ id: "a1", tipo: "CAIXA", valor: "50.00", usoSaldo: false }, { id: "a2", tipo: "PERMUTA", valor: "50.00", usoSaldo: false }])]);
  expect(html).toContain("formulario=preparar:c1");
});

it("cobrança em aberto não oferece a preparação e explica o motivo", async () => {
  const html = await render([cobranca("c2", false, [{ id: "a3", tipo: "PERMUTA", valor: "50.00", usoSaldo: false }])]);
  expect(html).not.toContain("formulario=preparar");
  expect(html).toContain("A cobrança ainda está em aberto");
});

it("cobrança cuja única fonte de serviço é uso do saldo não oferece a preparação e explica o motivo", async () => {
  const html = await render([cobranca("c3", true, [{ id: "a4", tipo: "CAIXA", valor: "50.00", usoSaldo: false }, { id: "a5", tipo: "PERMUTA", valor: "50.00", usoSaldo: true }])]);
  expect(html).not.toContain("formulario=preparar");
  expect(html).toContain("veio do saldo de serviços, que não gera excedente");
  expect(html).toContain("Serviço (uso do saldo de serviços)");
});
