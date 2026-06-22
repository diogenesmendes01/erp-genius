import { describe, it, expect } from "vitest";
import { EtapaLead } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  aplicarBaixa,
  diffCampos,
  vagasDisponiveis,
  temVaga,
} from "./regras";

describe("calcularComissao", () => {
  it("é a porcentagem da taxa", () => {
    expect(calcularComissao(299, 20)).toBeCloseTo(59.8);
    expect(calcularComissao(20000, 20)).toBe(4000);
    expect(calcularComissao(1000, 0)).toBe(0);
  });
});

describe("vencimentoMensalidade", () => {
  const base = new Date(2026, 5, 18); // junho/2026

  it("usa o dia escolhido no mês atual (offset 0)", () => {
    const { data, competencia } = vencimentoMensalidade(5, 0, base);
    expect(data.getDate()).toBe(5);
    expect(competencia).toBe("2026-06");
  });

  it("avança meses com o offset (vira o ano)", () => {
    expect(vencimentoMensalidade(10, 1, base).competencia).toBe("2026-07");
    expect(vencimentoMensalidade(10, 7, base).competencia).toBe("2027-01");
  });
});

describe("ehEtapaManual", () => {
  it("aceita etapas do funil normal", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(true);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
  });
});

describe("aplicarBaixa (pagamento parcial — issue #1)", () => {
  it("baixa total quita a cobrança", () => {
    const r = aplicarBaixa(100, null, 100);
    expect(r.recebidoTotal).toBe(100);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
  });

  it("baixa parcial deixa saldo e não quita", () => {
    const r = aplicarBaixa(100, null, 40);
    expect(r.recebidoTotal).toBe(40);
    expect(r.saldo).toBe(60);
    expect(r.quitada).toBe(false);
  });

  it("ACUMULA baixas parciais — a 2ª baixa nunca reduz o recebido", () => {
    const primeira = aplicarBaixa(100, null, 40); // recebe 40 → saldo 60
    expect(primeira.recebidoTotal).toBe(40);
    // segunda baixa de 30 deve SOMAR (70), não sobrescrever (30)
    const segunda = aplicarBaixa(100, primeira.recebidoTotal, 30);
    expect(segunda.recebidoTotal).toBe(70);
    expect(segunda.saldo).toBe(30);
    expect(segunda.quitada).toBe(false);
  });

  it("baixas parciais sucessivas quitam quando somam o negociado", () => {
    const a = aplicarBaixa(100, null, 60);
    const b = aplicarBaixa(100, a.recebidoTotal, 40);
    expect(b.recebidoTotal).toBe(100);
    expect(b.saldo).toBe(0);
    expect(b.quitada).toBe(true);
  });

  it("recebimento acima do negociado quita e zera o saldo (não fica negativo)", () => {
    const r = aplicarBaixa(100, 80, 50); // total 130 > 100
    expect(r.recebidoTotal).toBe(130);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
  });
});

describe("vagasDisponiveis / temVaga (contagem de vagas — issue #1)", () => {
  it("desconta da capacidade APENAS as alocações ativas informadas", () => {
    // 16 de capacidade, 10 ativas → 6 vagas (inativas não entram nesta contagem).
    expect(vagasDisponiveis(16, 10)).toBe(6);
    expect(temVaga(16, 10)).toBe(true);
  });

  it("turma cheia não tem vaga", () => {
    expect(vagasDisponiveis(16, 16)).toBe(0);
    expect(temVaga(16, 16)).toBe(false);
  });

  it("nunca devolve vagas negativas", () => {
    expect(vagasDisponiveis(16, 20)).toBe(0);
    expect(temVaga(16, 20)).toBe(false);
  });

  it("contar inativas (bug) inflaria o ocupado e tiraria vaga indevidamente", () => {
    // 16 cap, 6 ativas + 4 inativas. Correto: conta só as 6 ativas → 10 vagas.
    const ativas = 6;
    const todas = 10; // 6 ativas + 4 inativas (o jeito ERRADO)
    expect(vagasDisponiveis(16, ativas)).toBe(10);
    expect(vagasDisponiveis(16, todas)).toBe(6); // o que o bug produziria
  });
});

describe("diffCampos (auditoria enxuta — issue #1)", () => {
  it("inclui só os campos que mudaram", () => {
    const { antes, depois } = diffCampos(
      { interesse: "A", objetivo: null },
      { interesse: "B", objetivo: null },
    );
    expect(antes).toEqual({ interesse: "A" });
    expect(depois).toEqual({ interesse: "B" });
  });

  it("devolve mapas vazios quando nada muda", () => {
    const { antes, depois } = diffCampos({ x: 1, y: 2 }, { x: 1, y: 2 });
    expect(antes).toEqual({});
    expect(depois).toEqual({});
  });
});
