import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42, E3): erro e sucesso separados na conferência de
// agenda do aditivo — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, consultar: vi.fn(), registrar: vi.fn() }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarConferenciaAgendaAditivo: m.consultar, registrarPropostaAgendaAditivo: m.registrar }));

import { ConferenciaAgendaFormulario, RegistrarFotografia } from "./ConferenciaAgendaFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { adiada, anuncios, contratoFeedbackSeparado, novosAnuncios, type Adiada } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const botaoOcupado = (t: ReactNode, rotulo: string) =>
  elementos(t).some((n) => n.type === "button" && texto(n.props.children).trim() === rotulo && n.props.disabled === true);

describe("ConferenciaAgendaFormulario", () => {
  const props = { matriculaId: "m", encontros: [{ id: "e", inicio: "2099-10-10T10:00:00.000Z", fim: "2099-10-10T11:00:00.000Z", fusoOrigem: "UTC", professorId: "atual", professor: "Atual" }], professores: [{ id: "atual", nome: "Atual" }] };
  const tela = () => m.ganchos!.renderizar(ConferenciaAgendaFormulario, props);
  const valores = { "professor-e": "atual", "fuso-e": "UTC", "inicio-e": "2099-10-11T10:00", "fim-e": "2099-10-11T11:00" };
  /** Marca o encontro e confere; devolve o que passou a ser anunciado. */
  const conferir = async () => {
    (elementos(tela()).find((n) => n.type === "input" && n.props.type === "checkbox")!.props.onChange as () => void)();
    const antes = anuncios(tela());
    await submeter(tela(), valores);
    return novosAnuncios(antes, anuncios(tela()));
  };
  const temResultado = () => elementos(tela()).some((n) => n.type === "h3" && texto(n.props.children) === "Resultado da conferência");

  it("erro do servidor sai em role=\"alert\", não em role=\"status\"", async () => {
    m.consultar.mockResolvedValueOnce({ ok: false, erro: "Docente indisponível no horário." });
    expect(await conferir()).toEqual({ alerta: ["Docente indisponível no horário."], status: [] });
    expect(temResultado()).toBe(false);
  });

  it("conferência sem dado: aviso em role=\"alert\"", async () => {
    m.consultar.mockResolvedValueOnce({ ok: true, dado: null });
    expect(await conferir()).toEqual({ alerta: ["Conferência indisponível."], status: [] });
  });

  it("falha de rede vira resultado incerto em role=\"alert\"", async () => {
    m.consultar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await conferir()).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
  });

  it("sucesso mostra o resultado, sem alerta", async () => {
    m.consultar.mockResolvedValueOnce({ ok: true, dado: { proposta: { encontros: [] }, pendencias: ["Docente em férias."] } });
    expect(await conferir()).toEqual({ alerta: [], status: [] });
    expect(temResultado()).toBe(true);
  });

  it("ocupado enquanto a consulta roda; sai do ocupado depois de erro, falha e sucesso", async () => {
    (elementos(tela()).find((n) => n.type === "input" && n.props.type === "checkbox")!.props.onChange as () => void)();
    expect(botaoOcupado(tela(), "Conferindo…")).toBe(false);
    const desfechos: [string, (p: Adiada<unknown>) => void][] = [
      ["erro", (p) => p.resolver({ ok: false, erro: "Docente indisponível no horário." })],
      ["falha", (p) => p.rejeitar(new TypeError("Failed to fetch"))],
      ["sucesso", (p) => p.resolver({ ok: true, dado: { proposta: { encontros: [] }, pendencias: [] } })],
    ];
    for (const [nome, concluir] of desfechos) {
      const pendente = adiada<unknown>();
      m.consultar.mockReturnValueOnce(pendente.promessa);
      const execucao = submeter(tela(), valores);
      expect(botaoOcupado(tela(), "Conferindo…"), `durante (${nome})`).toBe(true);
      concluir(pendente);
      await execucao;
      expect(botaoOcupado(tela(), "Conferindo…"), `depois (${nome})`).toBe(false);
    }
  });

  it("nenhum encontro marcado: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), valores);
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Selecione pelo menos um encontro para conferir."], status: [] });
    expect(m.consultar).not.toHaveBeenCalled();
  });
});

describe("RegistrarFotografia", () => {
  const resultado = { proposta: { encontros: [{ encontroId: "e", professorAnteriorId: "anterior", professorNovoId: "novo", professorAnteriorNome: "Anterior", professorNovoNome: "Novo", inicioAnterior: "2099-10-10T10:00:00.000Z", fimAnterior: "2099-10-10T11:00:00.000Z", inicioNovo: "2099-10-11T10:00:00.000Z", fimNovo: "2099-10-11T11:00:00.000Z", fusoAnterior: "UTC", fusoNovo: "UTC", duracaoMinutos: 60 }] }, pendencias: [] };
  const tela = () => m.ganchos!.renderizar(RegistrarFotografia, { matriculaId: "m", resultado });
  const acionar = () => (elementos(tela()).find((n) => n.type === "button")!.props.onClick as () => Promise<void>)();
  contratoFeedbackSeparado({
    nome: "registrar fotografia da agenda", tela, action: m.registrar, acionar,
    respostaOk: { ok: true, dado: { id: "foto" } },
    sucesso: "Fotografia registrada. A Secretaria deve vinculá-la à proposta contratual.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botaoOcupado(tela(), "Registrando…"),
  });
  it("registro sem fotografia devolvida: aviso em role=\"alert\", sem sucesso", async () => {
    const antes = anuncios(tela());
    m.registrar.mockResolvedValueOnce({ ok: true });
    await acionar();
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Fotografia indisponível. Repita sem editar para consultar a mesma tentativa."], status: [] });
  });
});
