import { describe, it, expect } from "vitest";
import { proximaAcao, diaCivilGravado, diasCivisDesde, promessaNoPassado, REGUA, type EntradaRegua, type PassoRegua } from "./regua";

// Q176: o dia da régua vira no fuso da escola. Os cenários usam instantes fixos (meio-dia de
// Brasília = 15h UTC), e não o relógio local do processo, para valer com TZ=UTC e America/Sao_Paulo.
const FUSO = "America/Sao_Paulo";
const d = (ano: number, mes1a12: number, dia: number) => new Date(Date.UTC(ano, mes1a12 - 1, dia, 15));
// Vencimento de referência fixo para todos os cenários.
const VENC = d(2026, 6, 23); // 2026-06-23, gravado ao meio-dia da escola

function entrada(over: Partial<EntradaRegua> = {}): EntradaRegua {
  return { vencimento: VENC, quitada: false, passosFeitos: [], promessaAte: null, ...over };
}
const TODOS_ATE = (passo: PassoRegua): PassoRegua[] => {
  const idx = REGUA.findIndex((x) => x.passo === passo);
  return REGUA.slice(0, idx).map((x) => x.passo); // todos ANTES do passo informado
};

describe("regua — diasCivisDesde (dias de calendário da escola, ignora hora)", () => {
  it("conta dias de calendário independentemente da hora", () => {
    expect(diasCivisDesde(d(2026, 6, 23), VENC, FUSO)).toBe(0);
    expect(diasCivisDesde(d(2026, 6, 30), VENC, FUSO)).toBe(7);
    expect(diasCivisDesde(d(2026, 6, 16), VENC, FUSO)).toBe(-7);
    const manha = new Date("2026-06-23T11:00:00Z"); // 08h em Brasília
    const noite = new Date("2026-06-24T02:30:00Z"); // 23h30 em Brasília, ainda dia 23
    expect(diasCivisDesde(noite, VENC, FUSO)).toBe(0);
    expect(diasCivisDesde(manha, VENC, FUSO)).toBe(0);
  });
});

describe("Q176 — o dia da régua vira à meia-noite da escola, não do servidor", () => {
  // 23h30 de 22/06 em Brasília = 02h30 UTC de 23/06: o servidor em UTC já está no dia do vencimento.
  const vespera2330 = new Date("2026-06-23T02:30:00Z");
  const dia0030 = new Date("2026-06-23T03:30:00Z"); // 00h30 de 23/06 em Brasília

  it("recupera o dia civil nas três convenções de gravação do vencimento", () => {
    expect(diaCivilGravado(new Date("2026-06-23T15:00:00Z"), FUSO)).toBe("2026-06-23"); // meio-dia da escola
    expect(diaCivilGravado(new Date("2026-06-23T03:00:00Z"), FUSO)).toBe("2026-06-23"); // meia-noite da escola
    expect(diaCivilGravado(new Date("2026-06-23T00:00:00Z"), FUSO)).toBe("2026-06-23"); // meia-noite UTC (legado)
    expect(diaCivilGravado(new Date("2026-06-22T21:00:00Z"), "Europe/Moscow")).toBe("2026-06-23"); // fuso positivo
  });

  it("às 23h30 de Brasília da véspera o D0 ainda não saiu; à 00h30 sai", () => {
    const feitos = entrada({ passosFeitos: ["D-7", "D-3"] });
    const vespera = proximaAcao(feitos, vespera2330, FUSO);
    expect(vespera.diasAtraso).toBe(-1);
    expect(vespera.estado).toBe("futuro");
    const noDia = proximaAcao(feitos, dia0030, FUSO);
    expect(noDia.diasAtraso).toBe(0);
    expect(noDia.degrau?.passo).toBe("D0");
  });

  it("o lembrete D-3 não sai na noite de D-4", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), new Date("2026-06-20T02:30:00Z"), FUSO); // 19/06, 23h30
    expect(r.diasAtraso).toBe(-4);
    expect(r.estado).toBe("futuro");
    expect(proximaAcao(entrada({ passosFeitos: ["D-7"] }), new Date("2026-06-20T03:30:00Z"), FUSO).degrau?.passo).toBe("D-3");
  });

  it("a promessa vale até o fim do dia prometido no fuso da escola", () => {
    const prometida = entrada({ promessaAte: d(2026, 6, 25) });
    expect(proximaAcao(prometida, new Date("2026-06-26T02:30:00Z"), FUSO).estado).toBe("promessa"); // 25/06, 23h30
    expect(proximaAcao(prometida, new Date("2026-06-26T03:30:00Z"), FUSO).estado).not.toBe("promessa"); // 26/06, 00h30
  });

  it("promessa para hoje não é passado às 23h30 de Brasília", () => {
    expect(promessaNoPassado("2026-06-22", vespera2330, FUSO)).toBe(false);
    expect(promessaNoPassado("2026-06-21", vespera2330, FUSO)).toBe(true);
    expect(promessaNoPassado("2026-06-22", dia0030, FUSO)).toBe(true);
  });
});

