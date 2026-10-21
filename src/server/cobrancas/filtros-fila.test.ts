import { describe, expect, it } from "vitest";
import {
  INDICADORES_FILA,
  ROTA_FILA,
  compararFila,
  contarIndicadoresFila,
  cursorDoItemFila,
  filtrarFila,
  filtrosFilaParaQuery,
  hrefDosCamposFila,
  hrefFila,
  hrefFilaNoCursor,
  hrefIndicador,
  hrefSemBusca,
  hrefSemIndicador,
  lerCursorFila,
  lerFiltrosFila,
  navegacaoDaFilaValida,
  opcoesDaFila,
  temBuscaFila,
  trechoDaFila,
} from "./filtros-fila";
import { CURSOR_FILA } from "@/lib/cursor-fila";

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

describe("cursor da fila de cobrança (docs/43 §6 item 9)", () => {
  type Chave = { id: string; prioridade: number; diasAtraso: number };
  const k = (id: string, prioridade: number, diasAtraso: number): Chave => ({ id, prioridade, diasAtraso });

  it("ordem da fila: prioridade, maior atraso e, no empate dos dois, o id — dois itens nunca empatam", () => {
    const xs = [k("b", 2, 5), k("a", 2, 5), k("c", 1, 0), k("d", 2, 9)];
    expect([...xs].sort(compararFila).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(compararFila(k("a", 2, 5), k("a", 2, 5))).toBe(0);
    // Na fila filtrada, o empate de prioridade e atraso também termina no id (ordem estável entre leituras).
    expect(filtrarFila([item("z", { prioridade: 1, diasAtraso: 3 }), item("y", { prioridade: 1, diasAtraso: 3 })], lerFiltrosFila({})).map((x) => x.id)).toEqual(["y", "z"]);
  });

  it("o cursor é a chave de ordem, passa no formato dos cursores e volta igual", () => {
    for (const c of [k("cm1abc", 3, -5), k("x-1", 900, 0), k("abc", 1, 400)]) {
      const texto = cursorDoItemFila(c);
      expect(CURSOR_FILA.test(texto), texto).toBe(true);
      expect(lerCursorFila(texto)).toEqual(c);
    }
    expect(cursorDoItemFila(k("cm1abc", 3, -5))).toBe("3_-5_cm1abc");
    for (const ruim of ["cm1abc", "3_cm1abc", "a_b_c", "3_-5_", "3_-5_x_y", "1.5_2_x"]) expect(lerCursorFila(ruim), ruim).toBeNull();
    expect(navegacaoDaFilaValida({})).toBe(true);
    expect(navegacaoDaFilaValida({ depois: "1_2_x" })).toBe(true);
    expect(navegacaoDaFilaValida({ antes: "x" })).toBe(false);
  });

  it("trecho: sem cursor os primeiros; depois os seguintes; antes os anteriores, do mais próximo ao mais distante", () => {
    const fila = [k("a", 1, 9), k("b", 1, 5), k("c", 2, 7), k("d", 3, 0), k("e", 3, -2)];
    const ids = (xs: Chave[]) => xs.map((x) => x.id);
    expect(ids(trechoDaFila(fila, {}, 2))).toEqual(["a", "b"]);
    expect(ids(trechoDaFila(fila, { depois: cursorDoItemFila(fila[1]) }, 2))).toEqual(["c", "d"]);
    expect(ids(trechoDaFila(fila, { antes: cursorDoItemFila(fila[3]) }, 2))).toEqual(["c", "b"]);
    // O item do cursor saiu da fila (pago): a chave continua sendo a fronteira, ninguém é pulado.
    const semB = fila.filter((x) => x.id !== "b");
    expect(ids(trechoDaFila(semB, { depois: cursorDoItemFila(fila[1]) }, 2))).toEqual(["c", "d"]);
    // Cursor fora do formato: nada.
    expect(trechoDaFila(fila, { depois: "b" }, 2)).toEqual([]);
  });

  it("link no cursor mantém os filtros; um sentido de cada vez", () => {
    const f = lerFiltrosFila({ indicador: "emAtraso", busca: "ana" });
    expect(hrefFilaNoCursor(f, { depois: "1_2_x" })).toBe(`${ROTA_FILA}?indicador=emAtraso&busca=ana&depois=1_2_x`);
    expect(hrefFilaNoCursor(lerFiltrosFila({}), { antes: "1_2_x" })).toBe(`${ROTA_FILA}?antes=1_2_x`);
    // Os links de filtro voltam ao início (sem cursor): trocar o recorte reinicia a leitura.
    expect(hrefIndicador(f, "bloquear")).not.toMatch(/antes=|depois=/);
  });
});
