import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Revisão R1 do #208 (C3): preparo e decisão de quantidade rodam em SERIALIZABLE com o lock
// da modalidade. O perdedor concorrente recebe 40001/P2034 e deve ser repetido até cair no
// replay idempotente — sem duplicar proposta, decisão ou aplicação.
const m = vi.hoisted(() => ({
  transacao: vi.fn(), sessao: vi.fn(), evento: vi.fn(), previa: vi.fn(),
  tx: {} as Record<string, unknown>,
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (...args: unknown[]) => m.transacao(...args) } }));
vi.mock("@/server/_shared", () => ({
  ErroPermissao: class ErroPermissao extends Error {}, ErroRegra: class ErroRegra extends Error {},
  executarAcao: async (fn: () => unknown) => fn(), exigirSessaoComPapel: m.sessao, registrarEvento: m.evento,
}));
vi.mock("./modalidade-quantidade-tx", () => ({ carregarPreviaQuantidadeAulasTx: m.previa }));
vi.mock("./grade-turma-tx", () => ({ carregarGradeInicialTx: vi.fn() }));
vi.mock("./quantidade-avisos-tx", () => ({ criarAvisosQuantidadeAulasTx: vi.fn() }));

import { decidirAlteracaoQuantidadeAulasModalidade, prepararAlteracaoQuantidadeAulasModalidade } from "./modalidade-quantidade";

const erroPrisma = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("falha", { code, clientVersion: "5.22.0", meta });
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

const preparo = { modalidadeId: "modalidade", quantidadeNova: 12, versaoAnterior: 1, motivo: "Ajuste da carga do nível", chaveIdempotencia: "chave-quantidade-1" };
const decisao = { propostaId: "proposta", aprovar: true, motivo: "Aprovação conferida pela gestão" };

let proposta: { findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
let decisaoCreate: ReturnType<typeof vi.fn>;
let aplicacaoCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "gestor" });
  proposta = { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() };
  decisaoCreate = vi.fn();
  aplicacaoCreate = vi.fn();
  m.tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
    usuario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["GERENTE_PEDAGOGICO"] }) },
    propostaQuantidadeAulasModalidade: proposta,
    decisaoQuantidadeAulasModalidade: { create: decisaoCreate },
    aplicacaoQuantidadeAulasModalidade: { create: aplicacaoCreate },
  };
  m.transacao.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(m.tx));
});

describe("prepararAlteracaoQuantidadeAulasModalidade", () => {
  it("repete após 40001 (P2010) e devolve o replay da chave de idempotência, sem criar outra proposta", async () => {
    m.transacao.mockRejectedValueOnce(erroPrisma("P2010", { code: "40001" }));
    proposta.findUnique.mockResolvedValue({ id: "proposta", versao: 2, entradaHash: hash(preparo) });

    await expect(prepararAlteracaoQuantidadeAulasModalidade(preparo)).resolves.toEqual({ id: "proposta", versao: 2 });

    expect(m.transacao).toHaveBeenCalledTimes(2);
    for (const [, opcoes] of m.transacao.mock.calls) expect(opcoes).toMatchObject({ isolationLevel: "Serializable" });
    expect(proposta.create).not.toHaveBeenCalled();
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("não repete erro que não é de serialização", async () => {
    const outro = erroPrisma("P2002");
    m.transacao.mockRejectedValueOnce(outro);

    await expect(prepararAlteracaoQuantidadeAulasModalidade(preparo)).rejects.toBe(outro);
    expect(m.transacao).toHaveBeenCalledTimes(1);
  });
});

describe("decidirAlteracaoQuantidadeAulasModalidade", () => {
  it("repete após P2034 e devolve o replay da decisão já gravada, sem decidir nem aplicar de novo", async () => {
    m.transacao.mockRejectedValueOnce(erroPrisma("P2034"));
    proposta.findUnique.mockResolvedValue({
      id: "proposta", modalidadeId: "modalidade", preparadorId: "secretaria",
      decisao: { id: "decisao", decisorId: "gestor", aprovada: true, motivo: decisao.motivo }, aplicacao: { id: "aplicacao" },
    });

    await expect(decidirAlteracaoQuantidadeAulasModalidade(decisao)).resolves.toEqual({ id: "decisao", aprovada: true, aplicada: true });

    expect(m.transacao).toHaveBeenCalledTimes(2);
    for (const [, opcoes] of m.transacao.mock.calls) expect(opcoes).toMatchObject({ isolationLevel: "Serializable" });
    expect(decisaoCreate).not.toHaveBeenCalled();
    expect(aplicacaoCreate).not.toHaveBeenCalled();
    expect(m.previa).not.toHaveBeenCalled();
  });

  it("na repetição, decisão de outra pessoa vira erro de regra e não é repetida de novo", async () => {
    m.transacao.mockRejectedValueOnce(erroPrisma("P2034"));
    proposta.findUnique.mockResolvedValue({
      id: "proposta", modalidadeId: "modalidade", preparadorId: "secretaria",
      decisao: { id: "decisao", decisorId: "outro-gestor", aprovada: true, motivo: decisao.motivo }, aplicacao: { id: "aplicacao" },
    });

    await expect(decidirAlteracaoQuantidadeAulasModalidade(decisao)).rejects.toThrow("já possui decisão");
    expect(m.transacao).toHaveBeenCalledTimes(2);
  });

  it("desiste após três conflitos seguidos e propaga o erro", async () => {
    const conflito = erroPrisma("P2034");
    m.transacao.mockRejectedValue(conflito);

    await expect(decidirAlteracaoQuantidadeAulasModalidade(decisao)).rejects.toBe(conflito);
    expect(m.transacao).toHaveBeenCalledTimes(3);
  });
});
