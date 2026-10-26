import { describe, expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared/sessao";
import * as grade from "@/server/agenda/grade";
import { proximaOcorrenciaTarefa, type PedidoRecorrenciaTarefa } from "./tarefa-recorrencia-regras";
const pedido = (dataCivil = "2026-01-31", hora: string | null = "09:00", fusoOrigem = "UTC", corte = "2026-01-31T10:00:00Z", recorrencia: PedidoRecorrenciaTarefa["recorrencia"] = "MENSAL"): PedidoRecorrenciaTarefa => ({ recorrencia, indiceAtual: 0, ancora: { dataCivil, hora, fusoOrigem }, corteEm: new Date(corte) });
describe("D10 calendário original e vencidas", () => {
  it("31janeiro vira fimfevereiro e volta a31março sem perder a âncora original", () => {
    const p = pedido();
    expect(proximaOcorrenciaTarefa(p)).toMatchObject({ dataCivil: "2026-02-28", hora: "09:00", inicioEm: new Date("2026-02-28T09:00:00Z"), ajuste: "NENHUM", politicaVersao: 1 });
    expect(proximaOcorrenciaTarefa({ ...p, corteEm: new Date("2026-02-28T10:00:00Z") })).toMatchObject({ dataCivil: "2026-03-31", hora: "09:00" });
    expect(p.ancora.dataCivil).toBe("2026-01-31");
  });
  it("preserva ano bissexto e pula várias vencidas, sem catchup", () => {
    expect(proximaOcorrenciaTarefa(pedido("2024-01-31", "09:00", "UTC", "2024-01-31T10:00:00Z"))).toMatchObject({ dataCivil: "2024-02-29" });
    expect(proximaOcorrenciaTarefa(pedido("2026-01-31", "09:00", "UTC", "2026-04-01T00:00:00Z"))).toMatchObject({ dataCivil: "2026-04-30" });
  });
  it("semanal preserva o dia original após conclusão atrasada", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-01-05", "09:00", "UTC", "2026-01-20T00:00:00Z", "SEMANAL"))).toMatchObject({ dataCivil: "2026-01-26" });
  });
  it("diária com horário no mesmo dia ainda futuro não pula esse dia", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-01-01", "09:00", "UTC", "2026-01-02T08:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2026-01-02" });
  });
  it("corte exato exige instante estritamente posterior", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-01-01", "09:00", "UTC", "2026-01-02T09:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2026-01-03" });
  });
  it("conclusão antecipada do filho exige índice atual mais um, sem recriar o mesmo filho", () => {
    expect(proximaOcorrenciaTarefa({ ...pedido("2026-01-31", "09:00", "UTC", "2026-02-01T00:00:00Z"), indiceAtual: 1 })).toMatchObject({ dataCivil: "2026-03-31", indice: 2 });
  });
  it("retry é função do corte persistido, sem mutar entrada", () => {
    const p = pedido(), antes = structuredClone(p);
    expect(proximaOcorrenciaTarefa(p)).toEqual(proximaOcorrenciaTarefa(p)); expect(p).toEqual(antes);
  });
  it("corte anterior à âncora não recria a própria ocorrência original", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-01-31", "09:00", "UTC", "2026-01-01T00:00:00Z"))).toMatchObject({ dataCivil: "2026-02-28" });
  });
});
describe("D10 data ausente e só data", () => {
  it("NAO_REPETE não inventa ocorrência ou data", () => {
    expect(proximaOcorrenciaTarefa({ ...pedido(), recorrencia: "NAO_REPETE", ancora: { dataCivil: null, hora: null, fusoOrigem: "UTC" } })).toBeNull();
  });
  it("recorrência ativa exige data sem inventar hoje", () => {
    expect(() => proximaOcorrenciaTarefa({ ...pedido(), ancora: { dataCivil: null, hora: null, fusoOrigem: "UTC" } })).toThrow("A recorrência exige uma data.");
  });
  it("sódata permanece sem instante/horário e pula o dia civil vencido", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-01-01", null, "America/Costa_Rica", "2026-01-03T02:00:00Z", "DIARIA"))).toEqual({ dataCivil: "2026-01-03", hora: null, inicioEm: null, ajuste: "NENHUM", solicitado: null, resolvido: null, politicaVersao: 1, indice: 2 });
  });
});
describe("D10 DST automático auditável e sem duplicata", () => {
  it("gap avança ao primeiro minuto válido, não soma arbitrariamente uma hora", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-03-07", "02:30", "America/New_York", "2026-03-07T10:00:00Z", "DIARIA"))).toEqual({ dataCivil: "2026-03-08", hora: "03:00", inicioEm: new Date("2026-03-08T07:00:00Z"), ajuste: "GAP_AVANCADO", solicitado: "2026-03-08T02:30", resolvido: "2026-03-08T03:00", politicaVersao: 1, indice: 1 });
  });
  it("fold usa primeira ocorrência e registra a escolha", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-10-31", "01:30", "America/New_York", "2026-10-31T12:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2026-11-01", hora: "01:30", inicioEm: new Date("2026-11-01T05:30:00Z"), ajuste: "FOLD_PRIMEIRO", solicitado: "2026-11-01T01:30", resolvido: "2026-11-01T01:30" });
  });
  it("não usa segunda ocorrência se primeira já venceu", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-10-31", "01:30", "America/New_York", "2026-11-01T06:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2026-11-02", inicioEm: new Date("2026-11-02T06:30:00Z"), ajuste: "NENHUM" });
  });
  it("transição de30min não presume gap de60min", () => {
    expect(proximaOcorrenciaTarefa(pedido("2026-10-03", "02:15", "Australia/Lord_Howe", "2026-10-03T12:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2026-10-04", hora: "02:30", inicioEm: new Date("2026-10-03T15:30:00Z"), ajuste: "GAP_AVANCADO" });
  });
  it("dia civil inteiro pulado avança ao próximo válido com registro", () => {
    expect(proximaOcorrenciaTarefa(pedido("2011-12-29", "12:00", "Pacific/Apia", "2011-12-29T23:00:00Z", "DIARIA"))).toMatchObject({ dataCivil: "2011-12-31", hora: "00:00", inicioEm: new Date("2011-12-30T10:00:00Z"), ajuste: "GAP_AVANCADO", solicitado: "2011-12-30T12:00", resolvido: "2011-12-31T00:00" });
  });
  it.each(["UTC", "America/Costa_Rica", "America/Sao_Paulo", "America/New_York", "Europe/Lisbon", "Asia/Tokyo"])("independe do TZ do processo %s", tz => {
    const anterior = process.env.TZ;
    try { process.env.TZ = tz; expect(proximaOcorrenciaTarefa(pedido("2026-03-07", "02:30", "America/New_York", "2026-03-07T10:00:00Z", "DIARIA"))?.inicioEm).toEqual(new Date("2026-03-08T07:00:00Z")); }
    finally { if (anterior === undefined) delete process.env.TZ; else process.env.TZ = anterior; }
  });
});
it.each([
  { ancora: { dataCivil: "2026-02-31", hora: "09:00", fusoOrigem: "UTC" } },
  { ancora: { dataCivil: "2026-01-01", hora: "24:00", fusoOrigem: "UTC" } },
  { ancora: { dataCivil: "2026-01-01", hora: "09:00", fusoOrigem: "Lua/Base" } },
  { corteEm: new Date(NaN) },
  { indiceAtual: -1 },
  { indiceAtual: 1.5 },
])("recusa entrada inválida sem fallback %j", alteracao => { expect(() => proximaOcorrenciaTarefa({ ...pedido(), ...alteracao })).toThrow(ErroRegra); });
it("recusa ultrapassar o ano9999 em vez de gerar data fora do contrato", () => {
  expect(() => proximaOcorrenciaTarefa(pedido("9999-12-31", "09:00", "UTC", "9999-12-31T10:00:00Z", "DIARIA"))).toThrow("A próxima ocorrência excede o calendário suportado.");
});
it("salta sete milênios de vencidas sem enumerar as ocorrências anteriores", () => {
  const resolver = vi.spyOn(grade, "candidatosDaGrade");
  try {
    expect(proximaOcorrenciaTarefa(pedido("1900-01-31", "09:00", "UTC", "9000-02-01T00:00:00Z"))).toMatchObject({ dataCivil: "9000-02-28", indice: 85201 });
    expect(resolver.mock.calls.length).toBeLessThanOrEqual(2);
  } finally { resolver.mockRestore(); }
});
it("conclusão antecipada após dia pulado não cria outro filho no mesmo instante ajustado", () => {
  expect(proximaOcorrenciaTarefa({ ...pedido("2011-12-29", "00:00", "Pacific/Apia", "2011-12-30T09:00:00Z", "DIARIA"), indiceAtual: 1 })).toMatchObject({ dataCivil: "2012-01-01", inicioEm: new Date("2011-12-31T10:00:00Z"), indice: 3 });
});