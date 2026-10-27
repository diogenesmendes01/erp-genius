import { DriverWhatsApp } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ErroDriver } from "./canal";
import { driverDoNumero } from "./despachante";

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
