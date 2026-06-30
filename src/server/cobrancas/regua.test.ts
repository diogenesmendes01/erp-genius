import { describe, it, expect } from "vitest";
import { proximaAcao, diferencaEmDias, REGUA, type EntradaRegua, type PassoRegua } from "./regua";

// Vencimento de referência fixo para todos os cenários.
const VENC = new Date(2026, 5, 23); // 2026-06-23
const d = (ano: number, mes1a12: number, dia: number) => new Date(ano, mes1a12 - 1, dia);

function entrada(over: Partial<EntradaRegua> = {}): EntradaRegua {
  return { vencimento: VENC, quitada: false, passosFeitos: [], promessaAte: null, ...over };
}
const TODOS_ATE = (passo: PassoRegua): PassoRegua[] => {
  const idx = REGUA.findIndex((x) => x.passo === passo);
  return REGUA.slice(0, idx).map((x) => x.passo); // todos ANTES do passo informado
};

describe("regua — diferencaEmDias (dias de calendário, ignora hora)", () => {
  it("conta dias de calendário independentemente da hora", () => {
    expect(diferencaEmDias(d(2026, 6, 23), d(2026, 6, 23))).toBe(0);
    expect(diferencaEmDias(d(2026, 6, 30), d(2026, 6, 23))).toBe(7);
    expect(diferencaEmDias(d(2026, 6, 16), d(2026, 6, 23))).toBe(-7);
    const manha = new Date(2026, 5, 23, 8, 0, 0);
    const noite = new Date(2026, 5, 23, 23, 30, 0);
    expect(diferencaEmDias(noite, manha)).toBe(0);
  });
});

describe("regua — proximaAcao por degrau (caminho feliz)", () => {
  it("D-7: lembrete no dia (7 dias antes), template amigável", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 16));
    expect(r.estado).toBe("acao_devida");
    expect(r.degrau?.passo).toBe("D-7");
    expect(r.degrau?.tipo).toBe("lembrar");
    expect(r.degrau?.template).toBe("amigavel");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D-3: com D-7 já feito", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 20));
    expect(r.degrau?.passo).toBe("D-3");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D0: cobrança no vencimento (D-7/D-3 feitos)", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7", "D-3"] }), VENC);
    expect(r.degrau?.passo).toBe("D0");
    expect(r.degrau?.tipo).toBe("cobrar");
    expect(r.diasAtraso).toBe(0);
  });

  it("D+3: cobrança de atraso, template vencida", () => {
    const r = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+3") }), d(2026, 6, 26));
    expect(r.degrau?.passo).toBe("D+3");
    expect(r.degrau?.template).toBe("vencida");
    expect(r.atrasadaNaAcao).toBe(false);
  });

  it("D+15: bloqueio, tipo bloquear, template firme", () => {
    const r = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+15") }), d(2026, 7, 8));
    expect(r.degrau?.passo).toBe("D+15");
    expect(r.degrau?.tipo).toBe("bloquear");
    expect(r.degrau?.template).toBe("firme");
  });
});

describe("regua — BACKLOG (dias pulados não somem)", () => {
  it("D-7 não enviado e a data já passou → continua devido, marcado atrasado na ação", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 18)); // offset -5, nada feito
    expect(r.degrau?.passo).toBe("D-7");
    expect(r.atrasadaNaAcao).toBe(true);
  });

  it("o degrau mais avançado que chegou vence os anteriores não cumpridos", () => {
    // hoje = D+5 (entre D+3 e D+7), nada feito → ação é D+3 (mais avançado que chegou), atrasado
    const r = proximaAcao(entrada(), d(2026, 6, 28));
    expect(r.degrau?.passo).toBe("D+3");
    expect(r.atrasadaNaAcao).toBe(true);
  });

  it("se o degrau atual foi feito mas o próximo ainda não chegou → futuro", () => {
    const r = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 18)); // D-7 feito, D-3 ainda longe
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });
});

describe("regua — estados especiais", () => {
  it("quitada (paga/cancelada) sai da régua", () => {
    const r = proximaAcao(entrada({ quitada: true }), d(2026, 7, 8));
    expect(r.estado).toBe("quitada");
    expect(r.degrau).toBeNull();
  });

  it("promessa vigente deixa a cobrança dormente", () => {
    const r = proximaAcao(entrada({ promessaAte: d(2026, 7, 1) }), d(2026, 6, 26));
    expect(r.estado).toBe("promessa");
    expect(r.degrau).toBeNull();
    expect(r.promessaAte).toEqual(d(2026, 7, 1));
  });

  it("promessa vencida é ignorada — volta a cobrar normalmente", () => {
    const r = proximaAcao(entrada({ promessaAte: d(2026, 6, 20) }), d(2026, 6, 26));
    expect(r.estado).toBe("acao_devida");
    expect(r.degrau?.passo).toBe("D+3"); // offset +3, mais avançado que chegou, nada feito
  });

  it("futuro: antes do primeiro degrau (D-7) não há ação", () => {
    const r = proximaAcao(entrada(), d(2026, 6, 10)); // offset -13
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });

  it("concluida: todos os degraus cumpridos", () => {
    const todos = REGUA.map((x) => x.passo);
    const r = proximaAcao(entrada({ passosFeitos: todos }), d(2026, 7, 10));
    expect(r.estado).toBe("concluida");
    expect(r.degrau).toBeNull();
  });
});

describe("regua — prioridade (menor = mais urgente)", () => {
  it("bloquear < cobrar < lembrar, e mais atraso é mais urgente", () => {
    const bloq = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+15") }), d(2026, 7, 8));
    const cobrarD7 = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+7") }), d(2026, 6, 30));
    const cobrarD3 = proximaAcao(entrada({ passosFeitos: TODOS_ATE("D+3") }), d(2026, 6, 26));
    const lembrarD3 = proximaAcao(entrada({ passosFeitos: ["D-7"] }), d(2026, 6, 20));
    expect(bloq.prioridade).toBeLessThan(cobrarD7.prioridade);
    expect(cobrarD7.prioridade).toBeLessThan(cobrarD3.prioridade);
    expect(cobrarD3.prioridade).toBeLessThan(lembrarD3.prioridade);
  });
});
