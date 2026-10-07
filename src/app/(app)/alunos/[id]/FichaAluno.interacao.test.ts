import { StatusAluno } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// R1 da #145 (B2): a validação por campo da edição, da pausa e do encerramento, pelo clique — sem DOM.
// O componente é chamado como função com os ganchos de src/test/tela-sem-dom.ts (estado guardado entre
// renders); os botões e os controles dos <Campo> são achados na árvore e acionados.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  editar: vi.fn(), pausar: vi.fn(), encerrar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState, useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/alunos/acoes", () => ({ editarAluno: m.editar, pausarAluno: m.pausar, encerrarAluno: m.encerrar }));

import { FichaAluno, type AlunoFicha } from "./FichaAluno";
import { CampoTexto } from "@/components/CampoTexto";
import { botao, campo, campos, clicar, criarGanchos, documentoQueRegistraFoco, errosDosCampos, preencher } from "@/test/tela-sem-dom";

const aluno: AlunoFicha = {
  id: "aluno-1", codigo: "A-1", nome: "Ana Silva", primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null,
  status: StatusAluno.ATIVO, pais: "Costa Rica", paisId: "pais-cr", nascimento: null, genero: null, tipoDocumentoId: null,
  documento: null, documentoValido: false, documentoPaisEmissor: null, nacionalidade: null, segundaNacionalidade: null,
  telefone: null, email: null, whatsapp: false, aceitaComunicacoes: false, paisResidencia: null, cep: null, rua: null,
  numero: null, complemento: null, bairro: null, cidade: null, regiao: null, escolaridade: null, idiomaNativo: null,
  fuso: null, observacoes: null, turmasAtuais: [], financeiro: null, movimentacoes: [],
};
const props = {
  aluno, paises: [{ id: "pais-cr", nome: "Costa Rica", tiposDocumento: [] }],
  podeMovimentar: true, podeMovimentarGlobal: true, podeEditarCadastro: true, preferenciaFusoExibicao: null,
};

