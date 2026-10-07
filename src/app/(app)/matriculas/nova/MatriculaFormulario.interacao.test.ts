import { Genero } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// R1 da #145 (B3): o erro por campo dos dois passos, pelo clique — sem DOM. O componente é chamado como
// função com os ganchos de src/test/tela-sem-dom.ts; botões e controles dos <Campo> são acionados na árvore.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  criar: vi.fn(), abrir: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState, useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: m.refresh }) }));
vi.mock("@/server/matricula/acoes", () => ({ criarMatricula: m.criar }));
vi.mock("@/server/turmas/acoes", () => ({ solicitarAberturaTurma: m.abrir }));

import { MatriculaFormulario, errosDoPasso2, type DadosPasso2 } from "./MatriculaFormulario";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { campos, clicar, criarGanchos, documentoQueRegistraFoco, elementos, errosDosCampos, preencher } from "@/test/tela-sem-dom";

const props = {
  podeCriar: true,
  lead: null,
  paises: [{ id: "cr", nome: "Costa Rica", moedaLocal: "CRC", codigoISO: "CR", tiposDocumento: [{ id: "ced", nome: "Cédula" }] }],
  produtos: [{ id: "prod", label: "Inglês" }],
  turmas: [],
  niveis: [],
  precos: [],
};

const PROXIMO = "Próximo: curso e contrato →";
let foco: ReturnType<typeof documentoQueRegistraFoco>;
const tela = (): ReactNode => m.ganchos!.renderizar(MatriculaFormulario, props);
const errosNaTela = errosDosCampos;
const temCampo = (t: ReactNode, id: string) => campos(t).some((c) => c.props.id === id);
const errosDoServidor = (t: ReactNode) => elementos(t).filter((n) => n.type === FeedbackAcao).map((n) => n.props.erro).filter(Boolean);
function focoNoPrimeiroComErro(t: ReactNode) {
  const primeiro = campos(t).find((c) => c.props.erro);
  expect(primeiro, "algum Campo com erro").toBeDefined();
  expect(foco.focados.at(-1)).toBe(primeiro!.props.id);
}

