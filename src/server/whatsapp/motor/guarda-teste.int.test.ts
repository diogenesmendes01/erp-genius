import { describe, expect, it } from "vitest";
import { lerConfigMotor } from "./config";

// Trava da suíte de integração (vitest.integration.config.ts): nunca enviar mensagem real em
// teste. Mesmo com MOTOR_URL/MOTOR_API_KEY exportados no shell, o processo de teste não os vê,
// e um teste live que esqueça de mockar `drivers/motor` cai em SEM_CONFIG antes de qualquer HTTP.
describe("guarda do motor na suíte de integração", () => {
  it("MOTOR_URL e MOTOR_API_KEY chegam vazios e a configuração do motor é recusada", () => {
    expect(process.env.MOTOR_URL ?? "").toBe("");
    expect(process.env.MOTOR_API_KEY ?? "").toBe("");
    expect(() => lerConfigMotor({ ...process.env, MOTOR_WEBHOOK_SECRET: "s".repeat(32) })).toThrow();
  });
});
