import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Travas UNITÁRIAS da linha comercial (SPEC-ERP-005) — rodam no `npm test` comum, sem banco. As
// integrações (linha-comercial.int.test.ts) cobrem o fluxo real; aqui a forma de cada filtro e ramo
// fica presa, para que uma mutação no escopo, no roteamento ou no backfill quebre a suíte padrão.

const db = vi.hoisted(() => ({
  usuario: { findMany: vi.fn() },
  coberturaCarteira: { findMany: vi.fn() },
  conversaWhatsApp: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  CHAVE_LINHA,
  adotarMensagensOrfasDaLinha,
  atendimentoComercialDaLinha,
  atendimentoDaLinhaParaInbound,
  donosDeLinhaVisiveis,
  ehLinhaComercial,
  whereLinhasDosDonos,
} from "./linha-comercial";

/** tx fake: cada teste define as respostas; qualquer modelo não previsto quebra o teste (undefined). */
function txFake(over: {
  conversa?: { numero: { finalidade: string; ativo?: boolean; donoId?: string | null }; contato?: { leadId: string | null } } | null;
  abertos?: Array<{ id: string; contextoChave: string; leadId: string | null; encerradoEm?: Date | null }>;
  institucionaisAbertos?: number;
  anterioresDaLinha?: number;
  entradasOrfas?: number;
  orfasMovidas?: number;
} = {}) {
  const conversa = over.conversa === undefined
    ? { numero: { finalidade: "VENDAS", ativo: true, donoId: "dono" }, contato: { leadId: null } }
    : over.conversa;
  return {
    conversaWhatsApp: { findUnique: vi.fn().mockResolvedValue(conversa) },
    atendimentoWhatsApp: {
      findMany: vi.fn().mockResolvedValue(over.abertos ?? []),
      findFirst: vi.fn().mockResolvedValue(over.abertos?.[0] ? { id: over.abertos[0].id } : null),
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({ ...over.abertos?.find((a) => a.id === where.id), leadId: "lead-novo" })),
      count: vi.fn().mockImplementation(async ({ where }: { where: { finalidade?: unknown; contextoChave?: unknown } }) =>
        where.contextoChave ? over.anterioresDaLinha ?? 0 : over.institucionaisAbertos ?? 0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: "novo", encerradoEm: null, ...create })),
      update: vi.fn().mockResolvedValue({}),
    },
    mensagemWhatsApp: {
      count: vi.fn().mockResolvedValue(over.entradasOrfas ?? 0),
      updateMany: vi.fn().mockResolvedValue({ count: over.orfasMovidas ?? 0 }),
      aggregate: vi.fn().mockResolvedValue({ _max: { criadoEm: new Date("2026-09-20T10:00:00Z") } }),
    },
  };
}

beforeEach(() => vi.resetAllMocks());

describe("ehLinhaComercial / whereLinhasDosDonos (LC-D01, LC-L05)", () => {
  it("só VENDAS é linha", () => {
    expect(ehLinhaComercial({ finalidade: "VENDAS" })).toBe(true);
    expect(ehLinhaComercial({ finalidade: "COBRANCA" })).toBe(false);
    expect(ehLinhaComercial({ finalidade: "AGENDA" })).toBe(false);
  });

  it("filtro da linha: comercial, número de VENDAS ATIVO e dono atual", () => {
    expect(whereLinhasDosDonos(["v1", "v2"])).toEqual({
      finalidade: "COMERCIAL",
      conversa: { numero: { finalidade: "VENDAS", ativo: true, donoId: { in: ["v1", "v2"] } } },
    });
  });
});

