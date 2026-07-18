import { describe, it, expect } from "vitest";
import { proximaAcao, proximaAcaoAncora, selecionarDegrau, REGUA, type DegrauAncora } from "./regua";

// Motor generalizado por âncora (doc 27 §Tese · doc 29 regra 1). A régua "lead novo sem
// resposta" (doc 08: D0·+30min·+4h·+24h·+3d·+7d) usa o MESMO núcleo da cobrança, em MINUTOS.

// Cadência da doc 08 em minutos.
const CADENCIA: DegrauAncora[] = [
  { passo: "D0", offsetMinutos: 0 },
  { passo: "+30min", offsetMinutos: 30 },
  { passo: "+4h", offsetMinutos: 240 },
  { passo: "+24h", offsetMinutos: 1440 },
  { passo: "+3d", offsetMinutos: 4320 },
  { passo: "+7d", offsetMinutos: 10080 },
];

const ANCORA = new Date(2026, 6, 18, 9, 0, 0); // referência fixa (determinístico)
const maisMin = (min: number) => new Date(ANCORA.getTime() + min * 60_000);

describe("proximaAcaoAncora — régua ancorada em evento (minutos)", () => {
  it("encerrada (lead respondeu/mudou etapa/opt-out) → sai da régua", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: true, passosFeitos: [] }, maisMin(500), CADENCIA);
    expect(r.estado).toBe("encerrada");
    expect(r.passo).toBeNull();
  });

  it("no ponto da âncora, nada feito → D0 devido", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: [] }, ANCORA, CADENCIA);
    expect(r.estado).toBe("acao_devida");
    expect(r.passo).toBe("D0");
    expect(r.atrasada).toBe(false); // no ponto exato
    expect(r.minutosDesdeAncora).toBe(0);
  });

  it("45min depois, D0 feito → +30min devido e ATRASADO (já passou dos 30)", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0"] }, maisMin(45), CADENCIA);
    expect(r.passo).toBe("+30min");
    expect(r.atrasada).toBe(true);
    expect(r.minutosDesdeAncora).toBe(45);
  });

  it("45min depois, NADA feito → pula direto pro +30min (D0 superado, não metralha)", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: [] }, maisMin(45), CADENCIA);
    expect(r.passo).toBe("+30min"); // o mais avançado que já chegou
  });

  it("10min depois, D0 feito → futuro (o +30min ainda não chegou)", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0"] }, maisMin(10), CADENCIA);
    expect(r.estado).toBe("futuro");
    expect(r.passo).toBeNull();
  });

  it("8 dias depois, todos feitos → concluída", () => {
    const feitos = CADENCIA.map((d) => d.passo);
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: feitos }, maisMin(11520), CADENCIA);
    expect(r.estado).toBe("concluida");
    expect(r.passo).toBeNull();
  });

  it("8 dias depois, nada feito → +7d devido (backlog nunca some)", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: [] }, maisMin(11520), CADENCIA);
    expect(r.passo).toBe("+7d");
    expect(r.atrasada).toBe(true);
  });

  it("granularidade de MINUTOS: +4h (240min) arma aos 240, não aos 239", () => {
    // Aos 239min, com D0 e +30min já feitos, os degraus que chegaram estão cumpridos → futuro.
    const antes = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0", "+30min"] }, maisMin(239), CADENCIA);
    expect(antes.estado).toBe("futuro");
    expect(antes.passo).toBeNull();
    // Aos 240min o +4h chega e vira devido — a granularidade é de MINUTO, não de dia.
    const noPonto = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0", "+30min"] }, maisMin(240), CADENCIA);
    expect(noPonto.passo).toBe("+4h");
    expect(noPonto.atrasada).toBe(false);
  });
});

describe("selecionarDegrau — núcleo genérico compartilhado com a cobrança", () => {
  const feitos = new Set<string>();
  const degraus = [
    { offset: 0, chave: "a" },
    { offset: 10, chave: "b" },
    { offset: 20, chave: "c" },
  ];

  it("escolhe o mais avançado que chegou e não foi feito", () => {
    expect(selecionarDegrau(15, degraus, feitos).degrau?.chave).toBe("b");
    expect(selecionarDegrau(25, degraus, feitos).degrau?.chave).toBe("c");
  });

  it("posição antes do 1º offset → futuro", () => {
    expect(selecionarDegrau(-5, degraus, feitos).estado).toBe("futuro");
  });

  it("todos feitos após o último offset → concluída", () => {
    expect(selecionarDegrau(30, degraus, new Set(["a", "b", "c"])).estado).toBe("concluida");
  });

  it("política vazia nunca conclui nem arma", () => {
    expect(selecionarDegrau(100, [], feitos).estado).toBe("futuro");
  });

  it("corte de progresso: feito um degrau do meio, os anteriores nunca mais armam", () => {
    // "c" (offset 20) feito, posição 25: "a"/"b" (offset 0/10) estão ATRÁS do corte.
    const r = selecionarDegrau(25, degraus, new Set(["c"]));
    expect(r.estado).toBe("concluida");
    expect(r.degrau).toBeNull();
  });
});

// O bug que o review do PR #54 pegou: selecionar o passo mais avançado → registrá-lo como
// feito → recalcular NÃO pode voltar e disparar o backlog em ordem reversa. Vale nos DOIS
// wrappers (mesmo núcleo): comercial (minutos) e cobrança (dias).
describe("corte de progresso forward-only (review PR #54)", () => {
  it("âncora: enviado o +30min, o recálculo NÃO volta pro D0", () => {
    const p1 = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: [] }, maisMin(45), CADENCIA);
    expect(p1.passo).toBe("+30min"); // pula o D0 (superado)
    const p2 = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["+30min"] }, maisMin(45), CADENCIA);
    expect(p2.estado).toBe("futuro"); // e NÃO volta pro D0
    expect(p2.passo).toBeNull();
  });

  it("âncora: cadência executada em ordem nunca retrocede", () => {
    // aos 300min (5h): D0/+30min/+4h já chegaram. Feitos D0 e +30min → devido é +4h, não D0.
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0", "+30min"] }, maisMin(300), CADENCIA);
    expect(r.passo).toBe("+4h");
  });

  it("cobrança: enviado o D+3 num backlog, o recálculo NÃO volta pro D0/D-7", () => {
    const hoje = new Date(2026, 6, 18);
    const vencimento = new Date(2026, 6, 13); // diasAtraso = 5
    // Sem nada feito, o backlog escolhe o mais avançado que chegou (D+3, offset 3 ≤ 5).
    const p1 = proximaAcao({ vencimento, quitada: false, passosFeitos: [] }, hoje);
    expect(p1.degrau?.passo).toBe("D+3");
    // Feito o D+3, recalcular: D0/D-3/D-7 estão ATRÁS do corte → nada devido (D+7 só aos 7).
    const p2 = proximaAcao({ vencimento, quitada: false, passosFeitos: ["D+3"] }, hoje);
    expect(p2.estado).toBe("futuro");
    expect(p2.degrau).toBeNull();
  });

  it("cobrança: régua feita em ordem completa → concluída (contra-prova, comportamento preservado)", () => {
    const hoje = new Date(2026, 6, 18);
    const vencimento = new Date(2026, 6, 3); // diasAtraso = 15 (D+15)
    const todos = REGUA.map((d) => d.passo);
    const r = proximaAcao({ vencimento, quitada: false, passosFeitos: todos }, hoje);
    expect(r.estado).toBe("concluida");
  });
});
