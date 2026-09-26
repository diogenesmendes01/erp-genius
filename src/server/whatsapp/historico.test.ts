import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  acharNumero: vi.fn(), linha: vi.fn(), transacao: vi.fn(),
  // Cliente do módulo: as escritas no contato e o SQL cru são espionados também FORA da transação
  // (preenchidos no beforeEach — o objeto é o mesmo que o módulo importa).
  cliente: {} as Record<string, unknown>,
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.cliente }));
vi.mock("./inbound", () => ({ acharNumero: m.acharNumero }));
vi.mock("./linha-comercial", () => ({
  atendimentoDaLinhaParaInbound: m.linha,
  ehLinhaComercial: (n: { finalidade: string }) => n.finalidade === "VENDAS",
}));

import { dentroDaJanelaHistorico, importarHistoricoLinha, JANELA_HISTORICO_DIAS, type MensagemHistorica } from "./historico";

// SPEC-ERP-005 LC-D04/LC-10/LC-11 — travas unitárias do histórico do aparelho (rodam no `npm test`).

const agora = new Date("2026-09-26T12:00:00.000Z");
const dia = 86_400_000;
const msg = (id: string, diasAtras: number, over: Partial<MensagemHistorica> = {}): MensagemHistorica => ({
  contatoWaId: "50670001111", nomeExibicao: "Cliente", providerMessageId: id, corpo: "sair", tipo: "TEXTO",
  fromMe: false, quando: new Date(agora.getTime() - diasAtras * dia), ...over,
});

/**
 * Transação com SÓ os modelos que a importação pode tocar. Lead, intenção, config comercial, evento
 * (captura, saudação, cancelamento, opt-out auditado) não existem aqui: se o código tocar, o teste quebra.
 */
/** Todas as formas de escrita no contato do Prisma Client — espionadas, para a falha ser a trava LC-10. */
function escritasDeContato() {
  const devolve = async ({ data }: { data: Record<string, unknown> }) => ({ id: "contato", ...data });
  return {
    create: vi.fn().mockImplementation(devolve),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    createManyAndReturn: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockImplementation(devolve),
    upsert: vi.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: "contato", ...create })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
}
type EscritasDeContato = ReturnType<typeof escritasDeContato>;
// SQL cru escaparia da inspeção por chave. $queryRaw* entra junto: é "de leitura", mas aceita UPDATE.
const METODOS_SQL_CRU = ["$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"] as const;
const sqlCru = () => Object.fromEntries(METODOS_SQL_CRU.map((nome) => [nome, vi.fn().mockResolvedValue(0)])) as
  Record<(typeof METODOS_SQL_CRU)[number], ReturnType<typeof vi.fn>>;

function txEstrito() {
  return {
    ...sqlCru(),
    contatoWhatsApp: { findUnique: vi.fn().mockResolvedValue(null), ...escritasDeContato() },
    conversaWhatsApp: { upsert: vi.fn().mockResolvedValue({ id: "conversa" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mensagemWhatsApp: { createMany: vi.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })) },
    atendimentoWhatsApp: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
}

let tx: ReturnType<typeof txEstrito>;
let cliente: EscritasDeContato & ReturnType<typeof sqlCru>;

/** Os dados de TODA escrita no contato, dentro da transação E pelo cliente do módulo. */
function escritasNoContato(): Record<string, unknown>[] {
  return [tx.contatoWhatsApp, cliente].flatMap((c: EscritasDeContato) => [
    ...c.create.mock.calls.map(([a]) => a.data),
    ...c.createMany.mock.calls.flatMap(([a]) => [a.data].flat()),
    ...c.createManyAndReturn.mock.calls.flatMap(([a]) => [a.data].flat()),
    ...c.update.mock.calls.map(([a]) => a.data),
    ...c.upsert.mock.calls.flatMap(([a]) => [a.create, a.update]),
    ...c.updateMany.mock.calls.map(([a]) => a.data),
  ]);
}

beforeEach(() => {
  vi.resetAllMocks();
  tx = txEstrito();
  cliente = { ...escritasDeContato(), ...sqlCru() };
  Object.assign(m.cliente, { $transaction: m.transacao, contatoWhatsApp: cliente },
    Object.fromEntries(METODOS_SQL_CRU.map((nome) => [nome, cliente[nome]])));
  m.transacao.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  m.acharNumero.mockResolvedValue({ id: "linha", finalidade: "VENDAS", ativo: true });
  m.linha.mockResolvedValue("atendimento-linha");
});

describe("dentroDaJanelaHistorico", () => {
  it("janela de 30 dias, inclusive a borda", () => {
    expect(JANELA_HISTORICO_DIAS).toBe(30);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - 30 * dia), agora)).toBe(true);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - 30 * dia - 1), agora)).toBe(false);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() - dia), agora)).toBe(true);
  });

  it("recusa data inválida e mensagem 'do futuro' além da folga de relógio", () => {
    expect(dentroDaJanelaHistorico(new Date("invalida"), agora)).toBe(false);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() + 60_000), agora)).toBe(true);
    expect(dentroDaJanelaHistorico(new Date(agora.getTime() + dia), agora)).toBe(false);
  });
});

