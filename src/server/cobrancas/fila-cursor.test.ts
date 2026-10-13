import { beforeEach, describe, expect, it, vi } from "vitest";

// Fila de cobrança por cursor nos dois sentidos (docs/43 §6 item 9; decisão de 10/10/2026 para filas de
// trabalho). Sem banco: o Prisma é mockado e o `findMany` responde como o banco — sem `where.id.in`, a fila
// inteira (a leitura leve); com ele, só as cobranças pedidas (o detalhe do trecho). A régua (proximaAcao)
// devolve o atraso de cada cobrança a partir do vencimento.

const m = vi.hoisted(() => ({
  cobrancas: vi.fn(),
  eventos: vi.fn(),
  templates: vi.fn(),
  intencoes: vi.fn(),
  atendimentos: vi.fn(),
  proximaAcao: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobranca: { findMany: m.cobrancas },
    evento: { findMany: m.eventos },
    templateWhatsApp: { findMany: m.templates },
    intencaoMensagem: { findMany: m.intencoes },
    atendimentoWhatsApp: { findMany: m.atendimentos },
  },
}));
vi.mock("./politica", () => ({ carregarPoliticaRegua: async () => ({ degraus: [], templateIdPorPasso: new Map() }) }));
vi.mock("./regua", () => ({ proximaAcao: m.proximaAcao }));
vi.mock("./conferencia", () => ({ suspensoesPorConferencia: async () => new Map() }));
vi.mock("./eventos", () => ({ cicloDoEventoCobranca: () => 1 }));
vi.mock("@/server/financeiro/vencimento-civil", () => ({
  carregarTrilhasVencimentoCivil: async () => ({ vencimentosPorCobranca: new Map(), m01PorCobranca: new Map(), retomadasReprogramadas: [] }),
  incluirFonteVencimentoCivil: {},
  referenciaVencimentoCivil: () => ({ estado: "A_CONFERIR", motivo: "teste" }),
}));
vi.mock("@/server/whatsapp/identidade", () => ({ resolverDestinoCobranca: () => null, INCLUDE_MATRICULA_DESTINO: {} }));
vi.mock("@/server/whatsapp/destinatario-atual", () => ({ contatoCorrespondeDestinoFinanceiro: () => false }));
vi.mock("@/server/whatsapp/render", () => ({ renderizarTemplate: () => ({ corpo: "" }) }));

import { listarFilaCobranca } from "./consultas";
import { FILA_COBRANCA_POR_TRECHO, cursorDoItemFila, lerFiltrosFila } from "./filtros-fila";

type Linha = ReturnType<typeof cobranca>;
/** Cobranças abertas no "banco": tirar uma da lista é pagá-la. */
let abertas: Linha[] = [];
/** Atraso de cada cobrança, pela data de vencimento (cada uma tem a sua). */
const atrasoPorVencimento = new Map<number, number>();

const vencimentoDe = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, i));
function cobranca(id: string, i: number, pais = "Brasil") {
  return {
    id, cicloRegua: 1, codigo: `COB-${id}`, tipo: "MENSALIDADE",
    valorNegociado: 100, valorRecebido: null, saldo: null, moeda: "BRL",
    vencimento: vencimentoDe(i), competencia: "2026-01", matriculaId: `matricula-${id}`,
    matricula: {
      acessoBloqueado: false,
      aluno: { id: `aluno-${id}`, primeiroNome: "Aluno", sobrenome: id, telefoneE164: null, pais: null },
      pais: { nome: pais },
      alocacoes: [],
    },
  };
}

/** `n` cobranças; o atraso decresce com o índice, então a ordem da fila (maior atraso primeiro) é a do índice. */
function semear(n: number, pais = (_i: number) => "Brasil") {
  abertas = [];
  atrasoPorVencimento.clear();
  for (let i = 0; i < n; i++) {
    abertas.push(cobranca(`c${String(i).padStart(3, "0")}`, i, pais(i)));
    atrasoPorVencimento.set(vencimentoDe(i).getTime(), 500 - i);
  }
}
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
/** A chamada leve (a fila inteira) e as do detalhe (só o trecho), separadas pelo `where`. */
const chamadas = () => m.cobrancas.mock.calls.map((c) => c[0] as { where: { id?: { in: string[] } }; take?: number; select?: unknown; include?: unknown });

beforeEach(() => {
  vi.clearAllMocks();
  m.cobrancas.mockImplementation(async (args: { where: { id?: { in: string[] } } }) =>
    args.where.id ? abertas.filter((c) => args.where.id!.in.includes(c.id)) : [...abertas]);
  m.eventos.mockResolvedValue([]);
  m.templates.mockResolvedValue([]);
  m.intencoes.mockResolvedValue([]);
  m.atendimentos.mockResolvedValue([]);
  m.proximaAcao.mockImplementation((entrada: { vencimento: Date }) => {
    const diasAtraso = atrasoPorVencimento.get(entrada.vencimento.getTime());
    if (diasAtraso === undefined) throw new Error(`vencimento inesperado: ${entrada.vencimento.toISOString()}`);
    return { estado: "acao_devida", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 1, promessaAte: null };
  });
});

