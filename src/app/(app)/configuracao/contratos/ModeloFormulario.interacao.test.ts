import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L2367 e L2368): o modelo contratual (até 100 seções de 20.000 caracteres) é
// protegido pelo aviso de saída — ligado só com alteração não salva, desligado depois de salvar — e uma tentativa
// não confirmada não trava mais a proposta sem saída: a tela oferece reenviar a anterior ou descartá-la.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aviso: vi.fn(), preparar: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: m.refresh }) }));
vi.mock("@/server/contratos/modelos", () => ({ prepararModeloContratual: m.preparar }));
vi.mock("@/lib/aviso-ao-sair", () => ({ useAvisoAoSair: m.aviso }));

import type { ReactNode } from "react";
import { ModeloFormulario } from "./ModeloFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { FormDataFalso, clicar, criarGanchos, elementos, formularios, submeter, temBotao, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const tela = () => m.ganchos!.renderizar(ModeloFormulario, { versaoEsperada: 0 });
const sujo = () => m.aviso.mock.calls.at(-1)?.[0];
type Mudanca = (e: { target: { value: string } }) => void;
const titulo = (t: ReactNode) => elementos(t).find((n) => n.type === "input" && n.props.required === true && n.props.maxLength === 200 && n.props.name === undefined)!;
const alertas = (t: ReactNode) => elementos(t).filter((n) => n.props.role === "alert").map((n) => texto(n.props.children));

/**
 * Preenche o mínimo válido do conteúdo: título, regime, aplicação, uma seção (título e texto) e uma regra de
 * assinatura. Os campos de até 200 caracteres sem `name` são, na ordem, o título do modelo e o da seção; os
 * campos de texto longo sem `name`, a aplicação e o texto da seção (o motivo tem `name`).
 */
function preencher(tituloDoModelo: string) {
  const de200 = () => elementos(tela()).filter((n) => n.type === "input" && n.props.maxLength === 200 && n.props.name === undefined);
  const textos = () => elementos(tela()).filter((n) => n.type === CampoTexto && n.props.name === undefined);
  (de200()[0].props.onChange as Mudanca)({ target: { value: tituloDoModelo } });
  (elementos(tela()).find((n) => n.type === "input" && n.props.type === "checkbox")!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  (textos()[0].props.onChange as Mudanca)({ target: { value: "Matrículas regulares de mensalidade." } });
  (de200()[1].props.onChange as Mudanca)({ target: { value: "Objeto" } });
  (textos()[1].props.onChange as Mudanca)({ target: { value: "O contrato tem por objeto a prestação dos serviços educacionais." } });
  clicar(tela(), "Adicionar regra de assinatura");
}
const valores = { codigo: "PADRAO", motivo: "Primeira versão do modelo." };

describe("ModeloFormulario — aviso ao sair", () => {
  it("intocado não avisa; digitar conteúdo ou tocar um campo avisa", () => {
    tela();
    expect(sujo()).toBe(false);
    (titulo(tela()).props.onChange as Mudanca)({ target: { value: "Contrato padrão" } });
    tela();
    expect(sujo()).toBe(true);
    m.ganchos!.reiniciar();
    (formularios(tela())[0].props.onChange as () => void)(); // código ou motivo (campos não controlados)
    tela();
    expect(sujo()).toBe(true);
  });

  it("salvo, desliga o aviso antes de navegar; recusado, continua avisando", async () => {
    preencher("Contrato padrão");
    m.preparar.mockResolvedValueOnce({ ok: false, erro: "Código já usado." });
    await submeter(tela(), valores);
    tela();
    expect(sujo()).toBe(true);
    m.preparar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valores);
    tela();
    expect(sujo()).toBe(false);
    expect(m.push).toHaveBeenCalledWith("/configuracao/contratos/PADRAO");
  });
});

describe("ModeloFormulario — tentativa não confirmada tem saída (docs/42 L2368)", () => {
  async function tentativaIncerta() {
    preencher("Contrato padrão");
    m.preparar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela(), valores);
    expect(alertas(tela())).toEqual([MSG_RESULTADO_INCERTO]);
    (titulo(tela()).props.onChange as Mudanca)({ target: { value: "Contrato padrão revisado" } });
    await submeter(tela(), valores);
    expect(m.preparar).toHaveBeenCalledTimes(1);
  }

  it("alterar depois de uma tentativa incerta mostra qual era e oferece reenviar ou descartar", async () => {
    await tentativaIncerta();
    const t = tela();
    expect(texto(elementos(t).find((n) => n.type === "p" && texto(n.props.children).startsWith("Tentativa anterior"))!.props.children)).toContain("título: Contrato padrão;");
    expect(temBotao(t, "Reenviar a proposta anterior")).toBe(true);
    expect(temBotao(t, "Descartar a tentativa anterior")).toBe(true);
  });

  it("reenviar usa os mesmos dados e a mesma chave da tentativa anterior", async () => {
    await tentativaIncerta();
    m.preparar.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Reenviar a proposta anterior");
    const [a, b] = m.preparar.mock.calls.map((c) => c[0] as { chaveIdempotencia: string; conteudo: { titulo: string } });
    expect(b.chaveIdempotencia).toBe(a.chaveIdempotencia);
    expect(b.conteudo.titulo).toBe("Contrato padrão");
    tela();
    expect(sujo()).toBe(false);
  });

  it("descartar libera o envio da proposta atual, com chave nova", async () => {
    await tentativaIncerta();
    clicar(tela(), "Descartar a tentativa anterior");
    expect(temBotao(tela(), "Reenviar a proposta anterior")).toBe(false);
    m.preparar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valores);
    const [a, b] = m.preparar.mock.calls.map((c) => c[0] as { chaveIdempotencia: string; conteudo: { titulo: string } });
    expect(b.chaveIdempotencia).not.toBe(a.chaveIdempotencia);
    expect(b.conteudo.titulo).toBe("Contrato padrão revisado");
  });
});
