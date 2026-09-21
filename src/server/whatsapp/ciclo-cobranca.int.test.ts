import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

const { enviarMock, authMock } = vi.hoisted(() => ({ enviarMock: vi.fn(), authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Exercita o despacho completo com respostas falsas; nenhum driver acessa a rede.
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { agoraAs, diasDepois, seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { registrarCobrancaWhatsApp } from "@/server/financeiro/acoes";
import { montarReguaPorCobranca } from "@/server/cobrancas/consultas";
import { enfileirarIntencaoCobranca } from "./fila";
import { referenciaDestinoCobranca, snapshotCobranca } from "./elegibilidade";
import { garantirContato } from "./identidade";
import { despacharFila } from "./despachante";
import { rodarCronRegua } from "./cron";

let contexto: Awaited<ReturnType<typeof seedCobranca>>;
let canal: Awaited<ReturnType<typeof seedCanal>>;
let agora: Date;

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarMock.mockReset().mockImplementation(async () => ({ providerMessageId: `teste-ciclo-${randomUUID()}` }));
  authMock.mockReset();
  agora = agoraAs(10);
  canal = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
  contexto = await seedCobranca({ vencimento: diasDepois(agora, 6) });
});
afterEach(() => vi.unstubAllEnvs());

async function enfileirarAtual() {
  const s = await snapshotCobranca(contexto.cobranca.id);
  if (!s?.destino) throw new Error("Fixture sem destino de cobrança.");
  const destino = s.destino;
  const resultado = await prisma.$transaction(async (tx) => {
    const contato = await garantirContato(tx, { telefoneE164: destino.telefoneE164, alunoId: destino.alunoId });
    return enfileirarIntencaoCobranca(tx, {
      cobrancaId: s.c.id, passo: "D-7", numeroId: canal.numero.id, contatoId: contato.id, origem: "CRON", autorId: null,
      referenciaCalendario: { versao: s.c.versao, vencimento: s.c.vencimento.toISOString(), cicloRegua: s.c.cicloRegua },
      referenciaDestino: referenciaDestinoCobranca(destino),
      corpoRenderizado: `Vencimento ${s.c.vencimento.toISOString()}`, variaveis: [],
      templateId: canal.templates.get("amigavel")!, politicaId: canal.politica.id,
    });
  });
  const intencao = await prisma.intencaoMensagem.findUniqueOrThrow({ where: {
    cobrancaId_passo_cicloCobranca: { cobrancaId: s.c.id, passo: "D-7", cicloCobranca: s.c.cicloRegua },
  } });
  return { resultado, intencao };
}

async function reprogramar() {
  return prisma.$transaction(async (tx) => {
    const c = await tx.cobranca.update({ where: { id: contexto.cobranca.id }, data: {
      vencimento: diasDepois(agora, 7), cicloRegua: { increment: 1 }, versao: { increment: 1 },
    } });
    await tx.evento.create({ data: { tipo: "CobrancaRenegociada", agregadoTipo: "Cobranca", agregadoId: c.id,
      payload: { origem: "RETOMADA", novoVencimento: c.vencimento.toISOString(), cicloRegua: c.cicloRegua } } });
    return c;
  });
}

async function manterDatas() {
  await prisma.cobranca.update({ where: { id: contexto.cobranca.id }, data: { status: "CANCELADA", versao: { increment: 1 } } });
  return prisma.cobranca.update({ where: { id: contexto.cobranca.id }, data: { status: "PENDENTE", versao: { increment: 1 } } });
}

describe("calendário da cobrança e histórico de WhatsApp", () => {
  it("versão invalida intenção anterior à pausa mesmo ao manter vencimento e ciclo", async () => {
    const { intencao } = await enfileirarAtual();
    const depois = await manterDatas();
    expect(depois.cicloRegua).toBe(0);
    expect(depois.vencimento).toEqual(contexto.cobranca.vencimento);
    expect(await despacharFila(agora)).toMatchObject({ canceladas: 1, despachadas: 0 });
    expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).toMatchObject({
      status: "CANCELADA", motivoFalha: "cobranca_alterada_revisar", referenciaCobranca: intencao.referenciaCobranca,
    });
  });

  it("degrau enviado no ciclo 0 permite nova intenção no ciclo 1, preservando o histórico", async () => {
    expect(await rodarCronRegua(agora)).toMatchObject({ enfileiradas: 1, despacho: { despachadas: 1 } });
    const anterior = await prisma.intencaoMensagem.findFirstOrThrow();
    await reprogramar();
    expect(await rodarCronRegua(agora)).toMatchObject({ enfileiradas: 1, despacho: { despachadas: 1 } });
    expect(await prisma.intencaoMensagem.count()).toBe(2);
    expect(await prisma.mensagemWhatsApp.count()).toBe(2);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior);
    const ciclos = (await prisma.evento.findMany({ where: { tipo: "CobrancaEnviadaWhatsApp" } })).map((e) => (e.payload as { cicloRegua: number }).cicloRegua).sort();
    expect(ciclos).toEqual([0, 1]);
  });

  it("repetição do mesmo ciclo não duplica intenção ou envio", async () => {
    const primeira = await enfileirarAtual();
    expect((await enfileirarAtual()).resultado).toBe("ja_existente");
    await despacharFila(agora);
    expect((await enfileirarAtual()).resultado).toBe("ja_existente");
    expect(await despacharFila(agora)).toMatchObject({ despachadas: 0 });
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).id).toBe(primeira.intencao.id);
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("manter datas preserva a deduplicação de degrau já enviado", async () => {
    await rodarCronRegua(agora);
    const anterior = await prisma.intencaoMensagem.findFirstOrThrow();
    await manterDatas();
    expect(await rodarCronRegua(agora)).toMatchObject({ acoesDevidas: 0, enfileiradas: 0 });
    expect(await enfileirarAtual()).toMatchObject({ resultado: "ja_existente", intencao: anterior });
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("duas reaberturas concorrentes preservam uma única intenção no ciclo", async () => {
    const { intencao } = await enfileirarAtual();
    await prisma.intencaoMensagem.update({ where: { id: intencao.id }, data: { status: "SIMULADA", motivoFalha: "ambiente_sem_live" } });
    const resultados = await Promise.all([enfileirarAtual(), enfileirarAtual()]);
    expect(resultados.map((r) => r.resultado).sort()).toEqual(["ja_existente", "reaberta"]);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await despacharFila(agora)).toMatchObject({ despachadas: 1 });
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it.each([false, true])("ciclo anterior é recusado antes do envio, inclusive sem assinatura (legado=%s)", async (legado) => {
    const { intencao } = await enfileirarAtual();
    if (legado) await prisma.intencaoMensagem.update({ where: { id: intencao.id }, data: { referenciaCobranca: null } });
    await reprogramar();
    expect(await despacharFila(agora)).toMatchObject({ canceladas: 1, despachadas: 0 });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).motivoFalha).toBe("ciclo_cobranca_alterado");
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it("evento legado sem ciclo deduplica ciclo 0 e não suprime ciclo 1", async () => {
    await prisma.evento.create({ data: { tipo: "CobrancaEnviadaWhatsApp", agregadoTipo: "Cobranca", agregadoId: contexto.cobranca.id,
      payload: { passo: "D-7", modelo: "amigavel", canal: "manual" }, versao: 2 } });
    const { intencao } = await enfileirarAtual();
    expect(await despacharFila(agora)).toMatchObject({ canceladas: 1, despachadas: 0 });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).motivoFalha).toBe("degrau_ja_cumprido");
    await reprogramar();
    expect(await rodarCronRegua(agora)).toMatchObject({ enfileiradas: 1, despacho: { despachadas: 1 } });
    expect(enviarMock).toHaveBeenCalledOnce();
  });

  it("resposta do provedor após reprogramação mantém o envio no ciclo original", async () => {
    await enfileirarAtual();
    enviarMock.mockImplementationOnce(async () => {
      await reprogramar();
      return { providerMessageId: "resposta-atrasada-ciclo-0" };
    });
    expect(await despacharFila(agora)).toMatchObject({ despachadas: 1 });
    const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "CobrancaEnviadaWhatsApp" } });
    expect(evento.payload).toMatchObject({ cicloRegua: 0 });
    const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: contexto.cobranca.id } });
    const regua = await montarReguaPorCobranca([{ id: c.id, vencimento: c.vencimento, cicloRegua: c.cicloRegua, acessoBloqueado: false }], agora);
    expect(regua.get(c.id)).toMatchObject({ estado: "acao_devida", passo: "D-7", passosFeitos: [] });
    expect(await rodarCronRegua(agora)).toMatchObject({ enfileiradas: 1, despacho: { despachadas: 1 } });
    expect(await prisma.intencaoMensagem.count()).toBe(2);
    expect(await prisma.mensagemWhatsApp.count()).toBe(2);
  });

  it("registro manual usa o ciclo exibido antes da reprogramação", async () => {
    const fin = await criarUsuario([Papel.FINANCEIRO]);
    authMock.mockResolvedValue({ user: { id: fin.id } });
    await reprogramar();
    expect(await registrarCobrancaWhatsApp(contexto.cobranca.id, "amigavel", "D-7", 0)).toMatchObject({ ok: true });
    expect((await prisma.evento.findFirstOrThrow({ where: { tipo: "CobrancaEnviadaWhatsApp" } })).payload).toMatchObject({ cicloRegua: 0 });
    expect(await rodarCronRegua(agora)).toMatchObject({ enfileiradas: 1, despacho: { despachadas: 1 } });
  });
});
