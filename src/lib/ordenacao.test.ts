import { describe, expect, it } from "vitest";
import {
  anexarOrdenacao,
  hrefOrdenacao,
  lerOrdenacao,
  mesmaOrdenacao,
  orderByDe,
  parametrosDaQuery,
  parametrosOrdenacao,
  proximaDirecao,
  type CriteriosOrdenacao,
  type Ordenacao,
} from "./ordenacao";

const CAMPOS = ["nome", "valor"] as const;
const PADRAO: Ordenacao<(typeof CAMPOS)[number]> = { campo: "nome", dir: "asc" };

describe("lerOrdenacao — lista fechada", () => {
  it("coluna da lista e direção válida", () => {
    expect(lerOrdenacao({ ordem: "valor", dir: "desc" }, CAMPOS, PADRAO)).toEqual({ campo: "valor", dir: "desc" });
    expect(lerOrdenacao(new URLSearchParams("ordem=nome&dir=asc"), CAMPOS, PADRAO)).toEqual({ campo: "nome", dir: "asc" });
  });

  it("coluna fora da lista (ou nome de propriedade do objeto) → ordem padrão da tela", () => {
    for (const ordem of ["cpf", "id", "constructor", "__proto__", "", " valor; drop"]) {
      expect(lerOrdenacao({ ordem, dir: "desc" }, CAMPOS, PADRAO)).toBe(PADRAO);
    }
    expect(lerOrdenacao({}, CAMPOS, PADRAO)).toBe(PADRAO);
    expect(lerOrdenacao({ ordem: "cpf" }, CAMPOS, null)).toBeNull();
  });

  it("direção ausente ou inválida → crescente; valor repetido vale o primeiro", () => {
    expect(lerOrdenacao({ ordem: "valor" }, CAMPOS, PADRAO)).toEqual({ campo: "valor", dir: "asc" });
    expect(lerOrdenacao({ ordem: "valor", dir: "DESC; drop" }, CAMPOS, PADRAO)).toEqual({ campo: "valor", dir: "asc" });
    expect(lerOrdenacao({ ordem: ["valor", "nome"], dir: ["desc", "asc"] }, CAMPOS, PADRAO)).toEqual({ campo: "valor", dir: "desc" });
  });
});

describe("parâmetros e links", () => {
  it("ordem padrão não vai para a URL (links antigos ficam iguais)", () => {
    expect(parametrosOrdenacao(PADRAO, PADRAO)).toEqual({ ordem: null, dir: null });
    expect(parametrosOrdenacao(null, null)).toEqual({ ordem: null, dir: null });
    expect(parametrosOrdenacao({ campo: "nome", dir: "desc" }, PADRAO)).toEqual({ ordem: "nome", dir: "desc" });
    expect(anexarOrdenacao(new URLSearchParams("busca=a"), { campo: "valor", dir: "asc" }, PADRAO).toString()).toBe("busca=a&ordem=valor&dir=asc");
    expect(anexarOrdenacao(new URLSearchParams("busca=a"), PADRAO, PADRAO).toString()).toBe("busca=a");
    expect(mesmaOrdenacao(null, PADRAO)).toBe(false);
  });

  it("clique: inverte na coluna atual; noutra coluna, a direção inicial dela", () => {
    expect(proximaDirecao(PADRAO, "nome")).toBe("desc");
    expect(proximaDirecao({ campo: "nome", dir: "desc" }, "nome")).toBe("asc");
    expect(proximaDirecao(PADRAO, "valor")).toBe("asc");
    expect(proximaDirecao(PADRAO, "valor", "desc")).toBe("desc");
    expect(proximaDirecao(null, "valor", "desc")).toBe("desc");
  });

  it("href: preserva filtros, troca a ordem e tira a página", () => {
    expect(hrefOrdenacao("/x", { busca: "ana", status: "ATIVO", pagina: "3", ordem: "nome", dir: "asc", vazio: "" }, { campo: "valor", dir: "desc" }))
      .toBe("/x?busca=ana&status=ATIVO&ordem=valor&dir=desc");
    expect(hrefOrdenacao("/x", {}, { campo: "nome", dir: "asc" })).toBe("/x?ordem=nome&dir=asc");
    expect(parametrosDaQuery("busca=ana+silva&status=ATIVO")).toEqual({ busca: "ana silva", status: "ATIVO" });
  });
});

describe("orderByDe — desempate estável por id", () => {
  type Criterio = Record<string, unknown>;
  const criterios: CriteriosOrdenacao<"nome" | "valor", Criterio> = {
    nome: (dir) => [{ nome: dir }],
    valor: (dir) => [{ moeda: "asc" }, { valor: dir }, { id: dir }],
  };
  const padrao: Criterio[] = [{ criadoEm: "desc" }, { id: "desc" }];

  it("acrescenta id quando a coluna não desempata; não duplica quando já desempata", () => {
    expect(orderByDe({ campo: "nome", dir: "desc" }, criterios, padrao)).toEqual([{ nome: "desc" }, { id: "desc" }]);
    expect(orderByDe({ campo: "valor", dir: "asc" }, criterios, padrao)).toEqual([{ moeda: "asc" }, { valor: "asc" }, { id: "asc" }]);
  });

  it("sem ordem (ou coluna desconhecida): o padrão da consulta, com id", () => {
    expect(orderByDe(null, criterios, padrao)).toEqual(padrao);
    expect(orderByDe({ campo: "constructor" as "nome", dir: "asc" }, criterios, padrao)).toEqual(padrao);
    expect(orderByDe(null, criterios, [{ criadoEm: "desc" }])).toEqual([{ criadoEm: "desc" }, { id: "asc" }]);
  });

  it("todo critério termina num id (relação com campo `id` aninhado não conta como desempate)", () => {
    const aninhado: CriteriosOrdenacao<"rel", Criterio> = { rel: (dir) => [{ vendedor: { id: dir } }] };
    expect(orderByDe({ campo: "rel", dir: "asc" }, aninhado, [])).toEqual([{ vendedor: { id: "asc" } }, { id: "asc" }]);
  });
});
