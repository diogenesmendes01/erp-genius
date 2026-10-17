import { describe, it, expect, vi, afterEach } from "vitest";
import { inboundDeEventoMotor, TIPO_POR_TIPO_MOTOR } from "./processar-mensagem";
import { DadosMensagemSchema, type EnvelopeMotor } from "./eventos";

const env: EnvelopeMotor = { idEvento: "0b9f3c1e-6c1d-4a55-9d3e-2f6f8a1b7c10", tipo: "mensagem.recebida", numeroId: "n1", ocorridoEm: 1, dados: {} };
const dados = DadosMensagemSchema.parse({
  mensagemId: "50688887777@s.whatsapp.net:ABC",
  providerMessageId: "ABC",
  chatJid: "50688887777@s.whatsapp.net",
  ehGrupo: false,
  direcao: "ENTRADA",
  contato: { jid: "50688887777@s.whatsapp.net", telefoneE164: "+50688887777", nomePerfil: "Ana" },
  tipo: "TEXTO",
  tipoMotor: "text",
  texto: "oi",
  quando: 1790000000000,
});

afterEach(() => vi.restoreAllMocks());

describe("inboundDeEventoMotor", () => {
  it("individual com telefone vira InboundNormalizado MOTOR", () => {
    expect(inboundDeEventoMotor(env, dados)).toMatchObject({
      numeroProviderRef: "n1",
      contatoWaId: "50688887777",
      nomeExibicao: "Ana",
      providerMessageId: "ABC",
      mensagemIdMotor: "50688887777@s.whatsapp.net:ABC",
      corpo: "oi",
      tipo: "TEXTO",
      driver: "MOTOR",
      fromMe: false,
      quando: new Date(1790000000000),
    });
  });

  it("fromMe propaga para o InboundNormalizado", () => {
    expect(inboundDeEventoMotor(env, dados, true)).toMatchObject({ fromMe: true, driver: "MOTOR" });
  });

  it("LID sem telefone descarta sem conteúdo no log", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const lid = { ...dados, texto: "segredo-da-conversa", contato: { jid: "123@lid", nomePerfil: "Ana" } };
    expect(inboundDeEventoMotor(env, lid)).toEqual({ descarte: "lid_sem_telefone" });
    expect(warn).toHaveBeenCalledWith("motor: mensagem descartada", { numeroRef: "n1", motivo: "lid_sem_telefone" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("segredo-da-conversa");
  });

  it("grupo é descartado", () => {
    expect(inboundDeEventoMotor(env, { ...dados, ehGrupo: true })).toEqual({ descarte: "grupo" });
  });

  it("tipoMotor sticker → FIGURINHA", () => {
    expect(TIPO_POR_TIPO_MOTOR.sticker).toBe("FIGURINHA");
    expect(TIPO_POR_TIPO_MOTOR.location).toBe("LOCALIZACAO");
    expect(TIPO_POR_TIPO_MOTOR.contact).toBe("CONTATO");
    expect(TIPO_POR_TIPO_MOTOR.poll).toBe("ENQUETE");
    const r = inboundDeEventoMotor(env, { ...dados, tipo: "OUTRO", tipoMotor: "sticker" });
    expect(r).toMatchObject({ tipo: "FIGURINHA" });
  });

  it("demais tipos seguem o campo tipo", () => {
    expect(inboundDeEventoMotor(env, { ...dados, tipo: "IMAGEM", tipoMotor: "image" })).toMatchObject({ tipo: "IMAGEM" });
  });
});
