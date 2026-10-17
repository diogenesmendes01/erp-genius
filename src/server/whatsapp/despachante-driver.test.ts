import { describe, expect, it } from "vitest";
import { ErroDriver } from "./canal";
import { driverDoNumero } from "./despachante";

// Revisão R1 do #205 (C3): número sem driver registrado em DRIVERS não pode virar `resultado_incerto`
// (revisão humana de algo que com certeza não saiu). Falha com motivo estável antes de qualquer I/O.
describe("driverDoNumero", () => {
  it("MOTOR antes do registro em DRIVERS lança ErroDriver driver_sem_implementacao", () => {
    let erro: unknown;
    try {
      driverDoNumero("MOTOR");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroDriver);
    expect(erro).toMatchObject({ motivo: "driver_sem_implementacao", reprocessavel: false });
  });

  it("META_CLOUD e BAILEYS seguem com o driver de sempre", () => {
    expect(driverDoNumero("META_CLOUD").enviarTexto).toBeTypeOf("function");
    expect(driverDoNumero("BAILEYS").enviarTexto).toBeTypeOf("function");
  });
});
