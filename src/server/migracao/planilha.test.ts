import { describe, expect, it } from "vitest";
import { lerCsvPreparacao, linhasMapeadasPreparacao } from "./planilha";
import { pendenciasDaLinha } from "./preparacao";

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
  it("mapeia CSV de vínculo e preserva datas civis para a conferência", () => {
    const aba = lerCsvPreparacao("aluno,turma,matricula,inicio,fim,produto,moeda,pais,alocInicio,alocFim\na1,t1,m1,2026-02-30,2026-02-01,p1,BRL,BR,2026-03-02,2026-03-01\na2,t2,m2,2024-02-29,2024-03-01,p2,BRL,BR,2024-02-29,2024-03-01", "vinculos.csv");
    const [invalida, valida] = linhasMapeadasPreparacao(aba, { "aluno.id": "c1", "turma.id": "c2", "matricula.id": "c3", "matricula.inicio": "c4", "matricula.fim": "c5", "matricula.produtoOrigem": "c6", "matricula.moeda": "c7", "matricula.pais": "c8", "alocacao.inicio": "c9", "alocacao.fim": "c10" }, "VINCULO_MATRICULA");
    expect(invalida?.matricula?.inicio).toBe("2026-02-30");
    expect(pendenciasDaLinha(invalida!).map((p) => p.codigo)).toEqual(expect.arrayContaining(["INICIO_MATRICULA_INVALIDO", "FIM_ALOCACAO_ANTES_INICIO"]));
    expect(pendenciasDaLinha(valida!).map((p) => p.codigo)).not.toContain("INICIO_MATRICULA_INVALIDO");
  });
});