function preencherPasso1() {
  preencher(tela(), "matricula-nome", "Ana");
  preencher(tela(), "matricula-sobrenome", "Souza");
  preencher(tela(), "matricula-nascimento", "2010-05-01");
  preencher(tela(), "matricula-genero", Genero.FEMININO);
  preencher(tela(), "matricula-tipo-documento", "ced");
  preencher(tela(), "matricula-documento", "1-2345-6789");
  preencher(tela(), "matricula-email", "ana@exemplo.com");
  preencher(tela(), "matricula-telefone", "+50612345678");
}
function irAoPasso2() {
  preencherPasso1();
  clicar(tela(), PROXIMO);
}
function preencherPasso2() {
  preencher(tela(), "matricula-taxa", "100");
  preencher(tela(), "matricula-mensalidade", "50");
  preencher(tela(), "referencia-cobertura", "MES_CIVIL");
  preencher(tela(), "primeiro-vencimento", "2026-11-05");
  preencher(tela(), "inicio-cobertura", "2026-11-01");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  foco = documentoQueRegistraFoco();
  vi.stubGlobal("document", foco.documento);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("matrícula nova — passo 1 pela tela", () => {
  it("nasce sem nenhum campo marcado", () => {
    expect(errosNaTela(tela())).toEqual({});
  });

  it("Próximo com o passo vazio: não avança, marca cada pendente com a sua mensagem e foca o primeiro da tela", () => {
    clicar(tela(), PROXIMO);
    const t = tela();
    expect(temCampo(t, "matricula-taxa")).toBe(false);
    // País, nacionalidade e residência vêm preenchidos pelo país inicial.
    expect(errosNaTela(t)).toEqual({
      "matricula-nome": "Informe o nome do aluno.",
      "matricula-sobrenome": "Informe o sobrenome.",
      "matricula-nascimento": "Informe a data de nascimento.",
      "matricula-genero": "Selecione o gênero.",
      "matricula-tipo-documento": "Selecione o tipo de documento.",
      "matricula-documento": "Informe o número do documento.",
      "matricula-email": "Informe o e-mail.",
      "matricula-telefone": "Informe o telefone.",
    });
    expect(Object.keys(errosNaTela(t))[0]).toBe("matricula-nome");
    expect(foco.focados).toEqual(["matricula-nome"]);
    focoNoPrimeiroComErro(t);
  });

  it("a ordem da validação é a ordem da tela: com só o e-mail e o telefone faltando, o foco vai ao e-mail", () => {
    preencherPasso1();
    preencher(tela(), "matricula-email", "ana@");
    preencher(tela(), "matricula-telefone", "");
    clicar(tela(), PROXIMO);
    const t = tela();
    expect(errosNaTela(t)).toEqual({ "matricula-email": "E-mail inválido.", "matricula-telefone": "Informe o telefone." });
    expect(foco.focados).toEqual(["matricula-email"]);
    focoNoPrimeiroComErro(t);
  });

  it("pagador empresa: o nome da empresa é cobrado no próprio campo (o tipo escolhido chega à validação)", () => {
    preencherPasso1();
    const pagador = elementos(tela()).find((n) => n.type === "select" && n.props["aria-labelledby"] === "matricula-pagador-titulo")!;
    (pagador.props.onChange as (e: unknown) => void)({ target: { value: "EMPRESA" } });
    clicar(tela(), PROXIMO);
    const t = tela();
    expect(temCampo(t, "matricula-taxa")).toBe(false);
    expect(errosNaTela(t)).toEqual({ "matricula-responsavel-nome": "Informe o nome da empresa pagadora." });
    expect(foco.focados).toEqual(["matricula-responsavel-nome"]);
  });

  it("corrigido, avança ao passo 2 — e o passo 2 nasce sem erro", () => {
    clicar(tela(), PROXIMO);
    irAoPasso2();
    const t = tela();
    expect(temCampo(t, "matricula-taxa")).toBe(true);
    expect(errosNaTela(t)).toEqual({});
  });
});

describe("matrícula nova — passo 2 pela tela", () => {
  it("Salvar com o passo vazio: não envia, cada campo com a sua mensagem (uma por campo) e foco na taxa", async () => {
    irAoPasso2();
    foco.focados.length = 0;
    await clicar(tela(), "Salvar matrícula");
    const t = tela();
    expect(m.criar).not.toHaveBeenCalled();
    expect(errosNaTela(t)).toEqual({
      "matricula-taxa": "Informe a taxa de matrícula, com no máximo duas casas decimais.",
      "matricula-mensalidade": "Informe a mensalidade, com no máximo duas casas decimais.",
      "referencia-cobertura": "Selecione a cobertura prevista no contrato.",
      "primeiro-vencimento": "Informe o vencimento da primeira mensalidade.",
      "inicio-cobertura": "Informe o início do primeiro período coberto.",
    });
    expect(foco.focados).toEqual(["matricula-taxa"]);
    focoNoPrimeiroComErro(t);
  });

  it("só as datas faltando: o foco vai à primeira data da tela", async () => {
    irAoPasso2();
    preencher(tela(), "matricula-taxa", "100");
    preencher(tela(), "matricula-mensalidade", "50");
    preencher(tela(), "referencia-cobertura", "CICLO_MATRICULA");
    foco.focados.length = 0;
    await clicar(tela(), "Salvar matrícula");
    const t = tela();
    expect(m.criar).not.toHaveBeenCalled();
    expect(Object.keys(errosNaTela(t))).toEqual(["primeiro-vencimento", "inicio-cobertura"]);
    expect(foco.focados).toEqual(["primeiro-vencimento"]);
  });

  it("completo: envia os valores já convertidos; o erro do servidor fica junto do botão e some ao trocar de passo", async () => {
    irAoPasso2();
    preencherPasso2();
    m.criar.mockResolvedValueOnce({ ok: false, erro: "Turma sem vaga." });
    await clicar(tela(), "Salvar matrícula");
    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({
      alunoPrimeiroNome: "Ana", taxaValor: 100, mensalidadeValor: 50, certificadoValor: 0,
      cobertura: { referencia: "MES_CIVIL", inicio: "2026-11-01" }, primeiroVencimento: "2026-11-05", pagador: "ALUNO",
    }));
    expect(errosDoServidor(tela())).toEqual(["Turma sem vaga."]);
    expect(errosNaTela(tela())).toEqual({});
    clicar(tela(), "← Voltar");
    expect(temCampo(tela(), "matricula-nome")).toBe(true);
    expect(errosDoServidor(tela())).toEqual([]);
  });

  it("sucesso: vai para a lista de alunos", async () => {
    irAoPasso2();
    preencherPasso2();
    m.criar.mockResolvedValueOnce({ ok: true, dado: { id: "mat", alunoId: "al" } });
    await clicar(tela(), "Salvar matrícula");
    expect(m.push).toHaveBeenCalledWith("/alunos");
  });
});

