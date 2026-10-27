import { describe, expect, it } from "vitest";
import { lerConfigMotor } from "./config";

describe("guarda do motor na suíte de integração", () => {
  it("MOTOR_URL e MOTOR_API_KEY chegam vazios e a configuração do motor é recusada", () => {
    expect(process.env.MOTOR_URL ?? "").toBe("");
    expect(process.env.MOTOR_API_KEY ?? "").toBe("");
    expect(() => lerConfigMotor({ ...process.env, MOTOR_WEBHOOK_SECRET: "s".repeat(32) })).toThrow();
  });
});
