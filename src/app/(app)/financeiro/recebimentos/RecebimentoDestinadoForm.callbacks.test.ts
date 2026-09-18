import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ registrar: vi.fn(), useState: vi.fn(), useRef: vi.fn(), useMemo: vi.fn() }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), useState: mocks.useState, useRef: mocks.useRef, useMemo: mocks.useMemo }));
vi.mock("@/server/financeiro/acoes", () => ({ registrarRecebimentoDestinado: mocks.registrar }));
vi.mock("@/components/UploadArquivo", () => ({ UploadArquivo: () => null }));
import { FormaPagamento } from "@prisma/client";
import { RecebimentoDestinadoForm } from "./RecebimentoDestinadoForm";

type No = { type?: unknown; props?: Record<string, unknown> };
const contextos = [
  { matriculaId: "mat-1", status: "ATIVA", aluno: "Ana", moeda: "CRC", cobrancas: [{ id: "c-jan", codigo: "JAN", tipo: "MENSALIDADE", vencimento: "2026-01-05T00:00:00.000Z", saldo: 100 }], pagadores: [{ id: "pag-1", rotulo: "Responsável" }] },
  { matriculaId: "mat-2", status: "ATIVA", aluno: "Bia", moeda: "USD", cobrancas: [{ id: "c-fev", codigo: "FEV", tipo: "MENSALIDADE", vencimento: "2026-02-05T00:00:00.000Z", saldo: 80 }], pagadores: [{ id: "pag-2", rotulo: "Outra responsável" }] },
];
function nos(no: unknown): No[] { if (Array.isArray(no)) return no.flatMap(nos); if (!no || typeof no !== "object") return []; const atual = no as No; return [atual, ...nos(atual.props?.children)]; }
function textos(no: unknown): string[] { if (typeof no === "string") return [no]; if (Array.isArray(no)) return no.flatMap(textos); if (!no || typeof no !== "object") return []; return textos((no as No).props?.children); }
function encontrar(no: unknown, predicado: (no: No) => boolean) { const encontrado = nos(no).find(predicado); if (!encontrado) throw new Error("Elemento não encontrado"); return encontrado; }
function montar(estados: unknown[]) {
  const setters = estados.map(() => vi.fn());
  mocks.useState.mockReset();
  estados.forEach((valor, indice) => mocks.useState.mockReturnValueOnce([valor, setters[indice]]));
  mocks.useMemo.mockImplementation((calcular: () => unknown) => calcular());
  const chave = { current: "00000000-0000-4000-8000-000000000087" };
  const emEnvio = { current: false };
  mocks.useRef.mockReset().mockReturnValueOnce(chave).mockReturnValueOnce(emEnvio);
  const arvore = RecebimentoDestinadoForm({ contextos });
  return { arvore, setters, chave, emEnvio };
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

it("exige seleção explícita e limpa destinos e pagador ao trocar de contrato", () => {
  const c = montar(["mat-1", [{ cobrancaId: "c-jan", valor: "100", evidencia: "boleto" }], "0", "100", "pag-1", FormaPagamento.DINHEIRO, "2026-01-05", "", "", "/api/files/contrato-1", "contrato-1.pdf", false, null, null, false]);
  const seletor = encontrar(c.arvore, (no) => no.type === "select" && no.props?.["aria-label"] === "Contrato");
  (seletor.props!.onChange as (event: { target: { value: string } }) => void)({ target: { value: "mat-2" } });
  expect(c.setters[0]).toHaveBeenCalledWith("mat-2");
  expect(c.setters[1]).toHaveBeenCalledWith([]);
  expect(c.setters[2]).toHaveBeenCalledWith("");
  expect(c.setters[4]).toHaveBeenCalledWith("");
  expect(c.setters[9]).toHaveBeenCalledWith("");
  expect(c.setters[10]).toHaveBeenCalledWith("");

  const semSelecao = montar(["", [], "0", "100", "", FormaPagamento.DINHEIRO, "2026-01-05", "", "", "", "", false, null, null, false]);
  const botao = encontrar(semSelecao.arvore, (no) => no.type === "button" && no.props?.children === "Confirmar recebimento");
  expect(botao.props!.disabled).toBe(true);
});

it("calcula totais em centavos e confirma múltipla destinação com crédito", async () => {
  mocks.registrar.mockResolvedValue({ ok: true });
  const c = montar(["mat-1", [{ cobrancaId: "c-jan", valor: "0,10", evidencia: "Parcela janeiro" }], "0.20", "0.30", "pag-1", FormaPagamento.DINHEIRO, "2026-01-05", "Antecipação", "Observação", "", "", false, null, null, false]);
  const botao = encontrar(c.arvore, (no) => no.type === "button" && no.props?.children === "Confirmar recebimento");
  expect(botao.props!.disabled).toBe(false);
  await (botao.props!.onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({
    titularMatriculaId: "mat-1", pagadorId: "pag-1", valorRecebido: 0.3, moeda: "CRC", forma: FormaPagamento.DINHEIRO,
    chaveIdempotencia: c.chave.current,
    destinos: [
      { tipo: "COBRANCA", cobrancaId: "c-jan", valor: 0.1, evidencia: "Parcela janeiro", chaveIdempotencia: "cobranca:c-jan" },
      { tipo: "CREDITO_SEM_DESTINO", valor: 0.2, evidencia: "Antecipação", chaveIdempotencia: "credito-sem-destino" },
    ],
  }));
});

it("identifica matrícula em preparação e permite antecipação sem cobrança", async () => {
  mocks.registrar.mockResolvedValue({ ok: true });
  const emPreparacao = [{ ...contextos[0], matriculaId: "mat-preparacao", status: "AGUARDANDO", cobrancas: [] }];
  const setters = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  mocks.useState.mockReset();
  ["mat-preparacao", [], "125", "125", "", FormaPagamento.DINHEIRO, "2026-09-18", "Acordo de antecipação", "", "", "", false, null, null, false].forEach((valor, indice) => mocks.useState.mockReturnValueOnce([valor, setters[indice]]));
  mocks.useMemo.mockImplementation((calcular: () => unknown) => calcular());
  const chave = { current: "00000000-0000-4000-8000-000000000087" };
  mocks.useRef.mockReset().mockReturnValueOnce(chave).mockReturnValueOnce({ current: false });
  const arvore = RecebimentoDestinadoForm({ contextos: emPreparacao });
  expect(textos(arvore).join(" ")).toContain("em preparação");
  expect(textos(arvore).join(" ")).toContain("O recebimento não ativa o contrato.");
  const botao = encontrar(arvore, (no) => no.type === "button" && no.props?.children === "Confirmar recebimento");
  await (botao.props!.onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ titularMatriculaId: "mat-preparacao", valorRecebido: 125, destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 125, evidencia: "Acordo de antecipação", chaveIdempotencia: "credito-sem-destino" }] }));
});