describe("listarFilaCobranca — trechos por cursor (docs/43 §6 item 9)", () => {
  it("a leitura leve não tem take e só seleciona o que ordena e filtra; o detalhe pesado é só do trecho, com take", async () => {
    semear(120);
    const fila = await listarFilaCobranca();
    const [leve, ...detalhe] = chamadas();
    expect(leve.take).toBeUndefined();
    expect(leve.select).toBeDefined();
    expect(leve.include).toBeUndefined();
    expect(leve.where).toEqual({ status: { in: ["PENDENTE", "ATRASADO"] } });
    expect(detalhe).toHaveLength(1);
    expect(detalhe[0].take).toBe(FILA_COBRANCA_POR_TRECHO);
    expect(detalhe[0].where.id!.in).toEqual(ids(abertas.slice(0, 50)));
    expect(detalhe[0].include).toBeDefined();
    expect(ids(fila.itens)).toEqual(ids(abertas.slice(0, 50)));
    expect(fila).toMatchObject({ totalFila: 120, totalVisao: 120, temAnterior: false, temProxima: true, anterior: null });
    expect(fila.proxima).toBe(cursorDoItemFila({ prioridade: 1, diasAtraso: 500 - 49, id: "c049" }));
  });

  it("cursor nos dois sentidos: ida e volta trazem os mesmos itens; a primeira não tem Anterior e a última não tem Próxima", async () => {
    semear(120);
    const p1 = await listarFilaCobranca();
    const p2 = await listarFilaCobranca({ navegacao: { depois: p1.proxima! } });
    const p3 = await listarFilaCobranca({ navegacao: { depois: p2.proxima! } });
    expect(ids(p2.itens)).toEqual(ids(abertas.slice(50, 100)));
    expect(ids(p3.itens)).toEqual(ids(abertas.slice(100)));
    expect([p2.temAnterior, p2.temProxima, p3.temAnterior, p3.temProxima]).toEqual([true, true, true, false]);
    expect(p3.proxima).toBeNull();
    expect(ids((await listarFilaCobranca({ navegacao: { antes: p3.anterior! } })).itens)).toEqual(ids(p2.itens));
    const volta = await listarFilaCobranca({ navegacao: { antes: p2.anterior! } });
    expect(ids(volta.itens)).toEqual(ids(p1.itens));
    expect(volta.temAnterior).toBe(false);
    expect(new Set([...p1.itens, ...p2.itens, ...p3.itens].map((i) => i.id)).size).toBe(120);
  });

  it("pagar cobranças já vistas — inclusive a do próprio cursor — não faz a próxima pular ninguém", async () => {
    semear(120);
    const p1 = await listarFilaCobranca();
    // Paga a 1ª, a 10ª e a última da página 1 (a do cursor): a numerada subiria c050–c052 para a página 1.
    abertas = abertas.filter((c) => !["c000", "c009", "c049"].includes(c.id));
    const p2 = await listarFilaCobranca({ navegacao: { depois: p1.proxima! } });
    expect(ids(p2.itens)[0]).toBe("c050");
    expect(ids(p2.itens)).toEqual(Array.from({ length: 50 }, (_, i) => `c${String(50 + i).padStart(3, "0")}`));
  });

  it("filtro e cursor juntos: o trecho é da visão filtrada; contadores, total e opções são da fila inteira", async () => {
    semear(120, (i) => (i % 2 ? "Costa Rica" : "Brasil"));
    const filtros = lerFiltrosFila({ pais: "Costa Rica" });
    const p1 = await listarFilaCobranca({ filtros });
    expect(p1.itens.every((i) => i.pais === "Costa Rica")).toBe(true);
    expect(p1).toMatchObject({ totalFila: 120, totalVisao: 60, temProxima: true });
    expect(p1.opcoes.paises).toEqual(["Brasil", "Costa Rica"]);
    expect(p1.dashs.emAtraso).toBe(120);
    const p2 = await listarFilaCobranca({ filtros, navegacao: { depois: p1.proxima! } });
    expect(p2.itens).toHaveLength(10);
    expect(p2.temProxima).toBe(false);
    expect(new Set([...ids(p1.itens), ...ids(p2.itens)]).size).toBe(60);
  });

  it("cursor que não leva a nada (além do fim) devolve o trecho vazio e não lê o detalhe", async () => {
    semear(3);
    const fila = await listarFilaCobranca({ navegacao: { depois: cursorDoItemFila({ prioridade: 999, diasAtraso: -999, id: "zzz" }) } });
    expect(fila.itens).toEqual([]);
    expect(fila).toMatchObject({ temAnterior: false, temProxima: false, anterior: null, proxima: null, totalFila: 3 });
    expect(chamadas()).toHaveLength(1);
  });
});