describe("donosDeLinhaVisiveis (LC-D02)", () => {
  it("vendedor vê só a própria linha, sem consultar equipe nem cobertura", async () => {
    expect(await donosDeLinhaVisiveis({ id: "v1", papeis: [Papel.VENDEDOR] })).toEqual(["v1"]);
    expect(db.usuario.findMany).not.toHaveBeenCalled();
    expect(db.coberturaCarteira.findMany).not.toHaveBeenCalled();
  });

  it("gerente comercial vê a própria linha e as da equipe — e só a equipe DELE", async () => {
    db.usuario.findMany.mockResolvedValue([{ id: "v1" }, { id: "v2" }]);
    expect(await donosDeLinhaVisiveis({ id: "g1", papeis: [Papel.GERENTE_COMERCIAL] })).toEqual(["g1", "v1", "v2"]);
    expect(db.usuario.findMany).toHaveBeenCalledWith({ where: { gerenteComercialId: "g1" }, select: { id: true } });
    expect(db.coberturaCarteira.findMany).not.toHaveBeenCalled(); // cobertura de carteira não dá linha
  });

  it("papéis sem comercial não veem linha; administrador vê por outra regra", async () => {
    for (const papel of [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR]) {
      expect(await donosDeLinhaVisiveis({ id: "u", papeis: [papel] })).toEqual([]);
    }
    expect(await donosDeLinhaVisiveis({ id: "", papeis: [Papel.VENDEDOR] })).toEqual([]);
  });
});

describe("atendimentoComercialDaLinha (§5.1)", () => {
  it("fora de linha não toca atendimentos", async () => {
    const tx = txFake({ conversa: { numero: { finalidade: "COBRANCA" } } });
    expect(await atendimentoComercialDaLinha(tx as never, "c1", { leadId: "l1" })).toBeNull();
    expect(tx.atendimentoWhatsApp.findMany).not.toHaveBeenCalled();
    expect(tx.atendimentoWhatsApp.upsert).not.toHaveBeenCalled();
  });

  it("sem aberto: nasce COMERCIAL:LINHA com o dono como responsável", async () => {
    const tx = txFake();
    const a = await atendimentoComercialDaLinha(tx as never, "c1");
    expect(tx.atendimentoWhatsApp.upsert).toHaveBeenCalledWith({
      where: { conversaId_contextoChave: { conversaId: "c1", contextoChave: CHAVE_LINHA } },
      create: { conversaId: "c1", contextoChave: CHAVE_LINHA, finalidade: "COMERCIAL", leadId: null, responsavelId: "dono" },
      update: {},
    });
    expect(a?.id).toBe("novo");
    expect(tx.atendimentoWhatsApp.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversaId: "c1", finalidade: "COMERCIAL", encerradoEm: null },
    }));
  });

  it("encerrado não reabre: a próxima chave é COMERCIAL:LINHA:<n>", async () => {
    const tx = txFake({ anterioresDaLinha: 1 });
    await atendimentoComercialDaLinha(tx as never, "c1");
    expect(tx.atendimentoWhatsApp.upsert.mock.calls[0][0].create.contextoChave).toBe(`${CHAVE_LINHA}:2`);
    expect(tx.atendimentoWhatsApp.count).toHaveBeenCalledWith({ where: { conversaId: "c1", contextoChave: { startsWith: CHAVE_LINHA } } });
  });

  it("aberto sem lead recebe o lead no MESMO atendimento, por update condicional", async () => {
    const tx = txFake({ abertos: [{ id: "a1", contextoChave: CHAVE_LINHA, leadId: null }] });
    const a = await atendimentoComercialDaLinha(tx as never, "c1", { leadId: "lead-novo" });
    expect(tx.atendimentoWhatsApp.updateMany).toHaveBeenCalledWith({ where: { id: "a1", leadId: null }, data: { leadId: "lead-novo" } });
    expect(tx.atendimentoWhatsApp.upsert).not.toHaveBeenCalled();
    expect(a?.id).toBe("a1");
  });

  it("aberto de OUTRO lead: devolve null (o chamador mantém o atendimento próprio do lead)", async () => {
    const tx = txFake({ abertos: [{ id: "a1", contextoChave: CHAVE_LINHA, leadId: "lead-x" }] });
    expect(await atendimentoComercialDaLinha(tx as never, "c1", { leadId: "lead-y" })).toBeNull();
    expect(tx.atendimentoWhatsApp.updateMany).not.toHaveBeenCalled();
  });

  it("prefere o atendimento do próprio lead, depois o da linha", async () => {
    const abertos = [
      { id: "legado", contextoChave: "COMERCIAL:lead-x::", leadId: "lead-x" },
      { id: "linha", contextoChave: CHAVE_LINHA, leadId: null },
    ];
    expect((await atendimentoComercialDaLinha(txFake({ abertos }) as never, "c1", { leadId: "lead-x" }))?.id).toBe("legado");
    expect((await atendimentoComercialDaLinha(txFake({ abertos }) as never, "c1"))?.id).toBe("linha");
  });
});

