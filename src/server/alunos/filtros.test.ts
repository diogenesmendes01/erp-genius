import { StatusAluno } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { filtrosParaQuery, lerFiltrosAlunos, temFiltroAlunos, whereFiltrosAlunos } from "./filtros";

describe("lerFiltrosAlunos", () => {
  it("lê, apara e valida os filtros da URL", () => {
    expect(lerFiltrosAlunos({ busca: "  ana ", status: "PAUSADO", pais: "p1", turma: "t-9", pagina: "3" }))
      .toEqual({ busca: "ana", status: StatusAluno.PAUSADO, paisId: "p1", turmaId: "t-9", pagina: 3 });
  });

  it("descarta o que não é válido e ignora chaves desconhecidas", () => {
    expect(lerFiltrosAlunos({ status: "APAGADO", pais: "x'; drop", turma: "a".repeat(65), pagina: "0", colunas: "cpf", ids: "1" }))
      .toEqual({ busca: "", status: null, paisId: null, turmaId: null, pagina: 1 });
    expect(lerFiltrosAlunos({ pagina: "2.5" }).pagina).toBe(1);
    expect(lerFiltrosAlunos({ pagina: "100001" }).pagina).toBe(1);
    expect(lerFiltrosAlunos({ busca: "x".repeat(150) }).busca).toHaveLength(100);
  });

  it("aceita URLSearchParams (rota de exportação) e valor repetido (primeiro vale)", () => {
    expect(lerFiltrosAlunos(new URLSearchParams("status=ATIVO&busca=M-0001")))
      .toMatchObject({ status: StatusAluno.ATIVO, busca: "M-0001" });
    expect(lerFiltrosAlunos({ status: ["ENCERRADO", "ATIVO"] }).status).toBe(StatusAluno.ENCERRADO);
  });
});

describe("filtrosParaQuery", () => {
  const f = lerFiltrosAlunos({ busca: "ana silva", status: "ATIVO", pagina: "2" });
  it("monta a query sem os vazios; página só quando > 1", () => {
    expect(filtrosParaQuery(f)).toBe("busca=ana+silva&status=ATIVO&pagina=2");
    expect(filtrosParaQuery(f, { semPagina: true })).toBe("busca=ana+silva&status=ATIVO");
    expect(filtrosParaQuery(lerFiltrosAlunos({}))).toBe("");
  });
  it("ida e volta: ler(query(f)) devolve os mesmos filtros", () => {
    expect(lerFiltrosAlunos(new URLSearchParams(filtrosParaQuery(f)))).toEqual(f);
  });
  it("temFiltroAlunos ignora a página", () => {
    expect(temFiltroAlunos(lerFiltrosAlunos({ pagina: "4" }))).toBe(false);
    expect(temFiltroAlunos(f)).toBe(true);
  });
});

describe("whereFiltrosAlunos", () => {
  it("sem filtro: condição vazia (o escopo do usuário decide)", () => {
    expect(whereFiltrosAlunos(lerFiltrosAlunos({}))).toEqual({});
  });
  it("busca sem diferenciar maiúsculas em nome, sobrenome, nome preferido e código", () => {
    const w = whereFiltrosAlunos(lerFiltrosAlunos({ busca: "Ana" }));
    const contem = { contains: "Ana", mode: "insensitive" };
    expect(w).toEqual({ AND: [{ OR: [{ primeiroNome: contem }, { sobrenome: contem }, { nomePreferido: contem }, { codigo: contem }] }] });
  });
  it("turma do professor fica presa às turmas dele (URL montada à mão não revela turma alheia)", () => {
    const escopo = { vinculosDocentes: { some: { professorId: "prof" } } };
    const w = whereFiltrosAlunos(lerFiltrosAlunos({ turma: "t1" }), escopo as never);
    expect(w).toEqual({ AND: [{ alocacoes: { some: { ativa: true, turmaId: "t1", turma: escopo } } }] });
    expect(whereFiltrosAlunos(lerFiltrosAlunos({ turma: "t1" }))).toEqual({ AND: [{ alocacoes: { some: { ativa: true, turmaId: "t1" } } }] });
  });
});
