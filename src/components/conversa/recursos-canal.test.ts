import { DriverWhatsApp } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AVISO_RECURSO_MOTOR, RECURSOS_MOTOR, mimeVozAceito, recursoDisponivel, type RecursoMotor } from "./recursos-canal";

const TODOS: RecursoMotor[] = ["editar", "apagar", "reagir", "encaminhar", "enquete", "figurinha", "gif", "localizacao", "cartaoContato",
  "responderCitando", "confirmacaoLeitura", "digitando", "grupoEnviar", "grupoGerir", "bloquear"];

describe("recursos por driver", () => {
  it.each(["editar", "reagir", "enquete", "figurinha", "gif", "grupoEnviar", "bloquear"] as const)("%s indisponível em META_CLOUD e BAILEYS", (r) => {
    expect(recursoDisponivel(DriverWhatsApp.META_CLOUD, r)).toBe(false);
    expect(recursoDisponivel(DriverWhatsApp.BAILEYS, r)).toBe(false);
  });
  it("nenhum recurso do motor está liberado nos drivers atuais", () => {
    for (const d of [DriverWhatsApp.META_CLOUD, DriverWhatsApp.BAILEYS] as const) for (const r of TODOS) expect(recursoDisponivel(d, r)).toBe(false);
  });
  it("RECURSOS_MOTOR é a lista única dos 15 recursos (encaminhar entrou com o diálogo de destino)", () => { expect([...RECURSOS_MOTOR]).toEqual(TODOS); });
  it("MOTOR libera todos os recursos", () => {
    for (const r of TODOS) expect(recursoDisponivel("MOTOR", r)).toBe(true);
  });
  it("driver ausente do mapa não libera recurso", () => {
    // Simula um valor novo do enum antes de alguém preenchê-lo no mapa.
    const ausente = "DRIVER_FORA_DO_MAPA" as DriverWhatsApp;
    for (const r of TODOS) expect(recursoDisponivel(ausente, r)).toBe(false);
  });
  it("aviso do motor", () => { expect(AVISO_RECURSO_MOTOR).toBe("Disponível quando o motor próprio da escola entrar em uso."); });
  it("voz só com MIME aceito", () => {
    expect(mimeVozAceito("audio/ogg;codecs=opus")).toBe(true);
    expect(mimeVozAceito("audio/mpeg")).toBe(true);
    expect(mimeVozAceito("audio/mp4")).toBe(true);
    expect(mimeVozAceito("audio/webm")).toBe(false);
    expect(mimeVozAceito("audio/webm;codecs=opus")).toBe(false);
  });
});
