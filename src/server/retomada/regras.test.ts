import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { dataRetomada, DecidirRetomadaSchema, SolicitarRetomadaSchema } from "./schema";
import {
  estadoFinanceiroRetomada, exigirSnapshotRetomadaAtual, impedimentoRetomada,
  montarSnapshotRetomada, parcelasElegiveisRetomada, validarDatasNaoRetroativas,
  type CobrancaRetomadaFonte, type MatriculaRetomadaFonte,
} from "./regras";

const hoje = new Date(2026, 8, 8, 16);
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
    expect(dataRetomada(valor)).toBeNull();
    expect(SolicitarRetomadaSchema.safeParse({ ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos: [{ cobrancaId: "c", vencimento: valor }] }).success).toBe(false);
  });

  it("aceita dia bissexto real e mantém o dia de calendário local", () => {
    const data = dataRetomada("2028-02-29")!;
    expect([data.getFullYear(), data.getMonth(), data.getDate()]).toEqual([2028, 1, 29]);
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
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [outro, m], manter, hoje);
    expect(snapshot.matriculas[0].cobrancas[0]).toMatchObject({ valorOriginal: "123.45", valorRecebido: "23.40", saldo: "100.05" });
    expect(snapshot.matriculas[1].cobrancas[0].tipo).toBe("MATRICULA");
    expect(estadoFinanceiroRetomada([m, outro])).toEqual(snapshot.matriculas);
    m.cobrancas.reverse();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m, outro])).not.toThrow();
  });

  it("MANTER aceita vencimentos antigos sem alterar a fonte; REPROGRAMAR troca só as datas propostas", () => {
    const m = matricula();
    const antes = estadoFinanceiroRetomada([m]);
    const mantido = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje);
    expect(mantido.alvos[0].novoVencimento).toBe(m.cobrancas[0].vencimento.toISOString());
    const novosVencimentos = m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-09-08" }));
    const reprogramado = montarSnapshotRetomada("aluno", pausaId, [m], { ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos }, hoje);
    expect(reprogramado.alvos.every((p) => new Date(p.novoVencimento).getDate() === 8)).toBe(true);
    expect(reprogramado.matriculas).toEqual(antes);
    expect(estadoFinanceiroRetomada([m])).toEqual(antes);
  });

  it("reprogramação exige exatamente o conjunto elegível, sem omissões, taxa ou IDs duplicados", () => {
    const m = matricula();
    const novos = m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-10-20" }));
    for (const novosVencimentos of [[], novos.slice(0, 1), [...novos, novos[0]], [...novos, { cobrancaId: "taxa-ou-estrangeira", vencimento: "2026-10-20" }]]) {
      expect(() => montarSnapshotRetomada("aluno", pausaId, [m], { ...manter, opcao: "REPROGRAMAR_PARCELAS", novosVencimentos }, hoje)).toThrow(/mensalidade|cobrança/i);
    }
  });

  it("rejeita data retroativa na proposta e revalida quando o tempo passa até a aprovação", () => {
    const m = matricula();
    const input = { ...manter, opcao: "REPROGRAMAR_PARCELAS" as const, novosVencimentos: m.cobrancas.map((c) => ({ cobrancaId: c.id, vencimento: "2026-09-07" })) };
    expect(() => montarSnapshotRetomada("aluno", pausaId, [m], input, hoje)).toThrow(/passadas/i);
    input.novosVencimentos.forEach((p) => { p.vencimento = "2026-09-08"; });
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], input, hoje);
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, hoje)).not.toThrow();
    expect(() => validarDatasNaoRetroativas(snapshot.alvos, new Date(2026, 8, 9, 1))).toThrow(/passadas/i);
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
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje);
    alterar(m);
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m])).toThrow(/mudou/i);
  });

  it("invalida aluno, pausa, conjunto de matrículas ou conjunto de alvos diferente", () => {
    const m = matricula();
    const snapshot = montarSnapshotRetomada("aluno", pausaId, [m], manter, hoje);
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "outro-aluno", pausaId, [m])).toThrow();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", "nova-pausa", [m])).toThrow();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m, matricula({ id: "nova-matricula" })])).toThrow();
    snapshot.alvos.pop();
    expect(() => exigirSnapshotRetomadaAtual(snapshot, "aluno", pausaId, [m])).toThrow(/parcelas/i);
  });
});
