import { describe, expect, it } from "vitest";
import { z } from "zod";
import { alemDoCursor, camposNavegacaoFila, corteDoId, direcaoDeLeitura, lerNavegacao, lerPaginaDaFila, MENSAGEM_CURSOR_INVALIDO, MENSAGEM_DOIS_SENTIDOS, recorteDaFila, umSentido, type NavegacaoFila } from "./cursor-fila";

// Cursor nos dois sentidos das filas de trabalho (E4, decisão de 10/10/2026). Fila de mentira: ids em
// ordem ("f00"…), lidos como o Prisma leria com o corte do id e a direção de leitura.
const ids = (n: number) => Array.from({ length: n }, (_, i) => `f${String(i).padStart(2, "0")}`);

/** Leitura sobre `visiveis` (a fila de agora), em ordem asc pelo id, com o corte e a direção do cursor. */
const leitor = (visiveis: () => string[]) => async (nav: NavegacaoFila, take: number) => {
  const corte = corteDoId(nav, "asc").id;
  const sentido = direcaoDeLeitura(nav)("asc");
  const filtrados = visiveis().filter((id) => !corte || (corte.gt !== undefined ? id > corte.gt : id < (corte.lt as string)));
  return (sentido === "asc" ? filtrados : [...filtrados].reverse()).slice(0, take);
};
const proprio = (id: string) => id;

describe("cursor das filas: URL e validação", () => {
  it("lê depois/antes da URL (e de um segundo painel), sem vazios", () => {
    expect(lerNavegacao({ depois: " f03 " })).toEqual({ depois: "f03" });
    expect(lerNavegacao({ antes: ["f01", "f02"] })).toEqual({ antes: "f01" });
    expect(lerNavegacao({ depois: "", antes: "" })).toEqual({});
    expect(lerNavegacao({ depoisPendencias: "p1", depois: "a1" }, "Pendencias")).toEqual({ depois: "p1" });
  });

  it("cursor com formato inválido e os dois sentidos juntos são recusados", () => {
    const schema = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS);
    expect(schema.parse({ depois: "cm1abc_-9" })).toEqual({ depois: "cm1abc_-9" });
    for (const ruim of ["", "a b", "a/../b", "x".repeat(101), "id?x=1"]) {
      const r = schema.safeParse({ depois: ruim });
      expect(r.success, ruim).toBe(false);
      if (!r.success) expect(r.error.errors[0]?.message).toBe(MENSAGEM_CURSOR_INVALIDO);
    }
    const ambos = schema.safeParse({ depois: "a", antes: "b" });
    expect(ambos.success).toBe(false);
    if (!ambos.success) expect(ambos.error.errors[0]?.message).toBe(MENSAGEM_DOIS_SENTIDOS);
  });

  it("direção de leitura e limite estrito: antes inverte a ordem e o lado do corte", () => {
    expect(direcaoDeLeitura({})("desc")).toBe("desc");
    expect(direcaoDeLeitura({ depois: "a" })("asc")).toBe("asc");
    expect(direcaoDeLeitura({ antes: "a" })("asc")).toBe("desc");
    expect(alemDoCursor({ depois: "a" }, "asc", 5)).toEqual({ gt: 5 });
    expect(alemDoCursor({ depois: "a" }, "desc", 5)).toEqual({ lt: 5 });
    expect(alemDoCursor({ antes: "a" }, "asc", 5)).toEqual({ lt: 5 });
    expect(alemDoCursor({ antes: "a" }, "desc", 5)).toEqual({ gt: 5 });
    expect(corteDoId({}, "asc")).toEqual({});
    expect(corteDoId({ antes: "f05" }, "desc")).toEqual({ id: { gt: "f05" } });
  });
});

describe("cursor das filas: páginas", () => {
  it("ida e volta devolvem os mesmos itens; a primeira não tem anterior e a última não tem próxima", async () => {
    const fila = ids(23), ler = leitor(() => fila);
    const p1 = await lerPaginaDaFila({}, 10, ler, proprio);
    expect(p1).toMatchObject({ temAnterior: false, temProxima: true, anterior: null, proxima: "f09" });
    const p2 = await lerPaginaDaFila({ depois: p1.proxima! }, 10, ler, proprio);
    expect(p2).toMatchObject({ temAnterior: true, temProxima: true, anterior: "f10", proxima: "f19" });
    const p3 = await lerPaginaDaFila({ depois: p2.proxima! }, 10, ler, proprio);
    expect(p3).toMatchObject({ registros: ["f20", "f21", "f22"], temAnterior: true, temProxima: false, proxima: null });
    expect((await lerPaginaDaFila({ antes: p3.anterior! }, 10, ler, proprio)).registros).toEqual(p2.registros);
    const volta = await lerPaginaDaFila({ antes: p2.anterior! }, 10, ler, proprio);
    expect(volta).toEqual(p1);
  });

  it("resolver um item da primeira página não faz a próxima pular ninguém", async () => {
    const fila = ids(23), ler = leitor(() => fila);
    const p1 = await lerPaginaDaFila({}, 10, ler, proprio);
    fila.splice(fila.indexOf("f03"), 1); // alguém resolveu f03: ele sai da fila
    const p2 = await lerPaginaDaFila({ depois: p1.proxima! }, 10, ler, proprio);
    expect(p2.registros[0]).toBe("f10");
    expect([...p1.registros, ...p2.registros]).toEqual(ids(20));
  });

  it("ao voltar e chegar ao começo, a página é a primeira, cheia e sem anterior", async () => {
    const fila = ids(23), ler = leitor(() => fila);
    // f00…f07 foram resolvidos: antes de f10 sobram só f08 e f09.
    fila.splice(0, 8);
    const volta = await lerPaginaDaFila({ antes: "f10" }, 10, ler, proprio);
    expect(volta).toMatchObject({ registros: ids(18).slice(8), temAnterior: false, temProxima: true, anterior: null });
  });

  it("depois do fim (ou de um cursor que não leva a nada) a página é vazia e sem navegação", async () => {
    const ler = leitor(() => ids(5));
    expect(await lerPaginaDaFila({ depois: "f04" }, 10, ler, proprio)).toEqual({ registros: [], temAnterior: false, temProxima: false, anterior: null, proxima: null });
    expect(recorteDaFila([], 10, { antes: "x" }, proprio)).toMatchObject({ temAnterior: false, temProxima: false });
  });
});
