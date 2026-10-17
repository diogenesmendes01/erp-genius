import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../motor/cliente", async (orig) => ({ ...(await orig<typeof import("../motor/cliente")>()), chamarMotor: vi.fn() }));

import { chamarMotor, ErroMotor } from "../motor/cliente";
import { driverMotor } from "./motor";

const chamar = vi.mocked(chamarMotor);
const numero = { id: "n1", telefoneE164: "+5511", driver: "MOTOR" as const, providerRef: "n1" };
const op = { clientMessageId: "11111111-1111-4111-8111-111111111111", origem: "HUMANO" as const };
const ROTA = "/v1/numeros/n1/mensagens";

beforeEach(() => {
  chamar.mockReset();
  chamar.mockResolvedValue({ providerMessageId: "3EB0X", mensagemIdMotor: "5511@s.whatsapp.net:3EB0X" });
});

const jsonDaChamada = () => (chamar.mock.calls[0][1] as { json: Record<string, unknown> }).json;

describe("driverMotor", () => {
  it("texto para E.164 usa paraE164 e X-Origem HUMANO", async () => {
    await driverMotor.enviarTexto(numero, "+50688887777", "oi", op);
    expect(chamar).toHaveBeenCalledWith(ROTA, expect.objectContaining({
      metodo: "POST", timeoutMs: 15000,
      json: { clientMessageId: op.clientMessageId, paraE164: "+50688887777", tipo: "texto", texto: "oi" },
      cabecalhos: { "x-origem": "HUMANO" },
    }));
  });

  it("destino com @ vai em `para`", async () => {
    await driverMotor.enviarTexto(numero, "120363@g.us", "oi", op);
    const j = jsonDaChamada();
    expect(j.para).toBe("120363@g.us");
    expect(j).not.toHaveProperty("paraE164");
  });

  it("citação vai em citarMensagemId", async () => {
    await driverMotor.enviarTexto(numero, "+5", "oi", { ...op, citarMensagemIdMotor: "a@s.whatsapp.net:X" });
    expect(jsonDaChamada().citarMensagemId).toBe("a@s.whatsapp.net:X");
  });

  it("CRON manda X-Origem AUTOMACAO", async () => {
    await driverMotor.enviarTexto(numero, "+5", "oi", { ...op, origem: "CRON" });
    expect(chamar.mock.calls[0][1]).toMatchObject({ cabecalhos: { "x-origem": "AUTOMACAO" } });
  });

  it("template vira texto com corpoRenderizado", async () => {
    await driverMotor.enviarTemplate(numero, "+5", { nome: "t", idioma: "pt_BR", variaveis: ["a"], corpoRenderizado: "Olá a" }, op);
    expect(jsonDaChamada()).toMatchObject({ tipo: "texto", texto: "Olá a" });
  });

  it("áudio vai em multipart com ptt=true e arquivo", async () => {
    await driverMotor.enviarMidia(numero, "+5", {
      tipo: "AUDIO", mime: "audio/ogg", nomeArquivo: "a.ogg", dadosBase64: Buffer.from("abc").toString("base64"),
    }, op);
    const init = chamar.mock.calls[0][1] as { form: FormData; timeoutMs: number; json?: unknown };
    expect(init.json).toBeUndefined();
    expect(init.timeoutMs).toBe(60000);
    expect(JSON.parse(init.form.get("payload") as string)).toMatchObject({ tipo: "audio", ptt: true, clientMessageId: op.clientMessageId });
    const arq = init.form.get("arquivo") as Blob;
    expect(arq.type).toBe("audio/ogg");
    expect(arq.size).toBe(3);
  });

  it("imagem leva legenda e tipo `imagem`; vídeo e documento mapeiam", async () => {
    const base = { mime: "x/y", nomeArquivo: "f", dadosBase64: "YQ==" };
    for (const [tipo, esperado] of [["IMAGEM", "imagem"], ["VIDEO", "video"], ["DOCUMENTO", "documento"]] as const) {
      chamar.mockClear();
      await driverMotor.enviarMidia(numero, "+5", { ...base, tipo, legenda: "l" }, op);
      const p = JSON.parse((chamar.mock.calls[0][1] as { form: FormData }).form.get("payload") as string);
      expect(p).toMatchObject({ tipo: esperado, legenda: "l" });
      expect(p).not.toHaveProperty("ptt");
    }
  });

  it("devolve providerMessageId e mensagemIdMotor", async () => {
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).resolves.toEqual({
      providerMessageId: "3EB0X", mensagemIdMotor: "5511@s.whatsapp.net:3EB0X",
    });
  });

  it("NAO_ENVIADO numero_desconectado → ErroDriver reprocessável", async () => {
    chamar.mockRejectedValue(new ErroMotor("NAO_ENVIADO", 409, "numero_desconectado"));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_numero_desconectado", reprocessavel: true, adiarMs: 60000 });
  });

  it("motor_encerrando e limite_ritmo são reprocessáveis", async () => {
    chamar.mockRejectedValueOnce(new ErroMotor("NAO_ENVIADO", 409, "motor_encerrando"));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_motor_encerrando", reprocessavel: true });
    chamar.mockRejectedValueOnce(new ErroMotor("LIMITE_RITMO", 409, "limite_ritmo"));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_limite_ritmo", reprocessavel: true });
  });

  it("NAO_ENVIADO midia_invalida → não reprocessável", async () => {
    chamar.mockRejectedValue(new ErroMotor("NAO_ENVIADO", 409, "midia_invalida"));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_midia_invalida", reprocessavel: false });
  });

  it("RESULTADO_INCERTO → ErroDriver resultado_incerto, não reprocessável", async () => {
    chamar.mockRejectedValue(new ErroMotor("RESULTADO_INCERTO", 502, undefined, "3EB0X"));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "resultado_incerto", reprocessavel: false });
  });

  it("EM_ANDAMENTO → reprocessável em 120000 ms", async () => {
    chamar.mockRejectedValue(new ErroMotor("EM_ANDAMENTO", 409));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_em_andamento", reprocessavel: true, adiarMs: 120000 });
  });

  it("INDISPONIVEL e TIMEOUT → reprocessáveis", async () => {
    chamar.mockRejectedValueOnce(new ErroMotor("INDISPONIVEL", 0));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_indisponivel", reprocessavel: true });
    chamar.mockRejectedValueOnce(new ErroMotor("TIMEOUT", 0));
    await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: "motor_timeout", reprocessavel: true });
  });

  it("NAO_AUTORIZADO, NUMERO_INEXISTENTE e SEM_CONFIG → não reprocessáveis", async () => {
    for (const [cod, st] of [["NAO_AUTORIZADO", 401], ["NUMERO_INEXISTENTE", 404], ["SEM_CONFIG", 0]] as const) {
      chamar.mockRejectedValueOnce(new ErroMotor(cod, st));
      await expect(driverMotor.enviarTexto(numero, "+5", "x", op)).rejects.toMatchObject({ motivo: `motor_${cod.toLowerCase()}`, reprocessavel: false });
    }
  });

  it("conteúdos especiais mapeiam tipo e campos", async () => {
    const jsonDe = async (c: Parameters<NonNullable<typeof driverMotor.enviarConteudo>>[2]) => {
      chamar.mockClear();
      await driverMotor.enviarConteudo!(numero, "+5", c, null, op);
      return jsonDaChamada();
    };
    expect(await jsonDe({ tipo: "ENQUETE", nome: "Q", opcoes: ["a", "b"], maxEscolhas: 1 })).toMatchObject({ tipo: "enquete", enquete: { nome: "Q", opcoes: ["a", "b"], maxEscolhas: 1 } });
    expect(await jsonDe({ tipo: "LOCALIZACAO", latitude: 1, longitude: 2, nome: "Escola" })).toMatchObject({ tipo: "localizacao", localizacao: { latitude: 1, longitude: 2, nome: "Escola" } });
    expect(await jsonDe({ tipo: "CONTATO", contatoJid: "5511@s.whatsapp.net" })).toMatchObject({ tipo: "contato", contatoJid: "5511@s.whatsapp.net" });
  });

  it("figurinha e GIF mandam o arquivo em multipart", async () => {
    const m = { tipo: "IMAGEM" as const, mime: "image/webp", nomeArquivo: "s.webp", dadosBase64: "YQ==" };
    await driverMotor.enviarConteudo!(numero, "+5", { tipo: "FIGURINHA" }, m, op);
    const p1 = JSON.parse((chamar.mock.calls[0][1] as { form: FormData }).form.get("payload") as string);
    expect(p1.tipo).toBe("figurinha");
    chamar.mockClear();
    await driverMotor.enviarConteudo!(numero, "+5", { tipo: "GIF" }, { ...m, tipo: "VIDEO", mime: "video/mp4" }, op);
    const p2 = JSON.parse((chamar.mock.calls[0][1] as { form: FormData }).form.get("payload") as string);
    expect(p2).toMatchObject({ tipo: "imagem", gif: true });
  });
});
