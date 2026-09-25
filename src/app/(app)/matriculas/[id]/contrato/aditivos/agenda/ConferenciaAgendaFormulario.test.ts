import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), registrar: vi.fn(), useState: vi.fn(), useTransition: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...(await importOriginal<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarConferenciaAgendaAditivo: mocks.consultar, registrarPropostaAgendaAditivo: mocks.registrar }));
import { ConferenciaAgendaFormulario, RegistrarFotografia } from "./ConferenciaAgendaFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

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

it("registra a fotografia conferida e mantém o vínculo contratual em etapa separada", async () => {
  const setMensagem = vi.fn(), setId = vi.fn();
  mocks.useState.mockReset().mockReturnValueOnce(["", setMensagem]).mockReturnValueOnce([null, setId]).mockReturnValueOnce(["chave-q117", vi.fn()]);
  mocks.useTransition.mockReset().mockReturnValue([false, (callback: () => void) => callback()]);
  mocks.registrar.mockResolvedValue({ ok: true, dado: { id: "foto-q117" } });
  const resultado = { proposta: { encontros: [{ encontroId: "e", professorAnteriorId: "anterior", professorNovoId: "novo", professorAnteriorNome: "Anterior", professorNovoNome: "Novo", inicioAnterior: "2099-10-10T10:00:00.000Z", fimAnterior: "2099-10-10T11:00:00.000Z", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", fusoAnterior: "UTC", fusoNovo: "UTC", duracaoMinutos: 60 }] }, pendencias: [] };
  const arvore = RegistrarFotografia({ matriculaId: "m", resultado });
  const botao = encontrar(arvore, "button")!.props!;
  await (botao.onClick as () => void)(); await Promise.resolve();
  expect(mocks.registrar).toHaveBeenCalledWith({ matriculaId: "m", chaveIdempotencia: "chave-q117", encontros: [{ encontroId: "e", professorNovoId: "novo", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] });
  expect(setId).toHaveBeenCalledWith("foto-q117");
});

it("preserva a chave ao falhar para que a repetição consulte a mesma tentativa", async () => {
  const setMensagem = vi.fn();
  mocks.useState.mockReset().mockReturnValueOnce(["", setMensagem]).mockReturnValueOnce([null, vi.fn()]).mockReturnValueOnce(["chave-q117", vi.fn()]);
  mocks.useTransition.mockReset().mockReturnValue([true, (callback: () => void) => callback()]);
  mocks.registrar.mockRejectedValue(new Error("rede"));
  const resultado = { proposta: { encontros: [{ encontroId: "e", professorAnteriorId: "anterior", professorNovoId: "novo", professorAnteriorNome: "Anterior", professorNovoNome: "Novo", inicioAnterior: "2099-10-10T10:00:00.000Z", fimAnterior: "2099-10-10T11:00:00.000Z", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", fusoAnterior: "UTC", fusoNovo: "UTC", duracaoMinutos: 60 }] }, pendencias: [] };
  const botao = encontrar(RegistrarFotografia({ matriculaId: "m", resultado }), "button")!.props!;
  expect(botao.disabled).toBe(true);
  await (botao.onClick as () => void)(); await Promise.resolve();
  expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ chaveIdempotencia: "chave-q117" }));
  expect(setMensagem).toHaveBeenCalledWith(MSG_RESULTADO_INCERTO);
});