it("mantém a mesma chave ao repetir upload que falhou, sem permitir envio concorrente", async () => {
  mocks.registrar.mockRejectedValueOnce(new Error("upload indisponível")).mockResolvedValueOnce({ ok: true });
  const c = montar(["mat-1", [], "100", "100", "", FormaPagamento.TRANSFERENCIA, "2026-01-05", "Comprovante bancário", "", "/api/files/comprovante", "comprovante.pdf", false, null, null, false]);
  const botao = encontrar(c.arvore, (no) => no.type === "button" && no.props?.children === "Confirmar recebimento");
  await (botao.props!.onClick as () => Promise<void>)();
  await (botao.props!.onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenCalledTimes(2);
  expect(mocks.registrar.mock.calls[0][0].chaveIdempotencia).toBe(mocks.registrar.mock.calls[1][0].chaveIdempotencia);
  expect(mocks.registrar.mock.calls[0][0]).toMatchObject({ comprovanteUrl: "/api/files/comprovante", comprovanteNome: "comprovante.pdf", destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 100 }] });
  expect(c.setters[14]).toHaveBeenCalledWith(true);
  c.emEnvio.current = true;
  await (botao.props!.onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenCalledTimes(2);
});

it("bloqueia edição de operação incerta ou concluída e fornece novo lançamento explícito", () => {
  const incerta = montar(["mat-1", [], "100", "100", "", FormaPagamento.DINHEIRO, "2026-01-05", "", "", "", "", false, "Falha de rede", null, true]);
  const fieldsetIncerto = encontrar(incerta.arvore, (no) => no.type === "fieldset");
  expect(fieldsetIncerto.props!.disabled).toBe(true);
  expect(encontrar(incerta.arvore, (no) => no.type === "button" && no.props?.children === "Tentar novamente").props!.disabled).toBe(false);

  const concluida = montar(["mat-1", [], "100", "100", "", FormaPagamento.DINHEIRO, "2026-01-05", "", "", "", "", false, null, "Recebimento confirmado.", false]);
  expect(encontrar(concluida.arvore, (no) => no.type === "fieldset").props!.disabled).toBe(true);
  const novo = encontrar(concluida.arvore, (no) => no.type === "button" && no.props?.children === "Novo lançamento");
  (novo.props!.onClick as () => void)();
  expect(concluida.setters[0]).toHaveBeenCalledWith("");
  expect(concluida.setters[9]).toHaveBeenCalledWith("");
  expect(concluida.setters[13]).toHaveBeenCalledWith(null);
});
