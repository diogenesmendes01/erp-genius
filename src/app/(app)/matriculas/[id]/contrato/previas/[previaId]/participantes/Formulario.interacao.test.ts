import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L629): trocar a classificação de maioridade não apaga o que foi digitado na
// conferência dos participantes. Sem DOM: ganchos de src/test/tela-sem-dom.ts; o mesmo jogo de ganchos entre
// renders é o mesmo componente montado (a página não tem mais key), recebendo os `dados` novos da URL nova.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  conferir: vi.fn(), refresh: vi.fn(), replace: vi.fn(),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, replace: m.replace }) }));
vi.mock("@/server/contratos/participantes", () => ({ conferirParticipantesContratuais: m.conferir, consultarFormularioParticipantes: vi.fn() }));

import type { ReactNode } from "react";
import { FormularioParticipantes, valorDigitado } from "./Formulario";
import { SeletorMaioridade, hrefMaioridade } from "./SeletorMaioridade";
import { FormDataFalso, criarGanchos, elementos, submeter, type No } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

type Dados = Parameters<typeof FormularioParticipantes>[0]["dados"];
const dados = (maioridade: "MAIOR" | "MENOR" | null, papeis: string[], versaoEsperada = 1) => ({
  matriculaId: "m1", previaId: "pv1", versaoEsperada, maioridade,
  documentos: [{ id: "doc-1", nome: "Documento de identidade", categoria: "COMPROVANTE" }],
  plano: { pendencias: [], participantesExigidos: [] },
  participantes: papeis.map((papel) => ({ papel, etapa: "CLIENTE", automatico: false, identidade: null })),
}) as unknown as Dados;

const tela = (d: Dados) => m.ganchos!.renderizar(FormularioParticipantes, { dados: d });
const porNome = (t: ReactNode, nome: string): No | undefined => elementos(t).find((n) => n.props.name === nome);
const digitar = (t: ReactNode, nome: string, valor: string) => (porNome(t, nome)!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });

describe("FormularioParticipantes — a maioridade troca sem apagar o preenchimento", () => {
  it("trocar a classificação (seções somem) e voltar devolve critério, evidência, signatário e motivo", () => {
    const menor = dados("MENOR", ["REPRESENTANTE_LEGAL"]);
    digitar(tela(menor), "criterio", "Certidão de nascimento conferida.");
    digitar(tela(menor), "evidenciaMaioridade", "doc-1");
    digitar(tela(menor), "REPRESENTANTE_LEGAL_nome", "Maria Silva");
    digitar(tela(menor), "REPRESENTANTE_LEGAL_representacao", "Mãe, guarda conferida.");
    digitar(tela(menor), "motivo", "Conferência inicial dos signatários.");

    // Maioridade "maior": o critério e o representante legal saem da tela (papéis exigidos mudam)…
    const maior = tela(dados(null, []));
    expect(porNome(maior, "criterio")).toBeUndefined();
    expect(porNome(maior, "REPRESENTANTE_LEGAL_nome")).toBeUndefined();
    expect(porNome(maior, "motivo")!.props.value).toBe("Conferência inicial dos signatários.");

    // …e voltar para "menor" devolve tudo o que foi digitado.
    const devolta = tela(menor);
    expect(porNome(devolta, "criterio")!.props.value).toBe("Certidão de nascimento conferida.");
    expect(porNome(devolta, "evidenciaMaioridade")!.props.value).toBe("doc-1");
    expect(porNome(devolta, "REPRESENTANTE_LEGAL_nome")!.props.value).toBe("Maria Silva");
    expect(porNome(devolta, "REPRESENTANTE_LEGAL_representacao")!.props.value).toBe("Mãe, guarda conferida.");
  });

  it("uma versão nova vinda do refresh (outra pessoa registrou) não apaga o que foi digitado", () => {
    digitar(tela(dados("MENOR", ["REPRESENTANTE_LEGAL"])), "REPRESENTANTE_LEGAL_nome", "Maria Silva");
    expect(porNome(tela(dados("MENOR", ["REPRESENTANTE_LEGAL"], 2)), "REPRESENTANTE_LEGAL_nome")!.props.value).toBe("Maria Silva");
  });

  it("registrada a conferência, a próxima começa limpa e com chave nova; dados diferentes também trocam a chave", async () => {
    const d = dados("MENOR", ["REPRESENTANTE_LEGAL"]);
    const valores = {
      conferido: "on", criterio: "Certidão de nascimento conferida.", evidenciaMaioridade: "doc-1", motivo: "Conferência inicial dos signatários.",
      REPRESENTANTE_LEGAL_nome: "Maria Silva", REPRESENTANTE_LEGAL_email: "maria@example.com", REPRESENTANTE_LEGAL_documento: "123",
      REPRESENTANTE_LEGAL_representacao: "Mãe, guarda conferida.", REPRESENTANTE_LEGAL_evidencia: "doc-1",
    };
    digitar(tela(d), "REPRESENTANTE_LEGAL_nome", "Maria Silva");
    m.conferir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela(d), valores);
    m.conferir.mockResolvedValueOnce({ ok: true });
    await submeter(tela(d), valores);
    const chaves = () => m.conferir.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves()[1]).toBe(chaves()[0]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(porNome(tela(d), "REPRESENTANTE_LEGAL_nome")!.props.value).toBe("");
    m.conferir.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await submeter(tela(d), { ...valores, motivo: "Outra conferência dos signatários." });
    expect(chaves()[2]).not.toBe(chaves()[1]);
  });

  it("valor de campo nunca digitado é vazio, mesmo com nome de propriedade do protótipo", () => {
    for (const nome of ["toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"]) expect(valorDigitado({}, nome), nome).toBe("");
    expect(valorDigitado({ motivo: "x" }, "motivo")).toBe("x");
  });
});

describe("SeletorMaioridade — troca client-side, sem <form method=get>", () => {
  const seletor = (maioridade: "MAIOR" | "MENOR" | null) => m.ganchos!.renderizar(SeletorMaioridade, { maioridade });
  const escolher = (valor: string) => (elementos(seletor("MENOR")).find((n) => n.type === "select")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
  const botao = (t: ReactNode) => elementos(t).find((n) => n.type === "button")!;

  it("atualiza a URL pelo roteador, sem rolar a tela, e só quando a escolha mudou", () => {
    expect(elementos(seletor("MENOR")).some((n) => n.type === "form")).toBe(false);
    // O campo continua sendo "maioridade" (o mesmo nome do parâmetro da URL; historicos-fuso.test.ts confere no HTML).
    expect(elementos(seletor("MENOR")).find((n) => n.type === "select")!.props.name).toBe("maioridade");
    expect(botao(seletor("MENOR")).props.disabled).toBe(true);
    escolher("MAIOR");
    expect(botao(seletor("MENOR")).props.disabled).toBe(false);
    (botao(seletor("MENOR")).props.onClick as () => void)();
    expect(m.replace).toHaveBeenCalledWith("?maioridade=MAIOR", { scroll: false });
  });

  it("hrefMaioridade: classificação na URL; sem classificação, a tela sem filtro", () => {
    expect(hrefMaioridade("MENOR")).toBe("?maioridade=MENOR");
    expect(hrefMaioridade(null)).toBe("?");
  });
});
