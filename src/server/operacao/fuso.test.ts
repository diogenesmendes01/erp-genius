import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APELIDOS_FUSO_LEGADOS, dataCivilInstitucional, fusoIanaValido, FusoInstitucionalSchema, FusoPreferenciaSchema, normalizarFusoIana } from "./fuso";
// Um critério só para servidor, PaisSchema e CampoFuso (docs/43 §6 item 6).
describe("fusoIanaValido", () => {
  it.each(["America/Sao_Paulo", "America/Costa_Rica", "UTC", "Etc/GMT+3", "US/Eastern"])("aceita %s", (fuso) => expect(fusoIanaValido(fuso)).toBe(true));
  it.each(["", "America/Sao Paulo", "America/SaoPaulo", "GMT-3", "+03:00", "-03:00", "Brasil", "America/Inexistente"])("recusa %s", (fuso) => expect(fusoIanaValido(fuso)).toBe(false));
});
describe("data civil institucional", () => {
  it("mesmo instante pode ser datas diferentes no Brasil e Costa Rica", () => {
    const instante = new Date("2026-09-12T04:00:00Z");
    expect(dataCivilInstitucional(instante, "America/Sao_Paulo")).toBe("2026-09-12");
    expect(dataCivilInstitucional(instante, "America/Costa_Rica")).toBe("2026-09-11");
  });
  it("respeita regras sazonais do fuso", () => {
    expect(dataCivilInstitucional(new Date("2026-01-10T04:30:00Z"), "America/New_York")).toBe("2026-01-09");
    expect(dataCivilInstitucional(new Date("2026-07-10T04:30:00Z"), "America/New_York")).toBe("2026-07-10");
  });
  it.each(["", "Brasil", "+03:00", "America/Inexistente"])("não presume fuso para %s", (valor) => {
    expect(FusoInstitucionalSchema.safeParse(valor).success).toBe(false);
  });
});
// Decisão do dono (17/10/2026): apelidos legados (US/*, Brazil/*…) não existem num Postgres sem tzdata-legacy e
// travam o trigger de fuso nos UPDATEs de Usuario e ContaPortalAluno. Ao salvar, viram o nome canônico IANA.
describe("normalizarFusoIana", () => {
  it.each([
    ["US/Eastern", "America/New_York"], ["US/Central", "America/Chicago"], ["US/Mountain", "America/Denver"],
    ["US/Pacific", "America/Los_Angeles"], ["US/Arizona", "America/Phoenix"], ["US/Alaska", "America/Anchorage"],
    ["US/Hawaii", "Pacific/Honolulu"], ["Brazil/East", "America/Sao_Paulo"], ["Brazil/West", "America/Manaus"],
    ["Brazil/Acre", "America/Rio_Branco"], ["Brazil/DeNoronha", "America/Noronha"],
  ])("%s vira %s", (apelido, canonico) => expect(normalizarFusoIana(apelido)).toBe(canonico));
  it("ignora caixa e espaços nas pontas do apelido", () => {
    expect(normalizarFusoIana(" us/eastern ")).toBe("America/New_York");
  });
  it.each(["America/Sao_Paulo", "America/Costa_Rica", "UTC", "Etc/GMT+3", "America/Inexistente", ""])("deixa %s como está", (fuso) => {
    expect(normalizarFusoIana(fuso)).toBe(fuso.trim());
  });
  it("todo destino do mapa é IANA válido e não é ele mesmo um apelido", () => {
    for (const canonico of Object.values(APELIDOS_FUSO_LEGADOS)) {
      expect(fusoIanaValido(canonico)).toBe(true);
      expect(normalizarFusoIana(canonico)).toBe(canonico);
    }
  });
});
describe("migration 20261017150000 (preferências já gravadas)", () => {
  const sql = readFileSync(path.join(process.cwd(), "prisma/migrations/20261017150000_fuso_exibicao_canonico/migration.sql"), "utf8");
  it("converte, nas duas tabelas, exatamente os apelidos do mapa", () => {
    for (const tabela of ['UPDATE "Usuario"', 'UPDATE "ContaPortalAluno"']) expect(sql).toContain(tabela);
    const pares = [...sql.matchAll(/\('([^']+)', '([^']+)'\)/g)].map(([, apelido, canonico]) => [apelido, canonico]);
    const esperado = Object.entries(APELIDOS_FUSO_LEGADOS);
    expect(pares).toEqual([...esperado, ...esperado]);
  });
});
describe("FusoPreferenciaSchema", () => {
  it("normaliza o apelido antes de validar", () => {
    expect(FusoPreferenciaSchema.parse("US/Eastern")).toBe("America/New_York");
    expect(FusoPreferenciaSchema.parse(" America/Costa_Rica ")).toBe("America/Costa_Rica");
  });
  it.each(["", "GMT-3", "Brasil", "America/Inexistente"])("recusa %s", (valor) => {
    expect(FusoPreferenciaSchema.safeParse(valor).success).toBe(false);
  });
});
