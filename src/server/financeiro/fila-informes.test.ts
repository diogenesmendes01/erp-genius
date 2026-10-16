import { beforeEach, describe, expect, it, vi } from "vitest";

// Fila de informes a conferir (aba "A conferir" do /financeiro) por cursor nos dois sentidos (docs/43 §6 item 9 e
// §7.5: `listarInformesPagamento` lia todos os informes sem `take`). Sem banco: o findMany de mentira avalia o corte
// do cursor no `where` (src/test/consulta-paginada.ts) e conferir um informe é trocar o status dele.

const m = vi.hoisted(() => ({ sessao: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { pagamentoInformado: { findMany: m.findMany, findUnique: m.findUnique, count: m.count } } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: m.sessao };
});

import { buscarPorId, findManyComOnde, idsEmOrdem, terminaNoId } from "@/test/consulta-paginada";
import { INFORMES_POR_TRECHO, contarInformesAConferir, listarFilaInformesPagamento, listarInformesPagamento } from "./consultas";

type Linha = ReturnType<typeof informe>;
/** Dois informes por instante: o desempate pelo id é o que mantém a ordem estável. */
const informe = (id: string, i: number) => ({
  id, versao: 1, valor: 100, moeda: "BRL", forma: "TRANSFERENCIA", status: "A_CONFERIR" as string,
  criadoEm: new Date(Date.UTC(2026, 8, 1, 0, Math.floor(i / 2))), dataPagamento: new Date("2026-09-01T12:00:00Z"),
  comprovanteUrl: null, comprovanteNome: null, comentario: null, motivoConferencia: null, suspenderLembretesAte: null, autorId: "outro",
  cobranca: { codigo: `COB-${id}`, matricula: { aluno: { primeiroNome: "Ana", sobrenome: id } } },
});
let todas: Linha[] = [];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "financeiro", papeis: ["FINANCEIRO"] });
  todas = idsEmOrdem(70).map(informe);
  // A fila é o que está A_CONFERIR agora; a âncora do cursor continua existindo depois de conferida.
  m.findMany.mockImplementation((args) => findManyComOnde(todas.filter((l) => l.status === "A_CONFERIR"))(args));
  m.findUnique.mockImplementation(buscarPorId(todas));
});

describe("listarFilaInformesPagamento (item 9)", () => {
  it("lê A_CONFERIR, mais antigo primeiro, com take e desempate pelo id; sem skip", async () => {
    const p1 = await listarFilaInformesPagamento();
    const args = m.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: "A_CONFERIR" });
    expect(args.take).toBe(INFORMES_POR_TRECHO + 1);
    expect(args.orderBy).toEqual([{ criadoEm: "asc" }, { id: "asc" }]);
    expect(terminaNoId(args.orderBy)).toBe(true);
    expect(args).not.toHaveProperty("skip");
    expect(ids(p1.itens)).toEqual(idsEmOrdem(30));
    expect(p1).toMatchObject({ temAnterior: false, temProxima: true, anterior: null, proxima: "r29" });
    expect(p1.itens[0]).toMatchObject({ aluno: "Ana r00", cobranca: "COB-r00", podeConferir: true });
  });

  it("cursor nos dois sentidos: ida e volta trazem os mesmos; a última não tem Próxima", async () => {
    const p1 = await listarFilaInformesPagamento();
    const p2 = await listarFilaInformesPagamento({ depois: p1.proxima! });
    const p3 = await listarFilaInformesPagamento({ depois: p2.proxima! });
    expect(ids(p2.itens)).toEqual(idsEmOrdem(60).slice(30));
    expect(ids(p3.itens)).toEqual(idsEmOrdem(70).slice(60));
    expect(p3).toMatchObject({ temProxima: false, proxima: null });
    expect(ids((await listarFilaInformesPagamento({ antes: p3.anterior! })).itens)).toEqual(ids(p2.itens));
    const volta = await listarFilaInformesPagamento({ antes: p2.anterior! });
    expect(ids(volta.itens)).toEqual(ids(p1.itens));
    expect(volta.temAnterior).toBe(false);
  });

  it("conferir informes já vistos — inclusive o do cursor — não faz a próxima pular ninguém", async () => {
    const p1 = await listarFilaInformesPagamento();
    for (const l of todas) if (["r00", "r10", "r29"].includes(l.id)) l.status = "CONFIRMADO";
    const p2 = await listarFilaInformesPagamento({ depois: p1.proxima! });
    expect(ids(p2.itens)).toEqual(idsEmOrdem(60).slice(30));
  });

  it("cursor de informe inexistente: trecho vazio; cursor fora do formato e dois sentidos: erro sem consultar", async () => {
    expect((await listarFilaInformesPagamento({ depois: "nao-existe" })).itens).toEqual([]);
    await expect(listarFilaInformesPagamento({ depois: "../x" })).rejects.toThrow();
    await expect(listarFilaInformesPagamento({ depois: "r01", antes: "r02" })).rejects.toThrow();
    expect(m.findMany).not.toHaveBeenCalled();
  });

  it("só Financeiro/Administração: o papel é exigido antes da consulta", async () => {
    m.sessao.mockRejectedValue(new Error("sem permissão"));
    await expect(listarFilaInformesPagamento()).rejects.toThrow("sem permissão");
    await expect(contarInformesAConferir()).rejects.toThrow("sem permissão");
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.count).not.toHaveBeenCalled();
  });

  it("o número da aba é um count dos A_CONFERIR, sem ler os informes", async () => {
    m.count.mockResolvedValue(70);
    expect(await contarInformesAConferir()).toBe(70);
    expect(m.count).toHaveBeenCalledWith({ where: { status: "A_CONFERIR" } });
    expect(m.findMany).not.toHaveBeenCalled();
  });

  it("listarInformesPagamento sem aluno devolve o primeiro trecho da fila (nunca a tabela inteira)", async () => {
    const itens = await listarInformesPagamento();
    expect(itens).toHaveLength(INFORMES_POR_TRECHO);
    expect(m.findMany.mock.calls.every((c) => c[0].take === INFORMES_POR_TRECHO + 1)).toBe(true);
  });
});
