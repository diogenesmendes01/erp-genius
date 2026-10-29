import { DriverWhatsApp } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ErroDriver } from "./canal";
import { driverDoNumero, vigente } from "./despachante";

describe("driverDoNumero", () => {
  it.each([DriverWhatsApp.META_CLOUD, DriverWhatsApp.BAILEYS] as const)("%s legado sem registro lança ErroDriver driver_sem_implementacao", (driver) => {
    let erro: unknown;
    try {
      driverDoNumero(driver);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroDriver);
    expect(erro).toMatchObject({ motivo: "driver_sem_implementacao", reprocessavel: false });
  });

  it("MOTOR segue com o driver do motor próprio", () => {
    expect(driverDoNumero("MOTOR").enviarTexto).toBeTypeOf("function");
  });
});

describe("vigente", () => {
  it("o claim só vale para a intenção com o mesmo status, horário e texto lidos", () => {
    const agendadaPara = new Date("2035-01-02T15:00:00Z");
    expect(vigente({ id: "i", status: "PENDENTE", agendadaPara, corpoRenderizado: "Texto lido" }))
      .toEqual({ id: "i", status: "PENDENTE", agendadaPara, corpoRenderizado: "Texto lido" });
  });
});
