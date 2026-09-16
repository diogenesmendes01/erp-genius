import { describe, expect, it } from "vitest";
import { lerCsvPreparacao, linhasMapeadasPreparacao } from "./planilha";

describe("planilha de preparação M01", () => {
  it("lê acentos, textos numéricos, linhas vazias e cabeçalhos duplicados", () => {
    const aba = lerCsvPreparacao('ID,Nome,Nome,Valor\n1,"Ana, Lívia",apelido,12.5\n\n2,João,segundo,\n', "dados.csv");
    expect(aba.cabecalhos.map((c) => c.rotulo)).toEqual(["ID", "Nome", "Nome (2)", "Valor"]);
    expect(aba.linhas).toHaveLength(2);
    expect(aba.linhas[0]).toMatchObject({ numero: 2, valores: { c1: "1", c2: "Ana, Lívia", c4: "12.5" } });
  });
  it("preserva zeros iniciais, IDs longos, extras e recusa aspas malformadas", () => {
    const aba = lerCsvPreparacao("id;id;id (2)\n00123;9007199254740993123;extra\n", "dados.csv", ";");
    expect(aba.cabecalhos.map((c) => c.rotulo)).toEqual(["id", "id (2)", "id (2) (2)"]);
    expect(aba.linhas[0]?.valores).toMatchObject({ c1: "00123", c2: "9007199254740993123", c3: "extra" });
    expect(() => lerCsvPreparacao("id,nome\n1,\"Ana", "dados.csv")).toThrow(/aspas/i);
  });
  it("só usa colunas escolhidas e preserva inclusive as não mapeadas", () => {
    const aba = lerCsvPreparacao("id,nome,ignorada\n42,Ana,área antiga\n", "dados.csv");
    const [linha] = linhasMapeadasPreparacao(aba, { "aluno.id": "c1", "aluno.nome": "c2" }, "CADASTRO");
    expect(linha).toMatchObject({ linhaOrigem: "dados.csv!2", aluno: { id: "42", nome: "Ana" }, dadosAdicionais: { id: "42", nome: "Ana", ignorada: "área antiga" } });
    expect(linha.financeiro).toMatchObject({ id: null, valor: null });
  });
});