describe("regua — proximaAcao por degrau (caminho feliz)", () => {
  it("D-7: lembrete no dia (7 dias antes), template amigável", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 16), FUSO);
    expect(r.estado).toBe("acao_devida");
    expect(r.degrau?.passo).toBe("D-7");
    expect(r.degrau?.tipo).toBe("lembrar");
    expect(r.degrau?.template).toBe("amigavel");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D-3: com D-7 já feito", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 20), FUSO);
    expect(r.degrau?.passo).toBe("D-3");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D0: cobrança no vencimento (D-7/D-3 feitos)", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7", "D-3"] }), VENC, FUSO);
    expect(r.degrau?.passo).toBe("D0");
    expect(r.degrau?.tipo).toBe("cobrar");
    expect(r.diasAtraso).toBe(0);
  });

  it("D+3: cobrança de atraso, template vencida", () => {
    const r = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+3") }), d(2026, 6, 26), FUSO);
    expect(r.degrau?.passo).toBe("D+3");
    expect(r.degrau?.template).toBe("vencida");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D+15 mantém ID histórico como cobrança final; restrição é independente em D+30", () => {
    const r = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+15") }), d(2026, 7, 8), FUSO);
    expect(r.degrau?.passo).toBe("D+15");
    expect(r.degrau?.tipo).toBe("cobrar");
    expect(r.degrau?.template).toBe("firme");
  });
});

describe("regua — BACKLOG (dias pulados não somem)", () => {
  it("D-7 não enviado e a data já passou → continua devido, marcado atrasado na ação", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 18), FUSO); // offset -5, nada feito
    expect(r.degrau?.passo).toBe("D-7");
    expect(r.atrasadaNaAcao).toBe(true);
  });

  it("o degrau mais avançado que chegou vence os anteriores não cumpridos", () => {
    // hoje = D+5 (entre D+3 e D+7), nada feito → ação é D+3 (mais avançado que chegou), atrasado
    const r = proximaAcao(entrada(), d(2026, 6, 28), FUSO);
    expect(r.degrau?.passo).toBe("D+3");
    expect(r.atrasadaNaAcao).toBe(true);
  });

  it("se o degrau atual foi feito mas o próximo ainda não chegou → futuro", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 18), FUSO); // D-7 feito, D-3 ainda longe
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });
});

