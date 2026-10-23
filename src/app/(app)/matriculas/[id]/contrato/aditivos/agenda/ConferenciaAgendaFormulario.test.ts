import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Ganchos de src/test/tela-sem-dom.ts no lugar do React: seleção, resultado e chave vivem no estado
// entre renders (inclusive o do useAcaoCliente), e os controles são acionados como na tela.
const mocks = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, consultar: vi.fn(), registrar: vi.fn() }));
vi.mock("react", async importOriginal => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => mocks.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => mocks.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("@/server/contratos/agenda-aditivo", () => ({ registrarPropostaAgendaAditivo: mocks.registrar }));
// Lote 3 do fuso pessoal: a conferência manda o texto digitado e o fuso; quem converte é o servidor.
vi.mock("@/server/contratos/agenda-aditivo-local", () => ({ consultarConferenciaAgendaAditivoLocal: mocks.consultar }));
import { ConferenciaAgendaFormulario, RegistrarFotografia } from "./ConferenciaAgendaFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { adiada, anuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

const dados = { "professor-e": "atual", "fuso-e": "UTC", "inicio-e": "2099-10-11T10:00", "fim-e": "2099-10-11T11:00" };
const props = { matriculaId: "m", encontros: [{ id: "e", inicio: "2099-10-10T10:00:00.000Z", fim: "2099-10-10T11:00:00.000Z", fusoOrigem: "UTC", professorId: "atual", professor: "Atual" }], professores: [{ id: "primeiro", nome: "Primeiro" }, { id: "atual", nome: "Atual" }] };
const tela = () => mocks.ganchos!.renderizar(ConferenciaAgendaFormulario, props);
const no = (tipo: string) => elementos(tela()).find(n => n.type === tipo)!;
/** Marca o encontro "e" (checkbox) e devolve a tela já com os campos do encontro. */
const selecionar = () => { (elementos(tela()).find(n => n.type === "input" && n.props.type === "checkbox")!.props.onChange as () => void)(); return tela(); };
const temResultado = () => elementos(tela()).some(n => n.type === "h3" && texto(n.props.children) === "Resultado da conferência");
const resultado = { proposta: { encontros: [{ encontroId: "e", professorAnteriorId: "anterior", professorNovoId: "novo", professorAnteriorNome: "Anterior", professorNovoNome: "Novo", inicioAnterior: "2099-10-10T10:00:00.000Z", fimAnterior: "2099-10-10T11:00:00.000Z", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", fusoAnterior: "UTC", fusoNovo: "UTC", duracaoMinutos: 60 }] }, pendencias: [] };
const telaFoto = () => mocks.ganchos!.renderizar(RegistrarFotografia, { matriculaId: "m", resultado });
const botaoFoto = () => elementos(telaFoto()).find(n => n.type === "button")!.props;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  vi.stubGlobal("crypto", { randomUUID: () => "chave-q117" });
});
afterEach(() => vi.unstubAllGlobals());

it("submete o docente atual, apaga resultado ao editar e bloqueia controles pendentes", async () => {
  const comCampos = selecionar();
  expect(elementos(comCampos).find(n => n.type === "select")!.props.defaultValue).toBe("atual");
  const pendente = adiada<unknown>();
  mocks.consultar.mockReturnValueOnce(pendente.promessa);
  const envio = submeter(comCampos, dados);
  expect(no("fieldset").props.disabled).toBe(true);
  pendente.resolver({ ok: true, dado: { proposta: { encontros: [] }, pendencias: [] } });
  await envio;
  expect(no("fieldset").props.disabled).toBe(false);
  expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "m", alteracoes: [{ encontroId: "e", professorNovoId: "atual", fusoOrigem: "UTC", inicioLocal: "2099-10-11T10:00", fimLocal: "2099-10-11T11:00" }] });
  expect(temResultado()).toBe(true);
  (no("form").props.onChange as () => void)();
  expect(temResultado()).toBe(false);
});

it("horário DST inválido: o servidor converte e recusa com a mensagem dele; campo vazio nem chama o servidor", async () => {
  mocks.consultar.mockResolvedValueOnce({ ok: false, erro: "Esse horário não existe em America/New_York (mudança de horário de verão); escolha outro." });
  await submeter(selecionar(), { ...dados, "fuso-e": "America/New_York", "inicio-e": "2026-03-08T02:30" });
  expect(mocks.consultar).toHaveBeenCalledWith(expect.objectContaining({ alteracoes: [expect.objectContaining({ fusoOrigem: "America/New_York", inicioLocal: "2026-03-08T02:30" })] }));
  expect(anuncios(tela()).alerta).toEqual(["Esse horário não existe em America/New_York (mudança de horário de verão); escolha outro."]);
  mocks.consultar.mockClear();
  await submeter(selecionar(), { ...dados, "inicio-e": "" });
  expect(mocks.consultar).not.toHaveBeenCalled();
});

it("valor inicial dos campos no fuso do encontro, sem lançar com fuso inválido", () => {
  const comFuso = (fusoOrigem: string) => { mocks.ganchos = criarGanchos(); return elementos(mocks.ganchos.renderizar(ConferenciaAgendaFormulario, { ...props, encontros: [{ ...props.encontros[0], fusoOrigem }] })); };
  const inicioInicial = (fusoOrigem: string) => { const nos = comFuso(fusoOrigem); (nos.find(n => n.type === "input" && n.props.type === "checkbox")!.props.onChange as () => void)(); return elementos(mocks.ganchos!.renderizar(ConferenciaAgendaFormulario, { ...props, encontros: [{ ...props.encontros[0], fusoOrigem }] })).find(n => n.props.name === "inicio-e")?.props.defaultValue; };
  expect(inicioInicial("America/Sao_Paulo")).toBe("2099-10-10T07:00");
  expect(inicioInicial("UTC")).toBe("2099-10-10T10:00");
});

it("registra a fotografia conferida e mantém o vínculo contratual em etapa separada", async () => {
  mocks.registrar.mockResolvedValueOnce({ ok: true, dado: { id: "foto-q117" } });
  await (botaoFoto().onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenCalledWith({ matriculaId: "m", chaveIdempotencia: "chave-q117", encontros: [{ encontroId: "e", professorNovoId: "novo", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] });
  expect(elementos(telaFoto()).find(n => typeof n.props.href === "string")!.props.href).toBe("/matriculas/m/contrato/aditivos?agenda=foto-q117");
});

it("preserva a chave ao falhar para que a repetição consulte a mesma tentativa", async () => {
  const pendente = adiada<unknown>();
  mocks.registrar.mockReturnValueOnce(pendente.promessa);
  const envio = (botaoFoto().onClick as () => Promise<void>)();
  expect(botaoFoto().disabled).toBe(true);
  pendente.rejeitar(new Error("rede")); await envio;
  expect(anuncios(telaFoto()).alerta).toEqual([MSG_RESULTADO_INCERTO]);
  mocks.registrar.mockResolvedValueOnce({ ok: true, dado: { id: "foto-q117" } });
  await (botaoFoto().onClick as () => Promise<void>)();
  expect(mocks.registrar).toHaveBeenNthCalledWith(1, expect.objectContaining({ chaveIdempotencia: "chave-q117" }));
  expect(mocks.registrar.mock.calls[1][0]).toEqual(mocks.registrar.mock.calls[0][0]);
});
