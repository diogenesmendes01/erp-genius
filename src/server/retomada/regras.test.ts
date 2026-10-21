import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { dataRetomada, DecidirRetomadaSchema, SolicitarRetomadaSchema } from "./schema";
import {
  estadoFinanceiroRetomada, exigirSnapshotRetomadaAtual, impedimentoRetomada,
  dataMinimaReprogramacao, montarSnapshotRetomada, parcelasElegiveisRetomada, validarDatasNaoRetroativas,
  type CobrancaRetomadaFonte, type MatriculaRetomadaFonte,
} from "./regras";

const hoje = new Date(2026, 8, 8, 16);
// Os casos antigos montam datas no relógio local do processo; a escola, neles, está no mesmo fuso.
const FUSO_SERVIDOR = Intl.DateTimeFormat().resolvedOptions().timeZone;
const pausaId = "pausa-atual";
const manter = { opcao: "MANTER_VENCIMENTOS" as const, motivo: "Retorno solicitado pelo aluno" };

function cobranca(id: string, extra: Partial<CobrancaRetomadaFonte> = {}): CobrancaRetomadaFonte {
  return {
    id, codigo: null, matriculaId: "matricula-1", versao: 3, cicloRegua: 0, tipo: "MENSALIDADE", status: "PENDENTE",
    valorOriginal: "123.45", valorNegociado: "123.45", valorRecebido: "23.40", saldo: "100.05",
    moeda: "CRC", vencimento: new Date(2026, 9, 5, 12), competencia: "2026-10", pagoEm: null,
    canceladaPorPausaId: null, ...extra,
  };
}

function matricula(extra: Partial<MatriculaRetomadaFonte> = {}): MatriculaRetomadaFonte {
  return {
    id: "matricula-1", codigo: null, leadId: null, status: "ATIVA", moeda: "CRC", mesesPlano: 3, diaVencimento: 5,
    cobrancas: [
      cobranca("atrasada", { status: "ATRASADO", vencimento: new Date(2026, 6, 5, 12) }),
      cobranca("parcial-pausada", { status: "CANCELADA", canceladaPorPausaId: pausaId }),
    ], ...extra,
  };
}

describe("entrada da retomada", () => {
  it.each(["2026-02-29", "2028-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-09-00", "2026-9-08", "08/09/2026", "2026-09-08T12:00:00Z", " 2026-09-08"])("não normaliza a data inválida %s", (valor) => {
    expect(dataRetomada(valor, "America/Sao_Paulo")).toBeNull();
    expect(SolicitarRetomadaSchema.safeParse({ ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos: [{ cobrancaId: "c", vencimento: valor }] }).success).toBe(false);
  });

  it("aceita dia bissexto real e grava o meio-dia da escola, não o do servidor (ref. #247)", () => {
    expect(dataRetomada("2028-02-29", "America/Sao_Paulo")).toEqual(new Date("2028-02-29T15:00:00.000Z"));
    expect(dataRetomada("2028-02-29", "America/Costa_Rica")).toEqual(new Date("2028-02-29T18:00:00.000Z"));
  });

  it("exige decisão booleana e motivo significativo nas duas etapas", () => {
    for (const motivo of ["", "    ", "abcd", "x".repeat(2001)]) {
      expect(SolicitarRetomadaSchema.safeParse({ ...manter, motivo }).success).toBe(false);
      expect(DecidirRetomadaSchema.safeParse({ aprovar: true, motivo }).success).toBe(false);
    }
    for (const aprovar of ["false", "true", 0, 1, null, undefined]) {
      expect(DecidirRetomadaSchema.safeParse({ aprovar, motivo: "Decisão fundamentada" }).success).toBe(false);
    }
    expect(DecidirRetomadaSchema.parse({ aprovar: false, motivo: "  Rejeitar por divergência  " }).motivo).toBe("Rejeitar por divergência");
  });

  it("não permite datas em MANTER nem duas datas para a mesma parcela", () => {
    const parcela = { cobrancaId: "c", vencimento: "2026-10-05" };
    expect(SolicitarRetomadaSchema.safeParse({ ...manter, novosVencimentos: [parcela] }).success).toBe(false);
    expect(SolicitarRetomadaSchema.safeParse({ ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos: [parcela, parcela] }).success).toBe(false);
  });
});

