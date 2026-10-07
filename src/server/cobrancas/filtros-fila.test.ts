import { describe, expect, it } from "vitest";
import {
  INDICADORES_FILA,
  ROTA_FILA,
  contarIndicadoresFila,
  filtrarFila,
  filtrosFilaParaQuery,
  hrefDosCamposFila,
  hrefFila,
  hrefIndicador,
  hrefSemBusca,
  hrefSemIndicador,
  lerFiltrosFila,
  opcoesDaFila,
  temBuscaFila,
} from "./filtros-fila";

type Item = Parameters<typeof filtrarFila>[0][number];
const item = (id: string, o: Partial<Item> = {}): Item & { id: string } => ({
  id, estado: "acao_devida", diasAtraso: 3, precisaBloqueio: false, codigo: `COB-${id}`, pais: "Brasil", turma: null, prioridade: 2,
  aluno: { nome: `Aluno ${id}` }, ...o,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("filtros da fila de cobrança na URL (E4)", () => {
  it("lê e valida: indicador só da lista fechada; textos sem espaços nas pontas e com teto de 100", () => {
    expect(lerFiltrosFila({ indicador: "emAtraso", busca: "  ana ", pais: " Brasil ", turma: "Inglês A1" }))
      .toEqual({ indicador: "emAtraso", busca: "ana", pais: "Brasil", turma: "Inglês A1" });
    expect(lerFiltrosFila({})).toEqual({ indicador: null, busca: "", pais: null, turma: null });
    for (const indicador of ["todos", "EMATRASO", "constructor", "__proto__", "toString"]) expect(lerFiltrosFila({ indicador }).indicador).toBeNull();
    const longo = lerFiltrosFila({ busca: "x".repeat(300), pais: "p".repeat(300), turma: "t".repeat(300) });
    expect([longo.busca.length, longo.pais?.length, longo.turma?.length]).toEqual([100, 100, 100]);
    // Também de URLSearchParams e de parâmetro repetido (vale o primeiro).
    expect(lerFiltrosFila(new URLSearchParams("indicador=bloquear&busca=bia")).indicador).toBe("bloquear");
    expect(lerFiltrosFila({ indicador: ["promessas", "aVencer"] }).indicador).toBe("promessas");
  });

  it("query sem vazios; a rota da aba quando não há filtro", () => {
    expect(filtrosFilaParaQuery(lerFiltrosFila({ turma: "Inglês A1", indicador: "aVencer", busca: "ana silva", pais: "Costa Rica" })))
      .toBe("indicador=aVencer&busca=ana+silva&pais=Costa+Rica&turma=Ingl%C3%AAs+A1");
    expect(hrefFila(lerFiltrosFila({}))).toBe(ROTA_FILA);
    expect(hrefFila(lerFiltrosFila({ indicador: "x", busca: "  " }))).toBe(ROTA_FILA);
  });

  it("cartão-indicador alterna (o ativo desliga) e mantém a busca; cada limpar tira só o seu lado", () => {
    const f = lerFiltrosFila({ indicador: "emAtraso", busca: "ana", pais: "Brasil" });
    expect(hrefIndicador(f, "bloquear")).toBe(`${ROTA_FILA}?indicador=bloquear&busca=ana&pais=Brasil`);
    expect(hrefIndicador(f, "emAtraso")).toBe(`${ROTA_FILA}?busca=ana&pais=Brasil`);
    expect(hrefSemIndicador(f)).toBe(`${ROTA_FILA}?busca=ana&pais=Brasil`);
    expect(hrefSemBusca(f)).toBe(`${ROTA_FILA}?indicador=emAtraso`);
    expect(temBuscaFila(f)).toBe(true);
    expect(temBuscaFila(lerFiltrosFila({ indicador: "emAtraso" }))).toBe(false);
  });

  it("link a partir dos campos: mesmo leitor, valor vazio fica de fora, o indicador escolhido é mantido", () => {
    expect(hrefDosCamposFila({ busca: " ana ", pais: "", turma: "Inglês A1" }, "promessas")).toBe(`${ROTA_FILA}?indicador=promessas&busca=ana&turma=Ingl%C3%AAs+A1`);
    expect(hrefDosCamposFila({ busca: "", pais: "", turma: "" })).toBe(ROTA_FILA);
  });
});

describe("filtrarFila", () => {
  const fila = [
    item("vence", { diasAtraso: -2 }),
    item("vence2", { diasAtraso: -9 }),
    // Fronteira: vence hoje (diasAtraso 0, fora de promessa) — o contador o põe em "A vencer".
    item("hoje", { diasAtraso: 0 }),
    item("atraso", { diasAtraso: 5 }),
    item("bloqueio", { diasAtraso: 20, precisaBloqueio: true }),
    item("promessa", { estado: "promessa", diasAtraso: 4 }),
  ];
  const por = (indicador: string) => ids(filtrarFila(fila, lerFiltrosFila({ indicador }))).sort();

  it("cada indicador com o mesmo critério dos contadores (Bloquear ⊂ Em atraso; promessa fora de A vencer/Em atraso)", () => {
    expect(por("aVencer")).toEqual(["hoje", "vence", "vence2"]);
    expect(por("emAtraso")).toEqual(["atraso", "bloqueio"]);
    expect(por("bloquear")).toEqual(["bloqueio"]);
    expect(por("promessas")).toEqual(["promessa"]);
    expect(filtrarFila(fila, lerFiltrosFila({}))).toHaveLength(6);
  });

  it("vence hoje (diasAtraso 0) entra em A vencer e fica fora de Em atraso; um dia depois, o contrário", () => {
    const hoje = [item("hoje", { diasAtraso: 0 })];
    expect(ids(filtrarFila(hoje, lerFiltrosFila({ indicador: "aVencer" })))).toEqual(["hoje"]);
    expect(filtrarFila(hoje, lerFiltrosFila({ indicador: "emAtraso" }))).toEqual([]);
    expect(contarIndicadoresFila(hoje)).toEqual({ aVencer: 1, emAtraso: 0, bloquear: 0, promessas: 0 });
    const ontem = [item("ontem", { diasAtraso: 1 })];
    expect(filtrarFila(ontem, lerFiltrosFila({ indicador: "aVencer" }))).toEqual([]);
    expect(ids(filtrarFila(ontem, lerFiltrosFila({ indicador: "emAtraso" })))).toEqual(["ontem"]);
    expect(contarIndicadoresFila(ontem)).toEqual({ aVencer: 0, emAtraso: 1, bloquear: 0, promessas: 0 });
    // Promessa que vence hoje não é "A vencer": está em "Promessas".
    expect(contarIndicadoresFila([item("p", { estado: "promessa", diasAtraso: 0 })])).toEqual({ aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 1 });
  });

  it("o número de cada cartão (contador de listarFilaCobranca) é o tamanho da lista filtrada por ele", () => {
    const contador = contarIndicadoresFila(fila);
    expect(contador).toEqual({ aVencer: 3, emAtraso: 2, bloquear: 1, promessas: 1 });
    // Cópia literal das chaves (não itera INDICADORES_FILA): um indicador novo exige rever este teste.
    expect([...INDICADORES_FILA]).toEqual(["aVencer", "emAtraso", "bloquear", "promessas"]);
    for (const indicador of ["aVencer", "emAtraso", "bloquear", "promessas"] as const) {
      expect(filtrarFila(fila, lerFiltrosFila({ indicador })), indicador).toHaveLength(contador[indicador]);
    }
  });

  it("busca por palavras: cada uma no nome do aluno ou no código, sem diferenciar maiúsculas", () => {
    const xs = [item("1", { aluno: { nome: "Ana Silva" }, codigo: "COB-77" }), item("2", { aluno: { nome: "Bruno Silva" }, codigo: "COB-88" })];
    expect(ids(filtrarFila(xs, lerFiltrosFila({ busca: "silva ANA" })))).toEqual(["1"]);
    expect(ids(filtrarFila(xs, lerFiltrosFila({ busca: "cob-88" })))).toEqual(["2"]);
    expect(ids(filtrarFila(xs, lerFiltrosFila({ busca: "silva" }))).sort()).toEqual(["1", "2"]);
    expect(filtrarFila(xs, lerFiltrosFila({ busca: "carla" }))).toEqual([]);
  });

  it("teto de 6 palavras: a 7ª em diante é descartada", () => {
    const xs = [item("1", { aluno: { nome: "Ana Silva" } })];
    expect(ids(filtrarFila(xs, lerFiltrosFila({ busca: "ana silva ana silva ana silva naoexiste" })))).toEqual(["1"]);
    expect(filtrarFila(xs, lerFiltrosFila({ busca: "ana silva ana silva ana naoexiste" }))).toEqual([]);
  });

  it("país e turma exatos, em AND com o indicador e a busca", () => {
    const xs = [item("br", { pais: "Brasil", turma: "Inglês A1" }), item("cr", { pais: "Costa Rica", turma: "Inglês A1" }), item("cr2", { pais: "Costa Rica", turma: null, diasAtraso: -1 })];
    expect(ids(filtrarFila(xs, lerFiltrosFila({ pais: "Costa Rica" }))).sort()).toEqual(["cr", "cr2"]);
    expect(ids(filtrarFila(xs, lerFiltrosFila({ turma: "Inglês A1" }))).sort()).toEqual(["br", "cr"]);
    expect(ids(filtrarFila(xs, lerFiltrosFila({ pais: "Costa Rica", indicador: "emAtraso" })))).toEqual(["cr"]);
  });

  it("ordena por prioridade e, no empate, pelo maior atraso — sem alterar a lista recebida", () => {
    const xs = [item("a", { prioridade: 2, diasAtraso: 1 }), item("b", { prioridade: 1, diasAtraso: 1 }), item("c", { prioridade: 2, diasAtraso: 9 })];
    expect(ids(filtrarFila(xs, lerFiltrosFila({})))).toEqual(["b", "c", "a"]);
    expect(ids(xs)).toEqual(["a", "b", "c"]);
  });
});

describe("opcoesDaFila", () => {
  it("valores únicos e ordenados da fila inteira, sem turma vazia", () => {
    const xs = [item("1", { pais: "Costa Rica", turma: "Inglês B1" }), item("2", { pais: "Brasil", turma: null }), item("3", { pais: "Costa Rica", turma: "Inglês A1" })];
    expect(opcoesDaFila(xs, lerFiltrosFila({}))).toEqual({ paises: ["Brasil", "Costa Rica"], turmas: ["Inglês A1", "Inglês B1"] });
  });

  it("país/turma da URL que saiu da fila continua como opção (o select mostra o filtro aplicado)", () => {
    expect(opcoesDaFila([item("1")], lerFiltrosFila({ pais: "Panamá", turma: "Francês A2" }))).toEqual({ paises: ["Brasil", "Panamá"], turmas: ["Francês A2"] });
  });
});
