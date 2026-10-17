import { describe, expect, it } from "vitest";
import { ErroDriver } from "./canal";
import { driverDoNumero } from "./despachante";

// Revisão R1 do #205 (C3): número sem driver registrado em DRIVERS não pode virar `resultado_incerto`
// (revisão humana de algo que com certeza não saiu). Falha com motivo estável antes de qualquer I/O.
// Fase 4B: só o MOTOR está registrado; os legados META_CLOUD/BAILEYS ficam sem driver.
describe("driverDoNumero", () => {
  it.each(["META_CLOUD", "BAILEYS"] as const)("%s legado sem registro lança ErroDriver driver_sem_implementacao", (driver) => {
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
