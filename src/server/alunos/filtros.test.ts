import { StatusAluno } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { camposDosFiltros, destinoPaginaAlunos, filtrosParaQuery, hrefAlunos, hrefDosCampos, lerFiltrosAlunos, sanearFiltrosAlunos, temFiltroAlunos, whereFiltrosAlunos } from "./filtros";
import { sincronizarCamposFiltro } from "@/lib/filtros-url";

// A lista usa a sincronização genérica (useFiltrosUrl) sobre os campos derivados destes filtros.
const sincronizarCampos = (atuais: ReturnType<typeof camposDosFiltros>, antes: ReturnType<typeof lerFiltrosAlunos>, depois: ReturnType<typeof lerFiltrosAlunos>) =>
  sincronizarCamposFiltro(atuais, camposDosFiltros(antes), camposDosFiltros(depois));

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

  it("nome completo: \"Ana Silva\" exige cada palavra em algum campo (nome e sobrenome em colunas separadas)", () => {
    const w = whereFiltrosAlunos(lerFiltrosAlunos({ busca: "  Ana   Silva " })) as { AND: { OR: Record<string, { contains: string }>[] }[] };
    expect(w.AND).toHaveLength(2);
    expect(w.AND.map((c) => c.OR[0].primeiroNome.contains)).toEqual(["Ana", "Silva"]);
    // Aluna com primeiroNome "Ana" e sobrenome "Silva": cada condição acha a palavra em algum campo.
    const aluna = { primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null, codigo: "A-1" } as Record<string, string | null>;
    const atende = w.AND.every((c) => c.OR.some((campo) => {
      const [nome, { contains }] = Object.entries(campo)[0];
      return (aluna[nome] ?? "").toLowerCase().includes(contains.toLowerCase());
    }));
    expect(atende).toBe(true);
  });
  it("turma do professor fica presa às turmas dele (URL montada à mão não revela turma alheia)", () => {
    const escopo = { vinculosDocentes: { some: { professorId: "prof" } } };
    const w = whereFiltrosAlunos(lerFiltrosAlunos({ turma: "t1" }), escopo as never);
    expect(w).toEqual({ AND: [{ alocacoes: { some: { ativa: true, turmaId: "t1", turma: escopo } } }] });
    expect(whereFiltrosAlunos(lerFiltrosAlunos({ turma: "t1" }))).toEqual({ AND: [{ alocacoes: { some: { ativa: true, turmaId: "t1" } } }] });
  });
});

describe("lógica da página e do formulário (funções puras)", () => {
  const opcoes = { paises: [{ id: "p1" }], turmas: [{ id: "t1" }] };

  it("sanearFiltrosAlunos descarta país/turma fora das opções e mantém os válidos", () => {
    expect(sanearFiltrosAlunos(lerFiltrosAlunos({ pais: "p9", turma: "t1", status: "ATIVO" }), opcoes))
      .toMatchObject({ paisId: null, turmaId: "t1", status: "ATIVO" });
  });

  it("destinoPaginaAlunos: página além do fim vai para a última; página válida não redireciona", () => {
    expect(destinoPaginaAlunos(lerFiltrosAlunos({ pagina: "9", status: "ATIVO" }), 120)).toBe("/alunos?status=ATIVO&pagina=3");
    expect(destinoPaginaAlunos(lerFiltrosAlunos({ pagina: "9" }), 0)).toBe("/alunos");
    expect(destinoPaginaAlunos(lerFiltrosAlunos({ pagina: "3" }), 120)).toBeNull();
  });

  it("sincronizarCampos: só o campo cujo filtro mudou é atualizado — a busca em edição sobrevive ao select", () => {
    const antes = lerFiltrosAlunos({ status: "ATIVO" });
    const depois = lerFiltrosAlunos({ status: "PAUSADO" });
    const digitando = { busca: "mar", status: "PAUSADO", pais: "", turma: "" };
    expect(sincronizarCampos(digitando, antes, depois)).toEqual({ busca: "mar", status: "PAUSADO", pais: "", turma: "" });
  });

  it("sincronizarCampos: Limpar/voltar do navegador atualiza todos os campos que mudaram", () => {
    const antes = lerFiltrosAlunos({ busca: "ana", status: "ATIVO" });
    expect(sincronizarCampos({ busca: "ana", status: "ATIVO", pais: "", turma: "" }, antes, lerFiltrosAlunos({})))
      .toEqual({ busca: "", status: "", pais: "", turma: "" });
  });

  it("hrefDosCampos valida e volta à página 1", () => {
    expect(hrefDosCampos({ busca: " mar ", status: "X", pais: "p1", turma: "" })).toBe("/alunos?busca=mar&pais=p1");
    expect(hrefAlunos(lerFiltrosAlunos({}))).toBe("/alunos");
  });
});
