import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  db: {
    cobranca: { findMany: vi.fn(), findUnique: vi.fn() },
    numeroWhatsApp: { findUnique: vi.fn() },
    templateWhatsApp: { findMany: vi.fn() },
    intencaoMensagem: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    usuario: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  regua: vi.fn(), politica: vi.fn(), contato: vi.fn(), atendimento: vi.fn(), despacho: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "financeiro" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/cobrancas/consultas", () => ({ montarReguaPorCobranca: m.regua }));
vi.mock("@/server/cobrancas/politica", () => ({ carregarPoliticaRegua: m.politica }));
vi.mock("./atendimentos", async (importOriginal) => ({
  ...await importOriginal<typeof import("./atendimentos")>(), garantirAtendimento: m.atendimento,
}));
vi.mock("./despachante", () => ({ despacharFila: m.despacho }));
vi.mock("./identidade", async (importOriginal) => ({
  ...await importOriginal<typeof import("./identidade")>(), garantirContato: m.contato,
}));

import { enfileirarIntencaoCobranca, ErroCobrancaAlterada, type EnfileirarCobranca } from "./fila";
import { referenciaDestinoCobranca } from "./elegibilidade";
import { resolverDestinoCobranca } from "./identidade";
import { rodarCronRegua } from "./cron";
import { aprovarLoteCobranca, enfileirarCobrancaWhatsApp } from "./acoes";

const agora = new Date("2026-09-08T12:00:00Z");
const vencimentoInicial = new Date("2026-09-15T12:00:00Z");
const vencimentoNovo = new Date("2026-10-15T12:00:00Z");
const tx = m.db as unknown as Prisma.TransactionClient;
function novaCobranca() {
  return {
    id: "cobranca", versao: 1, cicloRegua: 0, vencimento: vencimentoInicial, status: "PENDENTE", moeda: "BRL",
    valorNegociado: new Prisma.Decimal(100), valorRecebido: new Prisma.Decimal(0), saldo: new Prisma.Decimal(100),
    matricula: { id: "matricula", alunoId: "aluno", acessoBloqueado: false, pais: { fuso: "America/Sao_Paulo" }, pagadoresPreparacao: [], preparacaoComercial: null,
      aluno: { id: "aluno", primeiroNome: "Maria", sobrenome: "Silva", nomePreferido: null,
        telefoneE164: "+5511999999999", fuso: null, pais: { idioma: "pt", fuso: "America/Sao_Paulo" }, responsaveis: [], _count: { matriculas: 1 } },
    },
  };
}
let atual = novaCobranca();
function entrada(): EnfileirarCobranca {
  return { cobrancaId: atual.id, referenciaCalendario: { versao: atual.versao, vencimento: atual.vencimento.toISOString(), cicloRegua: atual.cicloRegua },
    referenciaDestino: referenciaDestinoCobranca(resolverDestinoCobranca(atual as unknown as Parameters<typeof resolverDestinoCobranca>[0])),
    passo: "D-7", numeroId: "numero", contatoId: "contato", origem: "CRON", autorId: null,
    corpoRenderizado: "Calendário revisado", variaveis: [], templateId: "template", politicaId: "politica" };
}
function mudarDepoisDeRenderizar(versao = 2) {
  m.contato.mockImplementationOnce(async () => {
    atual = { ...atual, versao, vencimento: vencimentoNovo };
    return { id: "contato" };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  atual = novaCobranca();
  m.db.cobranca.findMany.mockImplementation(async () => [{ ...atual }]);
  m.db.cobranca.findUnique.mockImplementation(async () => ({ ...atual }));
  m.db.$transaction.mockImplementation(async (fn: (db: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));
  m.db.usuario.findUnique.mockResolvedValue({ nome: "Financeiro", ativo: true, papeis: ["FINANCEIRO"] });
  m.db.numeroWhatsApp.findUnique.mockResolvedValue({ id: "numero", ativo: true, driver: "META_CLOUD" });
  m.db.templateWhatsApp.findMany.mockResolvedValue([{ id: "template", nome: "amigavel", idioma: "pt", corpo: "{nome}, vencimento {vencimento}: {valor}" }]);
  m.db.intencaoMensagem.findUnique.mockResolvedValue(null);
  m.db.intencaoMensagem.findMany.mockResolvedValue([]);
  m.db.intencaoMensagem.create.mockResolvedValue({ id: "intencao" });
  m.db.intencaoMensagem.updateMany.mockResolvedValue({ count: 1 });
  m.contato.mockResolvedValue({ id: "contato" });
  m.atendimento.mockResolvedValue({ id: "atendimento" });
  m.despacho.mockResolvedValue({ despachadas: 0, simuladas: 0, falhas: 0 });
  m.politica.mockResolvedValue({ id: "politica", estado: "SHADOW", killSwitch: false, numeroRemetenteId: "numero",
    degraus: [], modoPorPasso: new Map([["D-7", "AUTOMATICO"]]), templateIdPorPasso: new Map([["D-7", "template"]]) });
  m.regua.mockResolvedValue(new Map([["cobranca", { estado: "acao_devida", passo: "D-7", tipoAcao: "lembrar", template: "amigavel" }]]));
});

describe("texto de cobrança conserva o calendário usado na renderização", () => {
  it.each([2, 1])("cron descarta texto antigo se vencimento muda antes do enqueue (versão %i)", async (versao) => {
    mudarDepoisDeRenderizar(versao);
    const resultado = await rodarCronRegua(agora);
    expect(resultado).toMatchObject({ cobrancasAlteradas: 1, enfileiradas: 0, reabertas: 0 });
    expect(m.db.intencaoMensagem.create).not.toHaveBeenCalled();
    expect(m.db.intencaoMensagem.updateMany).not.toHaveBeenCalled();
    expect(m.atendimento).not.toHaveBeenCalled();
  });

  it("cron sem alteração grava texto e assinatura com o mesmo vencimento", async () => {
    expect(await rodarCronRegua(agora)).toMatchObject({ cobrancasAlteradas: 0, enfileiradas: 1 });
    const dados = m.db.intencaoMensagem.create.mock.calls[0][0].data;
    expect(dados.corpoRenderizado).toContain("15/09/2026");
    expect(JSON.parse(dados.referenciaCobranca)).toContain(vencimentoInicial.toISOString());
    expect(dados).toMatchObject({ origem: "CRON", passo: "D-7" });
  });

  it("cron continua nas demais cobranças quando uma delas muda", async () => {
    const outra = { ...novaCobranca(), id: "outra" };
    m.db.cobranca.findMany.mockResolvedValue([{ ...atual }, outra]);
    m.db.cobranca.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "outra" ? outra : { ...atual });
    const acao = { estado: "acao_devida", passo: "D-7", tipoAcao: "lembrar", template: "amigavel" };
    m.regua.mockResolvedValue(new Map([["cobranca", acao], ["outra", acao]]));
    mudarDepoisDeRenderizar();
    expect(await rodarCronRegua(agora)).toMatchObject({ cobrancasAlteradas: 1, enfileiradas: 1 });
    expect(m.db.intencaoMensagem.create).toHaveBeenCalledOnce();
    expect(m.db.intencaoMensagem.create.mock.calls[0][0].data.cobrancaId).toBe("outra");
  });

  it("próxima rodada renderiza o calendário novo em vez de reaproveitar o texto descartado", async () => {
    mudarDepoisDeRenderizar();
    await rodarCronRegua(agora);
    expect(await rodarCronRegua(new Date("2026-10-08T12:00:00Z"))).toMatchObject({ cobrancasAlteradas: 0, enfileiradas: 1 });
    const dados = m.db.intencaoMensagem.create.mock.calls[0][0].data;
    expect(dados.corpoRenderizado).toContain("15/10/2026");
    expect(JSON.parse(dados.referenciaCobranca)).toContain(vencimentoNovo.toISOString());
  });

  it("clique humano recebe erro de revisão sem despachar corpo antigo", async () => {
    mudarDepoisDeRenderizar();
    expect(await enfileirarCobrancaWhatsApp("cobranca")).toEqual({ ok: false, erro: new ErroCobrancaAlterada().message });
    expect(m.db.intencaoMensagem.create).not.toHaveBeenCalled();
    expect(m.despacho).not.toHaveBeenCalled();
  });

  it("lote mantém o item alterado na lista de puladas, sem intenção", async () => {
    mudarDepoisDeRenderizar();
    const resultado = await aprovarLoteCobranca({ cobrancaIds: ["cobranca"] });
    expect(resultado).toMatchObject({ ok: true, dado: { enfileiradas: 0, puladas: [{ cobrancaId: "cobranca", motivo: new ErroCobrancaAlterada().message }] } });
    expect(m.db.intencaoMensagem.create).not.toHaveBeenCalled();
    expect(m.despacho).not.toHaveBeenCalled();
  });

  it("mudança apenas de versão também invalida a quantia que já foi renderizada", async () => {
    const dados = entrada();
    atual = { ...atual, versao: 2, saldo: new Prisma.Decimal(60), valorRecebido: new Prisma.Decimal(40) };
    await expect(enfileirarIntencaoCobranca(tx, dados)).rejects.toBeInstanceOf(ErroCobrancaAlterada);
    expect(m.db.intencaoMensagem.create).not.toHaveBeenCalled();
  });

  it("simulação legítima reabre; snapshot vencido não sobrescreve a intenção simulada", async () => {
    m.db.intencaoMensagem.findUnique.mockResolvedValue({ id: "intencao", status: "SIMULADA", motivoFalha: "ambiente_sem_live" });
    const dados = entrada();
    expect(await enfileirarIntencaoCobranca(tx, dados)).toBe("reaberta");
    expect(m.db.intencaoMensagem.updateMany).toHaveBeenCalledTimes(1);
    atual = { ...atual, vencimento: vencimentoNovo, versao: 2 };
    await expect(enfileirarIntencaoCobranca(tx, dados)).rejects.toBeInstanceOf(ErroCobrancaAlterada);
    expect(m.db.intencaoMensagem.updateMany).toHaveBeenCalledTimes(1);
  });

  it("não reabre o mesmo ciclo quando outro worker já tomou a intenção simulada", async () => {
    m.db.intencaoMensagem.findUnique.mockResolvedValue({ id: "intencao", status: "SIMULADA", motivoFalha: "ambiente_sem_live" });
    m.db.intencaoMensagem.updateMany.mockResolvedValue({ count: 0 });
    expect(await enfileirarIntencaoCobranca(tx, entrada())).toBe("ja_existente");
    expect(m.db.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "intencao", status: "SIMULADA", motivoFalha: "ambiente_sem_live" },
    }));
    expect(m.db.intencaoMensagem.create).not.toHaveBeenCalled();
    expect(m.db.intencaoMensagem.update).not.toHaveBeenCalled();
  });
});