describe("atendimentoDaLinhaParaInbound (§5.2, LC-I01)", () => {
  it("número institucional: undefined (segue o roteamento institucional)", async () => {
    const tx = txFake({ conversa: { numero: { finalidade: "COBRANCA", ativo: true }, contato: { leadId: null } } });
    expect(await atendimentoDaLinhaParaInbound(tx as never, "c1")).toBeUndefined();
  });

  it("assunto institucional aberto na conversa da linha: undefined", async () => {
    const tx = txFake({ institucionaisAbertos: 1 });
    expect(await atendimentoDaLinhaParaInbound(tx as never, "c1")).toBeUndefined();
    expect(tx.atendimentoWhatsApp.count).toHaveBeenCalledWith({ where: { conversaId: "c1", encerradoEm: null, finalidade: { not: "COMERCIAL" } } });
    expect(tx.atendimentoWhatsApp.upsert).not.toHaveBeenCalled();
  });

  it("linha desativada não cria atendimento novo", async () => {
    const tx = txFake({ conversa: { numero: { finalidade: "VENDAS", ativo: false }, contato: { leadId: null } } });
    expect(await atendimentoDaLinhaParaInbound(tx as never, "c1")).toBeNull();
    expect(tx.atendimentoWhatsApp.upsert).not.toHaveBeenCalled();
  });

  it("linha ativa sem aberto: cria e devolve o atendimento da linha (nunca triagem)", async () => {
    expect(await atendimentoDaLinhaParaInbound(txFake() as never, "c1")).toBe("novo");
  });
});

describe("adotarMensagensOrfasDaLinha (LC-15)", () => {
  it("só conversas de linha ATIVA, com órfãs e sem assunto institucional aberto; lote limitado", async () => {
    db.conversaWhatsApp.findMany.mockResolvedValue([]);
    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 0, mensagens: 0 });
    expect(db.conversaWhatsApp.findMany).toHaveBeenCalledWith({
      where: {
        numero: { finalidade: "VENDAS", ativo: true },
        mensagens: { some: { atendimentoId: null } },
        atendimentos: { none: { encerradoEm: null, finalidade: { not: "COMERCIAL" } } },
      },
      select: { id: true },
      take: 50,
    });
    await adotarMensagensOrfasDaLinha({ numeroId: "n1", limiteConversas: 500 });
    expect(db.conversaWhatsApp.findMany.mock.calls[1][0]).toMatchObject({ where: { numeroId: "n1" }, take: 500 });
  });

  it("move só as órfãs (atendimentoId null) e soma as ENTRADAS como não lidas", async () => {
    const tx = txFake({ entradasOrfas: 1, orfasMovidas: 2 });
    db.conversaWhatsApp.findMany.mockResolvedValue([{ id: "c1" }]);
    db.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 1, mensagens: 2 });
    expect(tx.mensagemWhatsApp.count).toHaveBeenCalledWith({ where: { conversaId: "c1", atendimentoId: null, direcao: "ENTRADA" } });
    expect(tx.mensagemWhatsApp.updateMany).toHaveBeenCalledWith({ where: { conversaId: "c1", atendimentoId: null }, data: { atendimentoId: "novo" } });
    expect(tx.atendimentoWhatsApp.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "novo" }, data: expect.objectContaining({ naoLidas: { increment: 1 } }),
    }));
  });

  it("idempotente: sem órfãs movidas, não altera o atendimento", async () => {
    const tx = txFake({ orfasMovidas: 0 });
    db.conversaWhatsApp.findMany.mockResolvedValue([{ id: "c1" }]);
    db.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 0, mensagens: 0 });
    expect(tx.atendimentoWhatsApp.update).not.toHaveBeenCalled();
  });

  it("conversa que virou institucional no meio do caminho fica na triagem", async () => {
    const tx = txFake({ institucionaisAbertos: 1 });
    db.conversaWhatsApp.findMany.mockResolvedValue([{ id: "c1" }]);
    db.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 0, mensagens: 0 });
    expect(tx.mensagemWhatsApp.updateMany).not.toHaveBeenCalled();
  });
});
