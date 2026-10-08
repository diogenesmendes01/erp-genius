import { afterEach, beforeEach, expect, it, vi } from "vitest";
// Ganchos de src/test/tela-sem-dom.ts no lugar do React: modelo, ciclo e valores são escolhidos pelos
// controles da tela, e a chave/tentativa vivem no estado entre envios, como no navegador.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, preparar: vi.fn(), push: vi.fn() }));
vi.mock("react", async original => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    useId: (() => "teste") as unknown as typeof real.useId,
    useSyncExternalStore: (() => "UTC") as unknown as typeof real.useSyncExternalStore,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: vi.fn() }) }));
vi.mock("@/server/contratos/aditivos", () => ({ prepararAditivoContratual: m.preparar, decidirAditivoContratual: vi.fn() }));
import { PrepararAditivo } from "./Formularios";
import { ValorEstruturadoCampo } from "./ValorEstruturadoCampo";
import { anuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, type No } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

type Origem = "COBERTURA_INICIO" | "COBERTURA_FIM" | "ALUNO_NOME";
const VALORES: Record<Origem, unknown> = { COBERTURA_INICIO: { tipo: "DATA", data: "2026-11-01" }, COBERTURA_FIM: { tipo: "DATA", data: "2026-11-30" }, ALUNO_NOME: { tipo: "TEXT", texto: "Nome corrigido" } };

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  // A primeira chave nasce com o formulário; as seguintes só quando a tentativa muda de conteúdo.
  let chaves = 0;
  vi.stubGlobal("crypto", { randomUUID: () => (chaves++ === 0 ? "chave-original" : "chave-nova") });
  m.preparar.mockResolvedValue({ ok: true, dado: { id: "proposta" } });
});
afterEach(() => vi.unstubAllGlobals());

const mudar = (no: No, value: string) => (no.props.onChange as (e: unknown) => void)({ target: { value } });
/** O <select> que tem uma <option> com este valor. */
const selectCom = (t: ReactNode, opcao: string) =>
  elementos(t).find(n => n.type === "select" && elementos(n.props.children as ReactNode).some(o => o.type === "option" && o.props.value === opcao))!;

/** Monta o formulário, escolhe o modelo, a regra do ciclo (quando há cobertura) e os novos valores. */
function montar(escolha: string, cobertura = true) {
  const campos: Origem[] = cobertura ? ["COBERTURA_INICIO", "COBERTURA_FIM"] : ["ALUNO_NOME"];
  const props = { matriculaId: "matricula", fonte: { conclusaoId: "assinatura", conclusaoHash: "a".repeat(64), campos: campos.map(origem => ({ origem, rotulo: origem, anterior: "Anterior" })) }, modelos: [{ id: "modelo", codigo: "AD", versao: 1, modeloHash: "b".repeat(64), titulo: "Modelo" }] };
  const tela = () => m.ganchos!.renderizar(PrepararAditivo, props);
  mudar(selectCom(tela(), "modelo"), "modelo");
  if (cobertura) mudar(selectCom(tela(), "PRESERVAR_REFERENCIA"), escolha);
  for (const campo of elementos(tela()).filter(n => n.type === ValorEstruturadoCampo)) (campo.props.onChange as (v: unknown) => void)(VALORES[campo.props.campo as Origem]);
  return {
    tela,
    escolher: (outra: string) => mudar(selectCom(tela(), "PRESERVAR_REFERENCIA"), outra),
    async enviar(data = "2026-11-03") {
      const entradas: Record<string, string> = { vigencia: "2026-10-01T10:00", motivo: "Ajuste contratual conferido", referenciaCiclo: "CICLO_MATRICULA", dataReferenciaCiclo: data };
      for (const campo of campos) entradas[`alterar:${campo}`] = "on";
      await submeter(tela(), entradas);
    },
  };
}

it("envia referência e data aprováveis no payload e na identidade da tentativa", async () => {
  const c = montar("MUDAR_REFERENCIA"); await c.enviar();
  expect(m.preparar).toHaveBeenCalledWith(expect.objectContaining({ cicloCoberturaFutura: { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2026-11-03" }, chaveIdempotencia: "chave-original" }));
  // A data de referência faz parte da identidade da tentativa: a mesma data reaproveita a chave; outra data troca.
  await c.enviar(); expect(m.preparar.mock.calls[1][0].chaveIdempotencia).toBe("chave-original");
  await c.enviar("2026-11-04"); expect(m.preparar.mock.calls[2][0]).toMatchObject({ chaveIdempotencia: "chave-nova", cicloCoberturaFutura: { dataReferencia: "2026-11-04" } });
});
it("exige escolha e data real antes de enviar cobertura", async () => {
  for (const [escolha, data] of [["", "2026-11-03"], ["MUDAR_REFERENCIA", "2026-02-30"]]) {
    m.ganchos = criarGanchos();
    const c = montar(escolha); await c.enviar(data); expect(m.preparar).not.toHaveBeenCalled();
    expect(anuncios(c.tela()).alerta).toEqual([expect.stringContaining("referência válida")]);
  }
});
it("mudança de política troca a chave e não afeta aditivo sem cobertura", async () => {
  const c = montar("MUDAR_REFERENCIA"); await c.enviar();
  c.escolher("PRESERVAR_REFERENCIA"); await c.enviar();
  expect(m.preparar.mock.calls[1][0]).toMatchObject({ chaveIdempotencia: "chave-nova", cicloCoberturaFutura: { escolha: "PRESERVAR_REFERENCIA" } });
  vi.clearAllMocks(); m.ganchos = criarGanchos();
  const outro = montar("", false); await outro.enviar("");
  expect(m.preparar).toHaveBeenCalledOnce(); expect(m.preparar.mock.calls[0][0]).not.toHaveProperty("cicloCoberturaFutura");
});
