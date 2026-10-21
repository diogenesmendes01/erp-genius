import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), matriculas: vi.fn(), estado: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: m.sessao };
});
vi.mock("./continuidade-estado-tx", () => ({ carregarContinuidadeMensalTx: m.estado }));
import { findManyComOnde, idsEmOrdem, terminaNoId } from "@/test/consulta-paginada";
import { consultarFilaContinuidadeMensal } from "./continuidade-fila";

const linha = (id: string) => ({ id, codigo: `M-${id}`, aluno: { primeiroNome: "Ana", sobrenome: "Silva" } });
const pronto = { plano: { cobertura: { inicio: "2026-11-01", fim: "2026-11-30" }, vencimento: "2026-11-05", status: "PRONTA_PARA_EMISSAO" }, oferta: { estado: "SEM_RELATO" }, comprovacaoOferta: { estado: "COMPROVADA_POR_AGENDA" }, motivo: "Prévia informativa" };
beforeEach(() => {
  vi.resetAllMocks(); m.sessao.mockResolvedValue({ id: "financeiro" }); m.usuario.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"] });
  m.transaction.mockImplementation((f: (tx: object) => unknown) => f({ usuario: { findUnique: m.usuario }, matricula: { findMany: m.matriculas } })); m.estado.mockResolvedValue(pronto);
});

describe("consultarFilaContinuidadeMensal", () => {
  it("lê vinte registros (mais um, que só diz se há próxima) e não faz escrita", async () => {
    m.matriculas.mockResolvedValue(Array.from({ length: 21 }, (_, i) => linha(String(i).padStart(2, "0"))));
    const resultado = await consultarFilaContinuidadeMensal();
    if (!resultado.ok || !resultado.dado) throw new Error("Fila ausente");
    expect(resultado.dado).toMatchObject({ temAnterior: false, temProxima: true, anterior: null, proxima: "19" });
    expect(resultado.dado.itens).toHaveLength(20);
    expect(resultado.dado.itens[0]).toMatchObject({ matriculaId: "00", alunoNome: "Ana Silva", estado: "PRONTA", cobertura: { inicio: "2026-11-01" }, vencimento: "2026-11-05" });
    expect(m.matriculas).toHaveBeenCalledWith(expect.objectContaining({ take: 21, orderBy: { id: "asc" } }));
    expect(m.matriculas.mock.calls[0][0]).not.toHaveProperty("skip");
  });
  it("cursor nos dois sentidos: ida e volta trazem as mesmas matrículas; resolver uma da primeira página não faz a próxima pular", async () => {
    const fila = idsEmOrdem(41).map(linha);
    m.matriculas.mockImplementation(findManyComOnde(fila));
    const ler = async (nav: { depois?: string; antes?: string } = {}) => {
      const r = await consultarFilaContinuidadeMensal(nav);
      if (!r.ok || !r.dado) throw new Error("Fila ausente");
      return r.dado;
    };
    const p1 = await ler(), p2 = await ler({ depois: p1.proxima! }), p3 = await ler({ depois: p2.proxima! });
    expect(terminaNoId(m.matriculas.mock.calls[0][0].orderBy)).toBe(true);
    expect([p1.temAnterior, p1.temProxima, p2.temAnterior, p2.temProxima, p3.temAnterior, p3.temProxima]).toEqual([false, true, true, true, true, false]);
    expect(p3.itens.map((i) => i.matriculaId)).toEqual(["r40"]);
    expect((await ler({ antes: p3.anterior! })).itens).toEqual(p2.itens);
    expect((await ler({ antes: p2.anterior! })).itens).toEqual(p1.itens);
    expect(new Set([...p1.itens, ...p2.itens, ...p3.itens].map((i) => i.matriculaId)).size).toBe(41);

    // A matrícula r03 sai da fila (encerrada) depois que a pessoa leu a primeira página: a próxima começa em r20.
    fila.splice(3, 1);
    const seguinte = await ler({ depois: p1.proxima! });
    expect(seguinte.itens.map((i) => i.matriculaId)).toEqual(p2.itens.map((i) => i.matriculaId));
  });
  it("recusa cursor inválido e os dois sentidos juntos, sem consultar", async () => {
    await expect(consultarFilaContinuidadeMensal({ depois: "a b" })).resolves.toMatchObject({ ok: false });
    await expect(consultarFilaContinuidadeMensal({ depois: "a", antes: "b" })).resolves.toMatchObject({ ok: false });
    await expect(consultarFilaContinuidadeMensal({ pagina: 2 } as never)).resolves.toMatchObject({ ok: false });
    expect(m.matriculas).not.toHaveBeenCalled();
  });
  it("revalida papel no banco e não deixa papel revogado consultar", async () => {
    m.usuario.mockResolvedValue({ ativo: true, papeis: ["SECRETARIA_ACADEMICA"] });
    await expect(consultarFilaContinuidadeMensal()).resolves.toMatchObject({ ok: false });
    expect(m.matriculas).not.toHaveBeenCalled();
  });
  it("classifica apenas regra conhecida como A_CONFERIR e não expõe infraestrutura", async () => {
    m.matriculas.mockResolvedValue([linha("a")]);
    const { ErroRegra } = await import("@/server/_shared");
    m.estado.mockRejectedValueOnce(new ErroRegra("Condições ainda pendentes."));
    await expect(consultarFilaContinuidadeMensal()).resolves.toMatchObject({ ok: true, dado: { itens: [{ matriculaId: "a", estado: "A_CONFERIR", motivo: "Condições ainda pendentes." }] } });
    m.estado.mockRejectedValueOnce(new Error("connection string secret"));
    await expect(consultarFilaContinuidadeMensal()).resolves.toEqual({ ok: false, erro: "Erro inesperado. Tente novamente." });
  });
});

it.each([
  ["INDISPONIVEL", "COMPROVADA_POR_AGENDA", "PRONTA_PARA_EMISSAO", "INDISPONIVEL"],
  ["PENDENTE_CONFERENCIA", "COMPROVADA_POR_AGENDA", "PRONTA_PARA_EMISSAO", "OFERTA_PENDENTE"],
  ["SEM_RELATO", "EXIGE_CONFIRMACAO_GESTAO", "PRONTA_PARA_EMISSAO", "CONFERENCIA"],
  ["SEM_RELATO", "CONFIRMADA_PELA_GESTAO", "AGUARDAR_EMISSAO", "AGUARDAR_PRAZO"],
  ["SEM_RELATO", "CONFIRMADA_PELA_GESTAO", "PRONTA_PARA_EMISSAO", "PRONTA"],
])("representa oferta %s, prova %s e marco %s como %s", async (oferta, prova, marco, esperado) => {
  m.matriculas.mockResolvedValue([linha("a")]);
  m.estado.mockResolvedValue({ ...pronto, plano: { ...pronto.plano, status: marco, valorNegociado: "12345.00" }, oferta: { estado: oferta }, comprovacaoOferta: { estado: prova }, documentoId: "documento-restrito", memoriaPreco: { contrato: "clausula-restrita" } });
  const r = await consultarFilaContinuidadeMensal();
  if (!r.ok || !r.dado) throw new Error("Fila ausente");
  expect(r.dado.itens[0].estado).toBe(esperado);
  const serializado = JSON.stringify(r.dado);
  expect(serializado).not.toContain("12345");
  expect(serializado).not.toContain("documento-restrito");
  expect(serializado).not.toContain("clausula-restrita");
});
