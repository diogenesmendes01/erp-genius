import { describe, expect, it } from "vitest";
import { RegrasEncerramentoSchema } from "@/server/matricula/condicoes-encerramento-schema";
import { montarAcertoDesistenciaPreparacao, type AlcanceAcerto, type TipoAcerto } from "./condicoes-encerramento-formulario";

const base = {
  diaEncerramento: "EXCLUIR",
  metodoDesconto: "ANTES_DO_PROPORCIONAL",
  condicoesDescontos: "Condições conferidas no original.",
  multa: { tipo: "SEM_PREVISAO", motivo: "Sem multa prevista." },
};

function formulario() {
  const dados = new FormData();
  dados.set("clausulaAcerto", "7.2");
  dados.set("valorAcerto", "25");
  return dados;
}

function validar(dados: FormData, tipo: TipoAcerto, alcance: AlcanceAcerto) {
  return RegrasEncerramentoSchema.parse({ ...base, acertoDesistenciaPreparacao: montarAcertoDesistenciaPreparacao(dados, tipo, alcance) });
}

describe("montagem da regra Q165 no formulário", () => {
  it.each(["VALOR_FIXO", "PERCENTUAL_VALOR_NEGOCIADO"] as const)("mantém %s com alcance de todas as cobranças", (tipo) => {
    const regra = validar(formulario(), tipo, "TODAS_COBRANCAS_MATRICULA").acertoDesistenciaPreparacao!;
    expect(regra).toMatchObject({ tipo, clausulaId: "7.2", condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" } } });
    expect(regra).toMatchObject(tipo === "VALOR_FIXO" ? { valor: "25" } : { percentual: "25" });
  });

  it.each(["VALOR_FIXO", "PERCENTUAL_VALOR_NEGOCIADO"] as const)("mantém %s com tipos escolhidos", (tipo) => {
    const dados = formulario(); dados.append("tiposAcerto", "MENSALIDADE"); dados.append("tiposAcerto", "MATERIAL");
    const regra = validar(dados, tipo, "TIPOS_COBRANCA").acertoDesistenciaPreparacao!;
    expect(regra.condicoesAplicacao).toMatchObject({ unidade: "POR_COBRANCA", alcance: { tipo: "TIPOS_COBRANCA", tipos: ["MENSALIDADE", "MATERIAL"] } });
  });

  it.each(["VALOR_FIXO", "PERCENTUAL_VALOR_NEGOCIADO"] as const)("mantém %s com cobranças identificadas", (tipo) => {
    const dados = formulario(); dados.append("cobrancasAcerto", "cobranca-a"); dados.append("cobrancasAcerto", "cobranca-b");
    const regra = validar(dados, tipo, "COBRANCAS_IDENTIFICADAS").acertoDesistenciaPreparacao!;
    expect(regra.condicoesAplicacao).toMatchObject({ unidade: "POR_COBRANCA", alcance: { tipo: "COBRANCAS_IDENTIFICADAS", cobrancaIds: ["cobranca-a", "cobranca-b"] } });
  });

  it.each(["VALOR_FIXO", "PERCENTUAL_VALOR_NEGOCIADO"] as const)("mantém %s com total e rateio explícito", (tipo) => {
    const dados = formulario(); dados.append("cobrancasAcerto", "cobranca-a"); dados.append("cobrancasAcerto", "cobranca-b"); dados.set("rateio:cobranca-a", "40"); dados.set("rateio:cobranca-b", "60");
    const regra = validar(dados, tipo, "TOTAL_CONTRATACAO").acertoDesistenciaPreparacao!;
    expect(regra.condicoesAplicacao).toMatchObject({ unidade: "TOTAL_CONTRATACAO", cobrancaIds: ["cobranca-a", "cobranca-b"], rateio: [{ cobrancaId: "cobranca-a", percentual: "40" }, { cobrancaId: "cobranca-b", percentual: "60" }] });
  });

  it("recusa rateio sem 100% e IDs repetidos", () => {
    const rateioInvalido = formulario(); rateioInvalido.append("cobrancasAcerto", "cobranca-a"); rateioInvalido.append("cobrancasAcerto", "cobranca-b"); rateioInvalido.set("rateio:cobranca-a", "20"); rateioInvalido.set("rateio:cobranca-b", "20");
    expect(() => validar(rateioInvalido, "VALOR_FIXO", "TOTAL_CONTRATACAO")).toThrow("totalizar 100%");
    const duplicada = formulario(); duplicada.append("cobrancasAcerto", "cobranca-a"); duplicada.append("cobrancasAcerto", "cobranca-a"); duplicada.set("rateio:cobranca-a", "50");
    expect(() => validar(duplicada, "PERCENTUAL_VALOR_NEGOCIADO", "TOTAL_CONTRATACAO")).toThrow("única vez");
  });
});