let foco: ReturnType<typeof documentoQueRegistraFoco>;
const tela = (): ReactNode => m.ganchos!.renderizar(FichaAluno, props);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));
/** Erro de cada Campo da tela que tem erro, por id, na ordem da tela. */
const errosNaTela = errosDosCampos;
/** O foco foi para um Campo que existe e é o primeiro com erro na tela (id da validação = id do Campo). */
function focoNoPrimeiroComErro(t: ReactNode) {
  const primeiro = campos(t).find((c) => c.props.erro);
  expect(primeiro, "algum Campo com erro").toBeDefined();
  expect(foco.focados.at(-1)).toBe(primeiro!.props.id);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  foco = documentoQueRegistraFoco();
  vi.stubGlobal("document", foco.documento);
  m.editar.mockResolvedValue({ ok: true });
  m.pausar.mockResolvedValue({ ok: true });
  m.encerrar.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("FichaAluno — edição", () => {
  it("antes de tentar salvar, nenhum campo marcado; o botão não fica desabilitado", () => {
    clicar(tela(), "Editar dados");
    const t = tela();
    expect(errosNaTela(t)).toEqual({});
    expect(botao(t, "Salvar alterações").props.disabled).toBe(false);
  });

  it("salvar com obrigatórios vazios: não envia, marca cada um com a sua mensagem e foca o primeiro", () => {
    clicar(tela(), "Editar dados");
    preencher(tela(), "ficha-primeiroNome", "");
    preencher(tela(), "ficha-sobrenome", "  ");
    clicar(tela(), "Salvar alterações");
    const t = tela();
    expect(m.editar).not.toHaveBeenCalled();
    expect(errosNaTela(t)).toEqual({
      "ficha-primeiroNome": "Informe o nome.",
      "ficha-sobrenome": "Informe o sobrenome.",
      "ficha-motivo": "Informe o motivo da edição.",
    });
    expect(foco.focados).toEqual(["ficha-primeiroNome"]);
    focoNoPrimeiroComErro(t);
  });

  it("só o motivo falta: ainda não envia, e o foco vai ao motivo", () => {
    clicar(tela(), "Editar dados");
    clicar(tela(), "Salvar alterações");
    const t = tela();
    expect(m.editar).not.toHaveBeenCalled();
    expect(errosNaTela(t)).toEqual({ "ficha-motivo": "Informe o motivo da edição." });
    expect(foco.focados).toEqual(["ficha-motivo"]);
    focoNoPrimeiroComErro(t);
  });

  it("depois da tentativa o erro acompanha a digitação; completo, envia os dados e atualiza a ficha", async () => {
    clicar(tela(), "Editar dados");
    clicar(tela(), "Salvar alterações");
    preencher(tela(), "ficha-motivo", "Correção do documento", [CampoTexto]);
    expect(errosNaTela(tela())).toEqual({});
    clicar(tela(), "Salvar alterações");
    await esvaziar();
    expect(m.editar).toHaveBeenCalledTimes(1);
    expect(m.editar).toHaveBeenCalledWith("aluno-1", expect.objectContaining({ primeiroNome: "Ana", sobrenome: "Silva", paisId: "pais-cr", motivo: "Correção do documento" }));
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("a tentativa não vaza para o próximo painel (nem para a próxima edição)", () => {
    clicar(tela(), "Editar dados");
    clicar(tela(), "Salvar alterações");
    expect(errosNaTela(tela())).not.toEqual({});
    clicar(tela(), "Cancelar");
    clicar(tela(), "Pausar");
    expect(errosNaTela(tela())).toEqual({});
    clicar(tela(), "Editar dados");
    expect(errosNaTela(tela())).toEqual({});
  });
});

describe("FichaAluno — pausa", () => {
  it("sem motivo: não envia, o erro aparece no campo e o foco vai a ele", () => {
    clicar(tela(), "Pausar");
    expect(errosNaTela(tela())).toEqual({});
    expect(campo(tela(), "pausa-motivo").props.obrigatorio).toBe(true);
    clicar(tela(), "Confirmar pausa");
    const t = tela();
    expect(m.pausar).not.toHaveBeenCalled();
    expect(errosNaTela(t)).toEqual({ "pausa-motivo": "Informe o motivo da pausa." });
    expect(foco.focados).toEqual(["pausa-motivo"]);
    focoNoPrimeiroComErro(t);
  });

  it("com motivo: envia o motivo e o retorno", async () => {
    clicar(tela(), "Pausar");
    preencher(tela(), "pausa-motivo", "Viagem");
    preencher(tela(), "pausa-retorno", "2026-12-01");
    clicar(tela(), "Confirmar pausa");
    await esvaziar();
    expect(m.pausar).toHaveBeenCalledWith("aluno-1", { motivo: "Viagem", dataRetornoPrevista: "2026-12-01" });
    expect(foco.focados).toEqual([]);
  });
});

describe("FichaAluno — encerramento", () => {
  it("motivo \"Outro\" sem observação: não envia, a observação fica obrigatória, marcada e com foco", () => {
    clicar(tela(), "Encerrar");
    expect(campo(tela(), "encerramento-observacao").props.obrigatorio).toBe(false);
    preencher(tela(), "encerramento-motivo", "Outro");
    expect(campo(tela(), "encerramento-observacao").props.obrigatorio).toBe(true);
    expect(errosNaTela(tela())).toEqual({});
    clicar(tela(), "Confirmar encerramento");
    const t = tela();
    expect(m.encerrar).not.toHaveBeenCalled();
    expect(errosNaTela(t)).toEqual({ "encerramento-observacao": "Informe a observação quando o motivo é “Outro”." });
    expect(foco.focados).toEqual(["encerramento-observacao"]);
    focoNoPrimeiroComErro(t);
  });

  it("\"Outro\" com observação envia; outro motivo dispensa a observação (e não mostra erro)", async () => {
    clicar(tela(), "Encerrar");
    preencher(tela(), "encerramento-motivo", "Outro");
    clicar(tela(), "Confirmar encerramento");
    preencher(tela(), "encerramento-motivo", "Concluiu");
    expect(errosNaTela(tela())).toEqual({});
    clicar(tela(), "Confirmar encerramento");
    await esvaziar();
    expect(m.encerrar).toHaveBeenLastCalledWith("aluno-1", { motivo: "Concluiu", observacao: "" });

    m.ganchos!.reiniciar();
    clicar(tela(), "Encerrar");
    preencher(tela(), "encerramento-motivo", "Outro");
    preencher(tela(), "encerramento-observacao", "Mudou de escola");
    clicar(tela(), "Confirmar encerramento");
    await esvaziar();
    expect(m.encerrar).toHaveBeenLastCalledWith("aluno-1", { motivo: "Outro", observacao: "Mudou de escola" });
  });
});