describe("matrícula nova — validação do passo 2 (função pura)", () => {
  const completo: DadosPasso2 = {
    taxaValor: "100", mensalidadeValor: "50,5", certificadoValor: "", referenciaCobertura: "MES_CIVIL",
    primeiroVencimento: "2026-11-05", inicioCobertura: "2026-11-01",
  };

  it("completo: nenhum erro e os valores convertidos (certificado vazio vale 0)", () => {
    expect(errosDoPasso2(completo)).toEqual({ erros: {}, valores: { taxa: 100, mensalidade: 50.5, certificado: 0 } });
  });

  it("cada campo pendente tem a sua mensagem — nada de mensagem combinada", () => {
    const casos: [Partial<DadosPasso2>, string, string][] = [
      [{ taxaValor: "" }, "taxa", "Informe a taxa de matrícula, com no máximo duas casas decimais."],
      [{ mensalidadeValor: "abc" }, "mensalidade", "Informe a mensalidade, com no máximo duas casas decimais."],
      [{ referenciaCobertura: "" }, "referenciaCobertura", "Selecione a cobertura prevista no contrato."],
      [{ primeiroVencimento: "" }, "primeiroVencimento", "Informe o vencimento da primeira mensalidade."],
      [{ inicioCobertura: "" }, "inicioCobertura", "Informe o início do primeiro período coberto."],
      [{ certificadoValor: "1.234" }, "certificado", "Informe o valor do certificado, com no máximo duas casas decimais."],
    ];
    for (const [mudanca, chave, mensagem] of casos) {
      expect(errosDoPasso2({ ...completo, ...mudanca }).erros, chave).toEqual({ [chave]: mensagem });
    }
  });

  it("dinheiro inválido: sem valores (nunca vira 0); data faltando não impede converter o dinheiro", () => {
    expect(errosDoPasso2({ ...completo, taxaValor: "x" }).valores).toBeNull();
    expect(errosDoPasso2({ ...completo, mensalidadeValor: "" }).valores).toBeNull();
    expect(errosDoPasso2({ ...completo, certificadoValor: "x" }).valores).toBeNull();
    expect(errosDoPasso2({ ...completo, primeiroVencimento: "" }).valores).toEqual({ taxa: 100, mensalidade: 50.5, certificado: 0 });
  });

  it("tudo vazio: as chaves saem na ordem da tela", () => {
    const vazio: DadosPasso2 = { taxaValor: "", mensalidadeValor: "", certificadoValor: "x", referenciaCobertura: "", primeiroVencimento: "", inicioCobertura: "" };
    expect(Object.keys(errosDoPasso2(vazio).erros)).toEqual(["taxa", "mensalidade", "referenciaCobertura", "primeiroVencimento", "inicioCobertura", "certificado"]);
  });
});
