import { describe, expect, it } from "vitest";
import { APELIDOS_FUSO_LEGADOS, APELIDOS_FUSO_US_BRASIL, LINKS_FUSO_BACKWARD_ICU, dataCivilInstitucional, fusoIanaValido, inicioDoDiaCivil, inicioDoDiaInstitucional, inicioDoDiaSeguinteInstitucional, inicioDoMesInstitucional, FusoInstitucionalSchema, FusoPreferenciaSchema, normalizarFusoIana, diaCivilGravado, diasCivisDesde, vencimentoEmAtraso, limiteDoAtraso } from "./fuso";
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
describe("início do dia civil institucional", () => {
  it("meia-noite de Brasília é 03h UTC", () => {
    expect(inicioDoDiaCivil("2026-03-10", "America/Sao_Paulo").toISOString()).toBe("2026-03-10T03:00:00.000Z");
  });
  it("às 23h30 de Brasília (02h30 UTC do dia seguinte), o dia da escola ainda é o anterior", () => {
    expect(inicioDoDiaInstitucional(new Date("2026-03-11T02:30:00Z"), "America/Sao_Paulo").toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(inicioDoDiaInstitucional(new Date("2026-03-11T03:30:00Z"), "America/Sao_Paulo").toISOString()).toBe("2026-03-11T03:00:00.000Z");
  });
  it("sem meia-noite (America/Santiago, início do horário de verão em 06/09/2026), começa no primeiro instante válido", () => {
    expect(inicioDoDiaCivil("2026-09-06", "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(inicioDoDiaInstitucional(new Date("2026-09-06T15:00:00Z"), "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });
  it("com meia-noite repetida no fim do horário de verão (America/Santiago, 05/04/2026), começa depois que a véspera acaba", () => {
    expect(inicioDoDiaCivil("2026-04-05", "America/Santiago").toISOString()).toBe("2026-04-05T04:00:00.000Z");
  });
  it("fusos extremos do calendário", () => {
    expect(inicioDoDiaCivil("2026-01-01", "Pacific/Kiritimati").toISOString()).toBe("2025-12-31T10:00:00.000Z");
    expect(inicioDoDiaCivil("2026-01-01", "Etc/GMT+12").toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
  it.each(["2026-02-30", "2026-13-01", "26-01-01"])("recusa a data civil inválida %s", (data) => {
    expect(() => inicioDoDiaCivil(data, "America/Sao_Paulo")).toThrow();
  });
});
describe("início do dia seguinte e do mês institucional", () => {
  it("às 23h30 de Brasília, o dia seguinte da escola começa à meia-noite local (03h UTC)", () => {
    expect(inicioDoDiaSeguinteInstitucional(new Date("2026-03-11T02:30:00Z"), "America/Sao_Paulo").toISOString()).toBe("2026-03-11T03:00:00.000Z");
  });
  it("o dia seguinte sem meia-noite (America/Santiago, 06/09/2026) começa à 01h local", () => {
    expect(inicioDoDiaSeguinteInstitucional(new Date("2026-09-05T20:00:00Z"), "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });
  it("vira o mês e o ano no calendário da escola", () => {
    expect(inicioDoDiaSeguinteInstitucional(new Date("2027-01-01T02:00:00Z"), "America/Sao_Paulo").toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
  it("o mês da escola começa no dia 1 local, mesmo quando em UTC já é o mês seguinte", () => {
    expect(inicioDoMesInstitucional(new Date("2026-11-01T04:30:00Z"), "America/Costa_Rica").toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });
});
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
describe("links do backward listados pelo ICU", () => {
  it.each([
    ["Asia/Calcutta", "Asia/Kolkata"], ["America/Buenos_Aires", "America/Argentina/Buenos_Aires"], ["Europe/Kiev", "Europe/Kyiv"],
    ["Asia/Saigon", "Asia/Ho_Chi_Minh"], ["Asia/Katmandu", "Asia/Kathmandu"], ["Asia/Rangoon", "Asia/Yangon"],
    ["Atlantic/Faeroe", "Atlantic/Faroe"], ["America/Indianapolis", "America/Indiana/Indianapolis"],
    ["America/Louisville", "America/Kentucky/Louisville"], ["Pacific/Truk", "Pacific/Chuuk"], ["Pacific/Ponape", "Pacific/Pohnpei"],
    ["America/Godthab", "America/Nuuk"], ["Pacific/Enderbury", "Pacific/Kanton"], ["Africa/Asmera", "Africa/Asmara"],
    ["America/Cordoba", "America/Argentina/Cordoba"], ["America/Mendoza", "America/Argentina/Mendoza"],
    ["America/Jujuy", "America/Argentina/Jujuy"], ["America/Catamarca", "America/Argentina/Catamarca"],
  ])("%s vira %s", (link, canonico) => {
    expect(normalizarFusoIana(link)).toBe(canonico);
    expect(FusoPreferenciaSchema.parse(link)).toBe(canonico);
  });
  it("cada link e seu destino são o mesmo fuso para o ICU", () => {
    const zona = (fuso: string) => new Intl.DateTimeFormat("en", { timeZone: fuso }).resolvedOptions().timeZone;
    for (const [link, canonico] of Object.entries(LINKS_FUSO_BACKWARD_ICU)) expect(zona(canonico), link).toBe(zona(link));
  });
  it("o mapa geral reúne os dois grupos, sem chave repetida", () => {
    expect(Object.keys(APELIDOS_FUSO_LEGADOS)).toHaveLength(Object.keys(APELIDOS_FUSO_US_BRASIL).length + Object.keys(LINKS_FUSO_BACKWARD_ICU).length);
    expect(new Set(Object.keys(APELIDOS_FUSO_LEGADOS).map((k) => k.toLowerCase())).size).toBe(Object.keys(APELIDOS_FUSO_LEGADOS).length);
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

describe("vencimento em atraso no dia civil da escola", () => {
  const FUSO = "America/Sao_Paulo";
  const convencoes = {
    "meio-dia da escola": new Date("2026-06-23T15:00:00Z"),
    "meia-noite da escola": new Date("2026-06-23T03:00:00Z"),
    "meia-noite UTC (legado)": new Date("2026-06-23T00:00:00Z"),
  };
  const noDia2130 = new Date("2026-06-24T00:30:00Z");
  const noDia2359 = new Date("2026-06-24T02:59:59Z");
  const seguinte0030 = new Date("2026-06-24T03:30:00Z");
  const vespera2130 = new Date("2026-06-23T00:30:00Z");

  it.each(Object.entries(convencoes))("%s: às 21h30 do dia do vencimento não está atrasado; à 00h30 do dia seguinte está", (_, vencimento) => {
    expect(vencimentoEmAtraso(vencimento, vespera2130, FUSO)).toBe(false);
    expect(vencimentoEmAtraso(vencimento, noDia2130, FUSO)).toBe(false);
    expect(vencimentoEmAtraso(vencimento, noDia2359, FUSO)).toBe(false);
    expect(vencimentoEmAtraso(vencimento, seguinte0030, FUSO)).toBe(true);
  });

  it("limiteDoAtraso separa os vencimentos exatamente como vencimentoEmAtraso (filtro no banco)", () => {
    const fusos = ["America/Sao_Paulo", "America/Costa_Rica", "Europe/Moscow", "Asia/Tokyo", "UTC", "America/Santiago"];
    const agoras = [vespera2130, noDia2130, noDia2359, seguinte0030, new Date("2026-09-06T04:30:00Z"), new Date("2026-06-23T14:59:59Z")];
    for (const fuso of fusos) for (const agora of agoras) {
      const limite = limiteDoAtraso(agora, fuso);
      for (let h = -72; h <= 72; h++) {
        const vencimento = new Date(agora.getTime() + h * 3600_000 + 1234);
        expect(vencimento < limite, `${fuso} ${agora.toISOString()} ${vencimento.toISOString()}`).toBe(vencimentoEmAtraso(vencimento, agora, fuso));
      }
    }
  });

  it("diaCivilGravado e diasCivisDesde continuam os mesmos da régua (sem cópia)", async () => {
    const regua = await import("@/server/cobrancas/regua");
    expect(regua.diaCivilGravado).toBe(diaCivilGravado);
    expect(regua.diasCivisDesde).toBe(diasCivisDesde);
  });
});