describe("regua — estados especiais", () => {
  it("quitada (paga/cancelada) sai da régua", () => {
    const r = proximaAcao(entrada({ quitada: true }), d(2026, 7, 8), FUSO);
    expect(r.estado).toBe("quitada");
    expect(r.degrau).toBeNull();
  });

  it("promessa vigente deixa a cobrança dormente", () => {
    const r = proximaAcao(entrada({ promessaAte: d(2026, 7, 1) }), d(2026, 6, 26), FUSO);
    expect(r.estado).toBe("promessa");
    expect(r.degrau).toBeNull();
    expect(r.promessaAte).toEqual(d(2026, 7, 1));
  });

  it("promessa vencida é ignorada — volta a cobrar normalmente", () => {
    const r = proximaAcao(entrada({ promessaAte: d(2026, 6, 20) }), d(2026, 6, 26), FUSO);
    expect(r.estado).toBe("acao_devida");
    expect(r.degrau?.passo).toBe("D+3"); // offset +3, mais avançado que chegou, nada feito
  });

  it("futuro: antes do primeiro degrau (D-7) não há ação", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 10), FUSO); // offset -13
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });

  it("concluida: todos os degraus cumpridos", () => {
    const todos = REGUA.map((x) => x.passo);
    const r = proximaAcao(entrada({ passosFeitos: todos }), d(2026, 7, 10), FUSO);
    expect(r.estado).toBe("concluida");
    expect(r.degrau).toBeNull();
  });
});

describe("regua — política como dado (doc 26/30: proximaAcao recebe os degraus)", () => {
  it("sem o parâmetro, usa a REGUA de fábrica (compatibilidade)", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 16), FUSO);
    expect(r.degrau?.passo).toBe("D-7");
  });

  it("política customizada muda offsets: D-3 configurado para -5 dias dispara no dia -5", () => {
    const politica = [
      { passo: "D-3", offsetDias: -5, tipo: "lembrar", template: "amigavel", rotulo: "Lembrete custom" },
      { passo: "D0", offsetDias: 0, tipo: "cobrar", template: "dados", rotulo: "No dia" },
    ] as const;
    const r = proximaAcao(entrada(), d(2026, 6, 18), FUSO, politica); // offset -5
    expect(r.estado).toBe("acao_devida");
    expect(r.degrau?.passo).toBe("D-3");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("degrau desativado (fora da política) nunca é devido — superação continua valendo", () => {
    // Política sem D-7/D-3: no dia do vencimento a ação é direto o D0.
    const politica = REGUA.filter((x) => x.offsetDias >= 0);
    const r = proximaAcao(entrada(), VENC, FUSO, politica);
    expect(r.degrau?.passo).toBe("D0");
    // E antes do vencimento não há nada devido (não existe degrau preventivo).
    const antes = proximaAcao(entrada(), d(2026, 6, 16), FUSO, politica);
    expect(antes.estado).toBe("futuro");
  });

  it("política vazia (tudo desativado) nunca gera ação nem conclusão", () => {
    const r = proximaAcao(entrada(), d(2026, 7, 20), FUSO, []);
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });

  it("passos feitos de degraus removidos da política não ressuscitam a ação (fatos históricos)", () => {
    // D-7 foi cumprido no passado; depois o admin removeu D-7 da política. Hoje é D-2:
    // com política sem preventivos, nada é devido — o histórico não quebra o cálculo.
    const politica = REGUA.filter((x) => x.offsetDias >= 0);
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 21), FUSO, politica);
    expect(r.estado).toBe("futuro");
  });

  it("conclusão respeita o último degrau DA POLÍTICA (não o da fábrica)", () => {
    // Política termina em D+7: cumprido tudo até D+7, aos 10 dias de atraso está concluída.
    const politica = REGUA.filter((x) => x.passo !== "D+15");
    const feitos = politica.map((x) => x.passo);
    const r = proximaAcao(entrada({ passosFeitos: feitos }), d(2026, 7, 3), FUSO, politica);
    expect(r.estado).toBe("concluida");
  });
});

describe("regua — prioridade (menor = mais urgente)", () => {
  it("cobrança final precede cobranças anteriores e lembretes", () => {
    const bloq = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+15") }), d(2026, 7, 8), FUSO);
    const cobrarD7 = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+7") }), d(2026, 6, 30), FUSO);
    const cobrarD3 = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+3") }), d(2026, 6, 26), FUSO);
    const lembrarD3 = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 20), FUSO);
    expect(bloq.prioridade).toBeLessThan(cobrarD7.prioridade);
    expect(cobrarD7.prioridade).toBeLessThan(cobrarD3.prioridade);
    expect(cobrarD3.prioridade).toBeLessThan(lembrarD3.prioridade);
  });
});
