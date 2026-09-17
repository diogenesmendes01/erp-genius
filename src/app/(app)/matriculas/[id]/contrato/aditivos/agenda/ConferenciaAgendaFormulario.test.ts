import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), useState: vi.fn(), useTransition: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...(await importOriginal<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarConferenciaAgendaAditivo: mocks.consultar }));
import { ConferenciaAgendaFormulario } from "./ConferenciaAgendaFormulario";

type No = { props?: Record<string, unknown> };
const encontrar = (no: unknown, tipo: string): No | undefined => {
  if (Array.isArray(no)) { for (const filho of no) { const achado = encontrar(filho, tipo); if (achado) return achado; } return undefined; }
  if (no && typeof no === "object") { const atual = no as No & { type?: unknown }; if (atual.type === tipo) return atual; const filhos = atual.props?.children; for (const filho of Array.isArray(filhos) ? filhos : [filhos]) { const achado = encontrar(filho, tipo); if (achado) return achado; } }
  return undefined;
};
const dados = { "professor-e": "atual", "fuso-e": "UTC", "inicio-e": "2099-10-11T10:00", "fim-e": "2099-10-11T11:00" };
const montar = (pendente = false) => {
  const setSelecionados = vi.fn(), setResultado = vi.fn(), setMensagem = vi.fn();
  mocks.useState.mockReset().mockReturnValueOnce([["e"], setSelecionados]).mockReturnValueOnce([null, setResultado]).mockReturnValueOnce(["", setMensagem]);
  mocks.useTransition.mockReset().mockReturnValue([pendente, (callback: () => void) => callback()]);
  const arvore = ConferenciaAgendaFormulario({ matriculaId: "m", encontros: [{ id: "e", inicio: "2099-10-10T10:00:00.000Z", fim: "2099-10-10T11:00:00.000Z", fusoOrigem: "UTC", professorId: "atual", professor: "Atual" }], professores: [{ id: "primeiro", nome: "Primeiro" }, { id: "atual", nome: "Atual" }] });
  return { form: encontrar(arvore, "form")!.props!, fieldset: encontrar(arvore, "fieldset")!.props!, select: encontrar(arvore, "select")!.props!, setResultado, setMensagem };
};

afterEach(() => vi.unstubAllGlobals());

it("submete o docente atual, apaga resultado ao editar e bloqueia controles pendentes", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: { proposta: { encontros: [] }, pendencias: [] } });
  vi.stubGlobal("FormData", class { get(nome: string) { return dados[nome as keyof typeof dados] ?? null; } });
  const componente = montar();
  expect(componente.select.defaultValue).toBe("atual");
  await (componente.form.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} });
  await Promise.resolve();
  expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "m", encontros: [{ encontroId: "e", professorNovoId: "atual", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] });
  (componente.form.onChange as () => void)();
  expect(componente.setResultado).toHaveBeenLastCalledWith(null);
  expect(montar(true).fieldset.disabled).toBe(true);
});

it("não chama o servidor quando o horário DST é inválido", () => {
  mocks.consultar.mockReset();
  vi.stubGlobal("FormData", class { get(nome: string) { return { ...dados, "fuso-e": "America/New_York", "inicio-e": "2026-03-08T02:30" }[nome as keyof typeof dados] ?? null; } });
  const componente = montar();
  (componente.form.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} });
  expect(mocks.consultar).not.toHaveBeenCalled();
  expect(componente.setMensagem).toHaveBeenCalledWith("Informe datas, horários e fuso válidos.");
});