describe("conjunto elegível e memória financeira", () => {
  it("seleciona somente dívida mensal de matrícula ativa e da pausa correspondente", () => {
    const m = matricula({ cobrancas: [
      cobranca("aberta"),
      cobranca("pausa-atual", { status: "CANCELADA", canceladaPorPausaId: pausaId }),
      cobranca("pausa-antiga", { status: "CANCELADA", canceladaPorPausaId: "outra-pausa" }),
      cobranca("manual", { status: "CANCELADA" }),
      cobranca("paga", { status: "PAGO", valorRecebido: "123.45", saldo: 0 }),
      cobranca("quitada-sem-status", { valorRecebido: "123.45", saldo: 0 }),
      cobranca("taxa", { tipo: "MATRICULA" }),
    ] });
    const encerrada = matricula({ id: "encerrada", status: "ENCERRADA", cobrancas: [cobranca("mensalidade-encerrada")] });
    expect(parcelasElegiveisRetomada([m, encerrada], pausaId).map((p) => p.cobrancaId)).toEqual(["aberta", "pausa-atual"]);
    expect(parcelasElegiveisRetomada([m], pausaId)[1]).toMatchObject({ restaurar: true, valorNegociado: 123.45, valorRecebido: 23.4, saldo: 100.05 });
  });

  it("saldo parcial legado usa recebimentos; divergência explícita exige conciliação", () => {
    const legado = matricula({ cobrancas: [cobranca("parcial", { saldo: null })] });
    expect(parcelasElegiveisRetomada([legado], pausaId)[0].saldo).toBe(100.05);
    expect(impedimentoRetomada("PAUSADO", pausaId, true, [legado])).toBeNull();
    legado.cobrancas[0].saldo = "123.45";
    expect(impedimentoRetomada("PAUSADO", pausaId, true, [legado])).toMatch(/saldo|concilia/i);
  });

  it("bloqueia pausa legada ambígua e permite legado sem canceladas ou pausa rastreada", () => {
    const m = matricula({ cobrancas: [cobranca("aberta"), cobranca("manual", { status: "CANCELADA" })] });
    expect(impedimentoRetomada("PAUSADO", pausaId, false, [m])).toMatch(/legada|origem/i);
    expect(impedimentoRetomada("PAUSADO", pausaId, true, [m])).toBeNull();
    m.cobrancas.pop();
    expect(impedimentoRetomada("PAUSADO", pausaId, false, [m])).toBeNull();
    expect(impedimentoRetomada("ATIVO", pausaId, true, [m])).not.toBeNull();
    expect(impedimentoRetomada("PAUSADO", null, true, [m])).not.toBeNull();
    expect(impedimentoRetomada("PAUSADO", pausaId, true, [matricula({ status: "ENCERRADA" })])).not.toBeNull();
  });

  it("snapshot preserva centavos como strings e independe da ordem retornada pelo banco", () => {
    const m = matricula();
    m.cobrancas[0].valorOriginal = new Prisma.Decimal("123.45");
    const outro = matricula({ id: "matricula-2", cobrancas: [cobranca("taxa", { tipo: "MATRICULA", matriculaId: "matricula-2" })] });
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [outro, m], manter, hoje, FUSO_SERVIDOR);
    expect(snapshot.matriculas[0].cobrancas[0]).toMatchObject({ valorOriginal: "123.45", valorRecebido: "23.40", saldo: "100.05" });
    expect(snapshot.matriculas[1].cobrancas[0].tipo).toBe("MATRICULA");
    expect(estadoFinanceiroRetomada([m, outro])).toEqual(snapshot.matriculas);
    m.cobrancas.reverse();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m, outro])).not.toThrow();
  });

  it("MANTER aceita vencimentos antigos sem alterar a fonte; REPROGRAMAR troca só as datas propostas", () => {
    const m = matricula();
    const antes = estadoFinanceiroRetomada([m]);
    const mantido = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje, FUSO_SERVIDOR);
    expect(mantido.alvos[0].novoVencimento).toBe(m.cobrancas[0].vencimento.toISOString());
    const novosVencimentos = m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-09-08" }));
    const reprogramado = montarSnapshotRetomada("aluno", pausaId, [m], { ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos }, hoje, FUSO_SERVIDOR);
    expect(reprogramado.alvos.every((p) => new Date(p.novoVencimento).getDate() === 8)).toBe(true);
    expect(reprogramado.matriculas).toEqual(antes);
    expect(estadoFinanceiroRetomada([m])).toEqual(antes);
  });

  it("reprogramação exige exatamente o conjunto elegível, sem omissões, taxa ou IDs duplicados", () => {
    const m = matricula();
    const novos = m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-10-20" }));
    for (const novosVencimentos of [[], novos.slice(0, 1), [...novos, novos[0]], [...novos, { cobrancaId: "taxa-ou-estrangeira", vencimento: "2026-10-20" }]]) {
      expect(() => montarSnapshotRetomada("aluno", pausaId, [m], { ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos }, hoje, FUSO_SERVIDOR)).toThrow(/mensalidade|cobrança/i);
    }
  });

  it("rejeita data retroativa na proposta e revalida quando o tempo passa até a aprovação", () => {
    const m = matricula();
    const input = { ...manter, opcao: "REPROGRAMAR_PARCELAS" as const, novosVencimentos: m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-09-07" })) };
    expect(() => montarSnapshotRetomada("aluno", pausaId, [m], input, hoje, FUSO_SERVIDOR)).toThrow(/passadas/i);
    input.novosVencimentos.forEach((p) => { p.vencimento = "2026-09-08"; });
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], input, hoje, FUSO_SERVIDOR);
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, hoje, FUSO_SERVIDOR)).not.toThrow();
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, new Date(2026, 8, 9, 1), FUSO_SERVIDOR)).toThrow(/passadas/i);
  });

  it.each([
    ["recebimento parcial", (m: MatriculaRetomadaFonte) => { m.cobrancas[0].valorRecebido = "50.00"; m.cobrancas[0].saldo = "73.45"; }],
    ["ajuste negociado", (m: MatriculaRetomadaFonte) => { m.cobrancas[0].valorNegociado = "100.00"; }],
    ["parcela adicionada", (m: MatriculaRetomadaFonte) => { m.cobrancas.push(cobranca("nova")); }],
    ["parcela removida", (m: MatriculaRetomadaFonte) => { m.cobrancas.pop(); }],
    ["vencimento alterado", (m: MatriculaRetomadaFonte) => { m.cobrancas[0].vencimento = new Date(2026, 11, 1, 12); }],
    ["versão alterada", (m: MatriculaRetomadaFonte) => { m.cobrancas[0].versao += 1; }],
    ["ciclo da régua alterado", (m: MatriculaRetomadaFonte) => { m.cobrancas[0].cicloRegua += 1; }],
    ["matrícula encerrada", (m: MatriculaRetomadaFonte) => { m.status = "ENCERRADA"; }],
    ["duração alterada", (m: MatriculaRetomadaFonte) => { m.mesesPlano += 1; }],
    ["origem do cancelamento alterada", (m: MatriculaRetomadaFonte) => { m.cobrancas[1].canceladaPorPausaId = "outra-pausa"; }],
  ] as const)("invalida o snapshot após %s", (_nome, alterar) => {
    const m = matricula();
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje, FUSO_SERVIDOR);
    alterar(m);
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m])).toThrow(/mudou/i);
  });

  it("invalida aluno, pausa, conjunto de matrículas ou conjunto de alvos diferente", () => {
    const m = matricula();
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje, FUSO_SERVIDOR);
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "outro-aluno", pausaId, [m])).toThrow();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", "nova-pausa", [m])).toThrow();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m, matricula({ id: "nova-matricula" })])).toThrow();
    snapshot.alvos.pop();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m])).toThrow(/parcelas/i);
  });
});

