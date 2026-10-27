import { describe, it, expect } from "vitest";
import { proximaAcao, proximaAcaoAncora, selecionarDegrau, REGUA, type DegrauAncora } from "./regua";

const FUSO = "America/Sao_Paulo";
const diaEscola = (ano: number, mes0a11: number, dia: number) => new Date(Date.UTC(ano, mes0a11, dia, 15));

const CADENCIA: DegrauAncora[] = [
  { passo: "D0", offsetMinutos: 0 },
  { passo: "+30min", offsetMinutos: 30 },
  { passo: "+4h", offsetMinutos: 240 },
  { passo: "+24h", offsetMinutos: 1440 },
  { passo: "+3d", offsetMinutos: 4320 },
  { passo: "+7d", offsetMinutos: 10080 },
];

const ANCORA = new Date(2026, 6, 18, 9, 0, 0);
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
    expect(r.atrasada).toBe(false);
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
    expect(r.passo).toBe("+30min");
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
    const antes = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0", "+30min"] }, maisMin(239), CADENCIA);
    expect(antes.estado).toBe("futuro");
    expect(antes.passo).toBeNull();
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
    const r = selecionarDegrau(25, degraus, new Set(["c"]));
    expect(r.estado).toBe("concluida");
    expect(r.degrau).toBeNull();
  });
});

describe("corte de progresso forward-only (review PR #54)", () => {
  it("âncora: enviado o +30min, o recálculo NÃO volta pro D0", () => {
    const p1 = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: [] }, maisMin(45), CADENCIA);
    expect(p1.passo).toBe("+30min");
    const p2 = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["+30min"] }, maisMin(45), CADENCIA);
    expect(p2.estado).toBe("futuro");
    expect(p2.passo).toBeNull();
  });

  it("âncora: cadência executada em ordem nunca retrocede", () => {
    const r = proximaAcaoAncora({ ancoraEm: ANCORA, encerrada: false, passosFeitos: ["D0", "+30min"] }, maisMin(300), CADENCIA);
    expect(r.passo).toBe("+4h");
  });

  it("cobrança: enviado o D+3 num backlog, o recálculo NÃO volta pro D0/D-7", () => {
    const hoje = diaEscola(2026, 6, 18);
    const vencimento = diaEscola(2026, 6, 13);
    const p1 = proximaAcao({ vencimento, quitada: false, passosFeitos: [] }, hoje, FUSO);
    expect(p1.degrau?.passo).toBe("D+3");
    const p2 = proximaAcao({ vencimento, quitada: false, passosFeitos: ["D+3"] }, hoje, FUSO);
    expect(p2.estado).toBe("futuro");
    expect(p2.degrau).toBeNull();
  });

  it("cobrança: régua feita em ordem completa → concluída (contra-prova, comportamento preservado)", () => {
    const hoje = diaEscola(2026, 6, 18);
    const vencimento = diaEscola(2026, 6, 3);
    const todos = REGUA.map((d) => d.passo);
    const r = proximaAcao({ vencimento, quitada: false, passosFeitos: todos }, hoje, FUSO);
    expect(r.estado).toBe("concluida");
  });
});

describe("corte de progresso sobrevive à edição da política (review PR #54, 2ª passada)", () => {
  const hoje = diaEscola(2026, 6, 18);
  const vencimento = diaEscola(2026, 6, 13);

  it("cobrança: D+3 feito e depois REMOVIDO/desativado da política → NÃO volta pro D0", () => {
    const politicaSemD3 = REGUA.filter((d) => d.passo !== "D+3");
    const r = proximaAcao({ vencimento, quitada: false, passosFeitos: ["D+3"] }, hoje, FUSO, politicaSemD3);
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });

  it("cobrança: D+3 feito e depois RE-OFFSETADO para -10 → NÃO volta pro D0", () => {
    const politicaEditada = [
      { ...REGUA[3], offsetDias: -10 },
      ...REGUA.filter((d) => d.passo !== "D+3"),
    ];
    const r = proximaAcao({ vencimento, quitada: false, passosFeitos: ["D+3"] }, hoje, FUSO, politicaEditada);
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });

  it("cobrança: com o degrau removido, a régua segue PARA FRENTE quando o próximo chega", () => {
    const politicaSemD3 = REGUA.filter((d) => d.passo !== "D+3");
    const em7dias = diaEscola(2026, 6, 20);
    const r = proximaAcao({ vencimento, quitada: false, passosFeitos: ["D+3"] }, em7dias, FUSO, politicaSemD3);
    expect(r.degrau?.passo).toBe("D+7");
  });

  it("âncora com ordem imutável: passo feito removido da cadência → não retrocede", () => {
    const ordem = CADENCIA.map((d) => d.passo);
    const cadenciaSem30 = CADENCIA.filter((d) => d.passo !== "+30min");
    const r = proximaAcaoAncora(
      { ancoraEm: ANCORA, encerrada: false, passosFeitos: ["+30min"] },
      maisMin(45),
      cadenciaSem30,
      ordem,
    );
    expect(r.estado).toBe("futuro");
    expect(r.passo).toBeNull();
  });

  it("núcleo: feito ausente dos degraus atuais mas presente na ordem segura o corte", () => {
    const degraus = [
      { offset: 0, chave: "a" },
      { offset: 20, chave: "c" },
    ];
    const r = selecionarDegrau(5, degraus, new Set(["b"]), ["a", "b", "c"]);
    expect(r.estado).toBe("futuro");
    expect(r.degrau).toBeNull();
  });
});
