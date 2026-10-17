import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, enviarTexto } = vi.hoisted(() => ({ authMock: vi.fn(), enviarTexto: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Driver FALSO: nenhuma mensagem real sai.
vi.mock("../drivers/motor", () => ({ driverMotor: { enviarTexto, enviarTemplate: vi.fn(), enviarMidia: vi.fn(), enviarConteudo: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { despacharMensagemGrupo } from "../despachante";
import { enviarMensagemGrupo } from "./acoes-mensagem";
import { reconciliarEcoErp } from "./processar-mensagem";

const GRUPO = "120363000000000001@g.us";

beforeEach(async () => {
  await truncarBanco(); authMock.mockReset(); enviarTexto.mockReset();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTexto.mockResolvedValue({ providerMessageId: "3EBG1", mensagemIdMotor: `${GRUPO}:3EBG1` });
});
afterEach(() => vi.unstubAllEnvs());

async function cenario() {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511900000001", rotulo: "Motor", driver: "MOTOR", finalidade: "COBRANCA", providerRef: "n-grupo", setores: { create: [{ finalidade: "FINANCEIRO" }] } },
  });
  const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: numero.id, grupoJid: GRUPO, nome: "Avisos" } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, grupoId: grupo.id } });
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  authMock.mockResolvedValue({ user: { id: admin.id } });
  return { numero, grupo, conversa, admin };
}

describe("envio humano para grupo", () => {
  it("envia para o JID do grupo com clientMessageId da mensagem", async () => {
    const { conversa, admin, numero } = await cenario();
    const r = await enviarMensagemGrupo({ conversaId: conversa.id, texto: "Reunião amanhã" });
    expect(r).toEqual({ ok: true, dado: { status: "ENVIADA" } });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({
      conversaId: conversa.id, atendimentoId: null, direcao: "SAIDA", origem: "HUMANO", autorId: admin.id, corpo: "Reunião amanhã",
      status: "ENVIADA", providerMessageId: "3EBG1", mensagemIdMotor: `${GRUPO}:3EBG1`, driver: "MOTOR",
    });
    expect(m.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(enviarTexto).toHaveBeenCalledTimes(1);
    expect(enviarTexto).toHaveBeenCalledWith(expect.objectContaining({ id: numero.id }), GRUPO, "Reunião amanhã",
      { clientMessageId: m.clientMessageId, origem: "HUMANO" });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
  });

  it("eco origem erp do grupo não duplica", async () => {
    const { conversa, numero } = await cenario();
    await enviarMensagemGrupo({ conversaId: conversa.id, texto: "oi grupo" });
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    const r = await reconciliarEcoErp("n-grupo", {
      mensagemId: `${GRUPO}:3EBG1`, providerMessageId: "3EBG1", chatJid: GRUPO, ehGrupo: true, direcao: "SAIDA", origem: "erp",
      clientMessageId: m.clientMessageId!, tipo: "TEXTO", tipoMotor: "text", texto: "oi grupo", quando: Date.now(),
    } as never);
    expect(r).toBe("ok");
    expect(await prisma.mensagemWhatsApp.count({ where: { numeroId: numero.id } })).toBe(1);
  });

  it("eco origem erp que chega com a mensagem ainda NA_FILA completa o envio sem duplicar", async () => {
    const { conversa, numero } = await cenario();
    let resultadoEco: unknown;
    let statusNoEco: string | undefined;
    enviarTexto.mockImplementation(async (_n: unknown, _jid: string, _t: string, opcoes: { clientMessageId: string }) => {
      // O eco chega antes de o despachante gravar o resultado do envio.
      resultadoEco = await reconciliarEcoErp("n-grupo", {
        mensagemId: `${GRUPO}:3EBG1`, providerMessageId: "3EBG1", chatJid: GRUPO, ehGrupo: true, direcao: "SAIDA", origem: "erp",
        clientMessageId: opcoes.clientMessageId, tipo: "TEXTO", tipoMotor: "text", texto: "oi grupo", quando: Date.now(),
      } as never);
      statusNoEco = (await prisma.mensagemWhatsApp.findFirstOrThrow()).status;
      return { providerMessageId: "3EBG1", mensagemIdMotor: `${GRUPO}:3EBG1` };
    });
    expect(await enviarMensagemGrupo({ conversaId: conversa.id, texto: "oi grupo" })).toEqual({ ok: true, dado: { status: "ENVIADA" } });
    expect(resultadoEco).toBe("ok");
    expect(statusNoEco).toBe("NA_FILA");
    expect(await prisma.mensagemWhatsApp.count({ where: { numeroId: numero.id } })).toBe(1);
    expect(await prisma.mensagemWhatsApp.findFirstOrThrow()).toMatchObject({
      status: "ENVIADA", providerMessageId: "3EBG1", mensagemIdMotor: `${GRUPO}:3EBG1`,
    });
  });

  it("sem WHATSAPP_LIVE fica SIMULADA sem I/O", async () => {
    vi.stubEnv("WHATSAPP_LIVE", "");
    const { conversa } = await cenario();
    expect(await enviarMensagemGrupo({ conversaId: conversa.id, texto: "teste" })).toEqual({ ok: true, dado: { status: "SIMULADA" } });
    expect(enviarTexto).not.toHaveBeenCalled();
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({ status: "NA_FILA", providerMessageId: null });
    expect(await despacharMensagemGrupo(m.id)).toBe("SIMULADA");
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it("usuário sem escopo no grupo é recusado", async () => {
    const { conversa } = await cenario();
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    expect(await enviarMensagemGrupo({ conversaId: conversa.id, texto: "oi" })).toEqual({ ok: false, erro: "Grupo fora do seu escopo de envio." });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("falha do driver marca FALHOU", async () => {
    const { conversa } = await cenario();
    const { ErroDriver } = await import("../canal");
    enviarTexto.mockRejectedValue(new ErroDriver("motor_numero_desconectado", "desconectado", { reprocessavel: true }));
    expect(await enviarMensagemGrupo({ conversaId: conversa.id, texto: "oi" })).toEqual({ ok: true, dado: { status: "FALHOU" } });
    expect(await prisma.mensagemWhatsApp.findFirstOrThrow()).toMatchObject({ status: "FALHOU" });
  });
});