describe("importarHistoricoLinha — sem efeitos colaterais (LC-10)", () => {
  // LC-10 vale para TODO cenário de importação deste bloco (saída pelo celular, triagem, mídia sem
  // legenda, lotes, canal recusado): nenhuma escrita no contato pode tocar o opt-out.
  afterEach(() => {
    for (const dados of escritasNoContato()) expect(dados, "histórico não grava nem limpa opt-out").not.toHaveProperty("optOutEm");
    // SQL cru escaparia da inspeção por chave: a importação não usa, dentro nem fora da transação.
    for (const nome of METODOS_SQL_CRU) {
      expect(tx[nome], `histórico não usa SQL cru (${nome}, transação)`).not.toHaveBeenCalled();
      expect(cliente[nome], `histórico não usa SQL cru (${nome}, cliente)`).not.toHaveBeenCalled();
    }
    // Fora da transação nada escreve no contato: toda escrita da importação é atômica com as mensagens.
    for (const f of Object.values(cliente)) expect(f, "escrita no contato fora da transação").not.toHaveBeenCalled();
  });

  it("grava só a janela, no atendimento da linha, sem duplicar e sem não lidas", async () => {
    const r = await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, [msg("H-90", 90), msg("H-10", 10), msg("H-9", 9, { fromMe: true, corpo: "resposta" })], agora);
    expect(r).toEqual({ gravadas: 2, ignoradas: 1, motivo: null });
    expect(m.acharNumero).toHaveBeenCalledWith({ numeroProviderRef: "linha-a", driver: "BAILEYS" });

    const { data, skipDuplicates } = tx.mensagemWhatsApp.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true); // LC-11: reenvio não duplica
    expect(data.map((d: { providerMessageId: string }) => d.providerMessageId)).toEqual(["H-10", "H-9"]);
    expect(data[0]).toMatchObject({ atendimentoId: "atendimento-linha", direcao: "ENTRADA", status: "ENTREGUE", origem: null, midiaPath: null, driver: "BAILEYS" });
    expect(data[1]).toMatchObject({ direcao: "SAIDA", status: "ENVIADA" });

    // Recência só avança; nada de não lidas, último inbound ou opt-out.
    const conversa = tx.conversaWhatsApp.updateMany.mock.calls[0][0];
    expect(conversa.data).toEqual({ ultimaMensagemEm: new Date(agora.getTime() - 9 * dia) });
    expect(conversa.where.OR).toEqual([{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: new Date(agora.getTime() - 9 * dia) } }]);
    expect(tx.atendimentoWhatsApp.updateMany.mock.calls[0][0].data).toEqual({ ultimaMensagemEm: new Date(agora.getTime() - 9 * dia) });
    expect(JSON.stringify([tx.conversaWhatsApp.updateMany.mock.calls, tx.atendimentoWhatsApp.updateMany.mock.calls])).not.toMatch(/naoLidas|ultimoInboundEm/);
    // Contato criado sem opt-out mesmo com a palavra "sair" no histórico.
    expect(tx.contatoWhatsApp.create.mock.calls[0][0].data).not.toHaveProperty("optOutEm");
  });

  it("LC-10: nenhuma escrita no contato toca o opt-out — contato novo (palavra-chave, saída pelo celular, mídia sem legenda)", async () => {
    await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, [
      msg("H-1", 1), msg("H-2", 2, { corpo: "parar" }), msg("H-3", 3, { fromMe: true, corpo: "sair" }),
      msg("H-4", 4, { corpo: null, tipo: "IMAGEM" }), msg("H-5", 5, { corpo: "" }),
    ], agora);
    expect(escritasNoContato()).not.toHaveLength(0); // o contato foi gravado (senão a trava passaria vazia)
    for (const dados of escritasNoContato()) expect(dados).not.toHaveProperty("optOutEm");
    // Contato novo nasce por create; nenhuma escrita posterior (onde um opt-out caberia).
    expect(tx.contatoWhatsApp.update).not.toHaveBeenCalled();
    expect(tx.contatoWhatsApp.upsert).not.toHaveBeenCalled();
    expect(tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
  });

  it("LC-10: contato existente só tem vínculos preservados — nem grava nem limpa opt-out", async () => {
    tx.contatoWhatsApp.findUnique.mockResolvedValue({ id: "contato", telefoneE164: "+50670001111", waId: null, nomeExibicao: null,
      alunoId: null, responsavelId: null, leadId: null, optOutEm: new Date("2026-01-01T00:00:00Z") });
    await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, [msg("H-1", 1)], agora);
    expect(tx.contatoWhatsApp.update).toHaveBeenCalledTimes(1); // garantirContato preserva vínculos
    for (const dados of escritasNoContato()) expect(dados).not.toHaveProperty("optOutEm");
    expect(tx.contatoWhatsApp.upsert).not.toHaveBeenCalled();
    expect(tx.contatoWhatsApp.updateMany).not.toHaveBeenCalled();
  });

  it("canal institucional ou linha inativa: nada é gravado", async () => {
    m.acharNumero.mockResolvedValueOnce({ id: "cob", finalidade: "COBRANCA", ativo: true });
    expect(await importarHistoricoLinha({ numeroProviderRef: "cob" }, [msg("H-1", 1)], agora)).toMatchObject({ gravadas: 0, motivo: "nao_e_linha_comercial" });
    m.acharNumero.mockResolvedValueOnce({ id: "linha", finalidade: "VENDAS", ativo: false });
    expect(await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, [msg("H-1", 1)], agora)).toMatchObject({ gravadas: 0, motivo: "nao_e_linha_comercial" });
    m.acharNumero.mockResolvedValueOnce(null);
    expect(await importarHistoricoLinha({ numeroProviderRef: "x" }, [msg("H-1", 1)], agora)).toMatchObject({ motivo: "numero_desconhecido" });
    expect(m.transacao).not.toHaveBeenCalled();
  });

  it("conversa com assunto institucional aberto: histórico fica sem atendimento (triagem)", async () => {
    m.linha.mockResolvedValue(undefined);
    await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, [msg("H-1", 1)], agora);
    expect(tx.mensagemWhatsApp.createMany.mock.calls[0][0].data[0].atendimentoId).toBeNull();
    expect(tx.atendimentoWhatsApp.updateMany).not.toHaveBeenCalled();
    expect(escritasNoContato()).not.toHaveLength(0); // houve escrita no contato: a trava do afterEach não passa vazia
  });

  it("lotes de até 200 mensagens por transação, por contato", async () => {
    const muitas = Array.from({ length: 450 }, (_, i) => msg(`L-${i}`, 1, { quando: new Date(agora.getTime() - dia + i * 1000) }));
    const r = await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, muitas, agora);
    expect(r.gravadas).toBe(450);
    expect(m.transacao).toHaveBeenCalledTimes(3);
    expect(tx.mensagemWhatsApp.createMany.mock.calls.map((c) => c[0].data.length)).toEqual([200, 200, 50]);
  });
});
