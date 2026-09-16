import { describe, expect, it } from "vitest";
import { EntradaPrepararLoteMigracao, estadoDaLinha, pendenciasDaLinha } from "./preparacao";

const cadastroCompleto = { linhaOrigem: "alunos!2", tipoEntrada: "CADASTRO" as const, aluno: { id: "aluno-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "BR", fuso: "America/Sao_Paulo" }, dadosAdicionais: { observacao: "fonte preservada" } };

describe("preparação de migração", () => {
  it("preserva vínculo inválido e registra datas, moeda, país e produto para conferência", () => {
    const linha = EntradaPrepararLoteMigracao.parse({ origem: "ORIGEM", chaveLote: "vinculo", linhas: [{ linhaOrigem: "v!2", tipoEntrada: "VINCULO_MATRICULA", aluno: cadastroCompleto.aluno, turma: { id: "t1" }, matricula: { id: "m1", situacao: "ATIVA", inicio: "data", fim: "2020-01-01", produtoOrigem: null, moeda: "br", pais: "BRA" }, dadosAdicionais: {} }] }).linhas[0];
    expect(pendenciasDaLinha(linha).map((p) => p.codigo)).toEqual(expect.arrayContaining(["INICIO_MATRICULA_INVALIDO", "PRODUTO_ORIGEM_AUSENTE", "MOEDA_CONTRATUAL_INVALIDA", "PAIS_CONTRATUAL_INVALIDO"]));
    expect(linha.matricula?.inicio).toBe("data");
  });
  it("preserva duas linhas legíveis quando uma célula é inválida e não transfere sua pendência", () => {
    const entrada = EntradaPrepararLoteMigracao.parse({ origem: "OPERACIONAL_LETICIA", chaveLote: "fixture-celulas-1", linhas: [{ ...cadastroCompleto, linhaOrigem: "alunos!1", aluno: { ...cadastroCompleto.aluno, email: "invalido" } }, cadastroCompleto] });
    const [ruim, boa] = entrada.linhas.map(pendenciasDaLinha);
    expect(ruim).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "aluno.email", codigo: "EMAIL_INVALIDO" })]));
    expect(estadoDaLinha(ruim)).toBe("COM_PENDENCIAS");
    expect(boa).toEqual([]);
    expect(estadoDaLinha(boa)).toBe("PRONTA_PARA_REVISAO");
    expect(entrada.linhas[0].aluno?.email).toBe("invalido");
  });

  it("preserva valor financeiro inválido como origem e o apresenta como pendência", () => {
    const linha = EntradaPrepararLoteMigracao.parse({ origem: "OPERACIONAL_LETICIA", chaveLote: "fixture-financeiro-1", linhas: [{ linhaOrigem: "financeiro!3", tipoEntrada: "FINANCEIRO_HISTORICO", aluno: cadastroCompleto.aluno, financeiro: { id: "f-1", valor: "12,3x", moeda: "br", situacao: "pago?" }, dadosAdicionais: {} }] }).linhas[0];
    const pendencias = pendenciasDaLinha(linha);
    expect(pendencias.map((p) => p.codigo)).toEqual(expect.arrayContaining(["VALOR_FINANCEIRO_INVALIDO", "MOEDA_FINANCEIRA_INVALIDA", "SITUACAO_FINANCEIRA_NAO_CONFIRMADA"]));
    expect(linha.financeiro?.valor).toBe("12,3x");
  });

  it("aceita células numéricas e nulas da planilha, preservando o valor bruto", () => {
    const linha = EntradaPrepararLoteMigracao.parse({ origem: "OPERACIONAL_LETICIA", chaveLote: "fixture-celula-tipado", linhas: [{ linhaOrigem: "financeiro!4", tipoEntrada: "FINANCEIRO_HISTORICO", aluno: { ...cadastroCompleto.aluno, email: null }, financeiro: { id: 401, valor: 12.5, moeda: null, situacao: null }, dadosAdicionais: {} }] }).linhas[0];
    expect(linha.financeiro).toMatchObject({ id: 401, valor: 12.5, moeda: null });
    expect(pendenciasDaLinha(linha).map((p) => p.codigo)).toEqual(expect.arrayContaining(["EMAIL_AUSENTE", "MOEDA_FINANCEIRA_AUSENTE", "SITUACAO_FINANCEIRA_NAO_INFORMADA"]));
  });

  it("recusa somente envelopes sem linha estável ou com colunas desconhecidas fora de dadosAdicionais", () => {
    expect(() => EntradaPrepararLoteMigracao.parse({ origem: "ORIGEM", chaveLote: "lote", linhas: [{ tipoEntrada: "CADASTRO" }] })).toThrow();
    expect(() => EntradaPrepararLoteMigracao.parse({ origem: "ORIGEM", chaveLote: "lote", linhas: [{ ...cadastroCompleto, colunaPerdida: "x" }] })).toThrow();
    expect(EntradaPrepararLoteMigracao.parse({ origem: "ORIGEM", chaveLote: "lote", linhas: [{ ...cadastroCompleto, dadosAdicionais: { colunaPerdida: "x" } }] }).linhas[0].dadosAdicionais.colunaPerdida).toBe("x");
  });

  it("não exige consentimento ou presença de uma linha cadastral simples", () => {
    expect(pendenciasDaLinha(EntradaPrepararLoteMigracao.parse({ origem: "ORIGEM", chaveLote: "lote", linhas: [cadastroCompleto] }).linhas[0]).map((p) => p.campo)).not.toEqual(expect.arrayContaining(["consentimento", "presenca"]));
  });
});
