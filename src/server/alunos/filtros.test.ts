import { StatusAluno } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { camposDosFiltros, destinoPaginaAlunos, filtrosParaQuery, hrefAlunos, hrefDosCampos, lerFiltrosAlunos, orderByAlunos, parametrosFiltrosAlunos, sanearFiltrosAlunos, temFiltroAlunos, whereFiltrosAlunos } from "./filtros";
import { sincronizarCamposFiltro } from "@/lib/filtros-url";

// A lista usa a sincronização genérica (useFiltrosUrl) sobre os campos derivados destes filtros.
const sincronizarCampos = (atuais: ReturnType<typeof camposDosFiltros>, antes: ReturnType<typeof lerFiltrosAlunos>, depois: ReturnType<typeof lerFiltrosAlunos>) =>
  sincronizarCamposFiltro(atuais, camposDosFiltros(antes), camposDosFiltros(depois));

describe("lerFiltrosAlunos", () => {
  it("lê, apara e valida os filtros da URL", () => {
    expect(lerFiltrosAlunos({ busca: "  ana ", status: "PAUSADO", pais: "p1", turma: "t-9", pagina: "3" }))
      .toEqual({ busca: "ana", status: StatusAluno.PAUSADO, paisId: "p1", turmaId: "t-9", pagina: 3, ordem: { campo: "nome", dir: "asc" } });
  });

  it("descarta o que não é válido e ignora chaves desconhecidas", () => {
    expect(lerFiltrosAlunos({ status: "APAGADO", pais: "x'; drop", turma: "a".repeat(65), pagina: "0", colunas: "cpf", ids: "1" }))
      .toEqual({ busca: "", status: null, paisId: null, turmaId: null, pagina: 1, ordem: { campo: "nome", dir: "asc" } });
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

describe("teto da busca", () => {
  it("no máximo 6 palavras: a 7ª em diante é descartada (limita o tamanho da consulta)", () => {
    const where = whereFiltrosAlunos(lerFiltrosAlunos({ busca: "a b c d e f g" })) as { AND: unknown[] };
    expect(where.AND).toHaveLength(6);
    expect(JSON.stringify(where)).not.toContain('"g"');
  });
});

describe("ordenação da lista (E1 — ColunaOrdenavel)", () => {
  it("lista fechada: nome, país e status; fora dela (ou sem ordem) → nome crescente, a ordem de sempre", () => {
    expect(lerFiltrosAlunos({ ordem: "pais", dir: "desc" }).ordem).toEqual({ campo: "pais", dir: "desc" });
    expect(lerFiltrosAlunos({ ordem: "status" }).ordem).toEqual({ campo: "status", dir: "asc" });
    for (const ordem of ["turma", "financeiro", "cpf", "id", "criadoEm"]) {
      expect(lerFiltrosAlunos({ ordem, dir: "desc" }).ordem).toEqual({ campo: "nome", dir: "asc" });
    }
  });

  it("orderBy: padrão idêntico ao de antes; cada coluna termina no desempate por id", () => {
    expect(orderByAlunos()).toEqual([{ primeiroNome: "asc" }, { sobrenome: "asc" }, { id: "asc" }]);
    expect(orderByAlunos(lerFiltrosAlunos({}).ordem)).toEqual([{ primeiroNome: "asc" }, { sobrenome: "asc" }, { id: "asc" }]);
    // Decrescente por nome é o inverso exato da crescente (inclusive o desempate).
    expect(orderByAlunos({ campo: "nome", dir: "desc" })).toEqual([{ primeiroNome: "desc" }, { sobrenome: "desc" }, { id: "desc" }]);
    expect(orderByAlunos({ campo: "pais", dir: "desc" })).toEqual([{ pais: { nome: "desc" } }, { primeiroNome: "asc" }, { sobrenome: "asc" }, { id: "asc" }]);
    expect(orderByAlunos({ campo: "status", dir: "asc" })).toEqual([{ status: "asc" }, { primeiroNome: "asc" }, { sobrenome: "asc" }, { id: "asc" }]);
  });

  it("a ordem vai na query (paginação, exportação, redirecionamento) só quando não é a padrão", () => {
    const f = lerFiltrosAlunos({ status: "ATIVO", ordem: "pais", dir: "desc", pagina: "2" });
    expect(filtrosParaQuery(f)).toBe("status=ATIVO&ordem=pais&dir=desc&pagina=2");
    expect(filtrosParaQuery(f, { semPagina: true })).toBe("status=ATIVO&ordem=pais&dir=desc");
    expect(lerFiltrosAlunos(new URLSearchParams(filtrosParaQuery(f)))).toEqual(f);
    expect(filtrosParaQuery(lerFiltrosAlunos({ status: "ATIVO", ordem: "nome", dir: "asc" }))).toBe("status=ATIVO");
    expect(destinoPaginaAlunos(lerFiltrosAlunos({ ordem: "status", dir: "desc", pagina: "9" }), 120)).toBe("/alunos?ordem=status&dir=desc&pagina=3");
  });

  it("ordem não é filtro; buscar mantém a ordem atual; os cabeçalhos recebem só busca e filtros", () => {
    const f = lerFiltrosAlunos({ busca: "ana", ordem: "pais", dir: "desc", pagina: "3" });
    expect(temFiltroAlunos(lerFiltrosAlunos({ ordem: "pais" }))).toBe(false);
    expect(hrefDosCampos({ busca: "mar", status: "", pais: "", turma: "" }, f.ordem)).toBe("/alunos?busca=mar&ordem=pais&dir=desc");
    expect(hrefDosCampos({ busca: "mar", status: "", pais: "", turma: "" })).toBe("/alunos?busca=mar");
    expect(parametrosFiltrosAlunos(f)).toEqual({ busca: "ana" });
  });
});

// Revisão R1 da #136 (B4): chave herdada de Object não é coluna — cai na ordem padrão (e não vai para a URL).
describe("ordem de /alunos: chave herdada de Object", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])("ordem=%s → ordem padrão", (ordem) => {
    expect(lerFiltrosAlunos({ ordem, dir: "desc" }).ordem).toEqual(lerFiltrosAlunos({}).ordem);
  });
});