// Q176 (#164): "hoje" da retomada é o dia civil da escola, não o do servidor (UTC em produção). Na Costa Rica (−06),
// às 04:30Z de 09/09/2026 ainda são 22h30 de 08/09: a data mínima é 08/09 e uma parcela para 08/09 não é retroativa.
describe("retomada no dia civil da escola", () => {
  const fuso = "America/Costa_Rica";
  const agora = new Date("2026-09-09T04:30:00Z");
  it("data mínima da reprogramação é o dia da escola", () => {
    expect(dataMinimaReprogramacao(agora, fuso)).toBe("2026-09-08");
    expect(dataMinimaReprogramacao(new Date("2026-09-09T06:00:00Z"), fuso)).toBe("2026-09-09");
  });
  it("aceita o dia de hoje da escola e recusa a véspera", () => {
    const m = matricula();
    const input = (vencimento: string) => ({ ...manter, opcao: "REPROGRAMAR_PARCELAS" as const, novosVencimentos: m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento })) });
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], input("2026-09-08"), agora, fuso);
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, agora, fuso)).not.toThrow();
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, new Date("2026-09-09T06:00:00Z"), fuso)).toThrow(/passadas/i);
    expect(() => montarSnapshotRetomada("aluno", pausaId, [m], input("2026-09-07"), agora, fuso)).toThrow(/passadas/i);
  });
});

// Ref. #247: a data digitada na reprogramação vira o meio-dia da ESCOLA; propostas antigas, gravadas ao meio-dia do
// relógio do servidor (UTC em produção), continuam lidas no mesmo dia civil.
describe("datas digitadas da retomada no fuso da escola", () => {
  const fuso = "America/Costa_Rica";
  const agora = new Date("2026-09-09T04:30:00Z"); // 08/09, 22h30 na Costa Rica
  it("grava o meio-dia da escola, qualquer que seja o fuso do servidor", () => {
    const m = matricula();
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], { ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos: m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-09-08" })) }, agora, fuso);
    expect(snapshot.alvos.map((p) => p.novoVencimento)).toEqual(m.cobrancas.map(() => "2026-09-08T18:00:00.000Z"));
  });
  it("proposta antiga ao meio-dia UTC do servidor continua no mesmo dia (não vira retroativa)", () => {
    const antiga = [{ cobrancaId: "c", novoVencimento: "2026-09-08T12:00:00.000Z" }];
    expect(() => validarDatasNaoRetroativas(antiga, agora, fuso)).not.toThrow();
    expect(() => validarDatasNaoRetroativas(antiga, new Date("2026-09-09T06:00:00Z"), fuso)).toThrow(/passadas/i);
  });
});
