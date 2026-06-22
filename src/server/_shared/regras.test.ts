import { describe, it, expect } from "vitest";
import { EtapaLead, Papel, TipoCobranca } from "@prisma/client";
import {
  calcularComissao,
  vencimentoMensalidade,
  ehEtapaManual,
  podeCheckinExperimental,
  professorNoEscopoExperimental,
  avaliarPrecoReferencia,
  acumularPagamento,
  chavePrecoReferencia,
  mesmaChavePreco,
  irmaosParaInativar,
  type ChavePreco,
  transicaoManualPermitida,
  podeAtribuirOutroDono,
  resolverDonoLead,
  aplicarBaixa,
  diffCampos,
  vagasDisponiveis,
  temVaga,
} from "./regras";
import { ErroRegra } from "./sessao";

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
  it("aceita as etapas que o vendedor controla por arraste", () => {
    expect(ehEtapaManual(EtapaLead.NOVO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.QUALIFICADO)).toBe(true);
    expect(ehEtapaManual(EtapaLead.EXPERIMENTAL_AGENDADA)).toBe(true);
  });
  it("recusa etapas geradas por evento de domínio", () => {
    expect(ehEtapaManual(EtapaLead.EXPERIMENTAL_REALIZADA)).toBe(false);
    expect(ehEtapaManual(EtapaLead.PROPOSTA)).toBe(false);
    expect(ehEtapaManual(EtapaLead.AGUARDANDO_MATRICULA)).toBe(false);
  });
  it("recusa etapas de fluxo próprio (Perdido / Matriculado / No-show)", () => {
    expect(ehEtapaManual(EtapaLead.PERDIDO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.MATRICULADO)).toBe(false);
    expect(ehEtapaManual(EtapaLead.NO_SHOW)).toBe(false);
  });
});

describe("transicaoManualPermitida", () => {
  it("permite o avanço passo-a-passo no trecho do vendedor", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(transicaoManualPermitida(EtapaLead.EM_ATENDIMENTO, EtapaLead.QUALIFICADO)).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(true);
  });

  it("permite correções voltando uma casa", () => {
    expect(transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EM_ATENDIMENTO)).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.QUALIFICADO),
    ).toBe(true);
  });

  it("trata mesma etapa como no-op permitido", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.NOVO)).toBe(true);
  });

  it("bloqueia saltos para etapas geradas por evento", () => {
    // pular a experimental e ir direto para realizada/proposta/aguardando
    expect(
      transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_REALIZADA),
    ).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.QUALIFICADO, EtapaLead.PROPOSTA)).toBe(false);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.AGUARDANDO_MATRICULA),
    ).toBe(false);
  });

  it("bloqueia saltos para saídas paralelas e matrícula", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.PERDIDO)).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.PROPOSTA, EtapaLead.MATRICULADO)).toBe(false);
    expect(transicaoManualPermitida(EtapaLead.EXPERIMENTAL_AGENDADA, EtapaLead.NO_SHOW)).toBe(
      false,
    );
  });

  it("bloqueia pular etapas para frente (Novo → Qualificado)", () => {
    expect(transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.QUALIFICADO)).toBe(false);
    expect(
      transicaoManualPermitida(EtapaLead.NOVO, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(false);
  });

  it("permite retomar o trabalho manual após etapas de evento", () => {
    // pós no-show ou pós-experimental, o vendedor reagenda ou requalifica
    expect(
      transicaoManualPermitida(EtapaLead.NO_SHOW, EtapaLead.EXPERIMENTAL_AGENDADA),
    ).toBe(true);
    expect(
      transicaoManualPermitida(EtapaLead.EXPERIMENTAL_REALIZADA, EtapaLead.QUALIFICADO),
    ).toBe(true);
    // mas nunca avançar para outra etapa de evento manualmente
    expect(
      transicaoManualPermitida(EtapaLead.PROPOSTA, EtapaLead.AGUARDANDO_MATRICULA),
    ).toBe(false);
  });
});

describe("podeAtribuirOutroDono", () => {
  it("permite gerente comercial e admin", () => {
    expect(podeAtribuirOutroDono([Papel.GERENTE_COMERCIAL])).toBe(true);
    expect(podeAtribuirOutroDono([Papel.ADMINISTRADOR])).toBe(true);
  });
  it("nega vendedor", () => {
    expect(podeAtribuirOutroDono([Papel.VENDEDOR])).toBe(false);
    expect(podeAtribuirOutroDono([])).toBe(false);
  });
});

describe("resolverDonoLead", () => {
  it("vendedor sempre vira o próprio dono, ignorando o id enviado", () => {
    const autor = { id: "v1", papeis: [Papel.VENDEDOR] };
    expect(resolverDonoLead(autor, "v2")).toBe("v1");
    expect(resolverDonoLead(autor, undefined)).toBe("v1");
    expect(resolverDonoLead(autor, "")).toBe("v1");
  });
  it("gerente atribui ao vendedor escolhido (ou nenhum)", () => {
    const autor = { id: "g1", papeis: [Papel.GERENTE_COMERCIAL] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
    expect(resolverDonoLead(autor, undefined)).toBeNull();
  });
  it("admin atribui ao vendedor escolhido", () => {
    const autor = { id: "a1", papeis: [Papel.ADMINISTRADOR] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
    expect(resolverDonoLead(autor, undefined)).toBeNull();
  });
  it("vendedor que também é gerente pode atribuir a outro", () => {
    const autor = { id: "g1", papeis: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] };
    expect(resolverDonoLead(autor, "v2")).toBe("v2");
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

describe("chave de negócio do preço (Issue #18)", () => {
  const base: ChavePreco = {
    paisId: "pais-cr",
    produtoId: "prod-ing-regular",
    modalidadeId: "mod-regular",
    tipoCobranca: TipoCobranca.MENSALIDADE,
  };

  it("é estável e independente da identidade do registro", () => {
    // Dois preços (versões) da MESMA combinação compartilham a chave —
    // por isso, ao reativar um antigo, os irmãos da chave devem ser inativados.
    const antigo = { ...base };
    const novo = { ...base };
    expect(chavePrecoReferencia(antigo)).toBe(chavePrecoReferencia(novo));
    expect(mesmaChavePreco(antigo, novo)).toBe(true);
  });

  it("muda quando qualquer parte da combinação difere", () => {
    expect(mesmaChavePreco(base, { ...base, paisId: "pais-mx" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, produtoId: "outro" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, modalidadeId: "outra" })).toBe(false);
    expect(mesmaChavePreco(base, { ...base, tipoCobranca: TipoCobranca.MATRICULA })).toBe(false);
  });

  it("serializa de forma determinística (mesma ordem de campos)", () => {
    expect(chavePrecoReferencia(base)).toBe(
      "pais-cr|prod-ing-regular|mod-regular|MENSALIDADE",
    );
  });
});

describe("irmaosParaInativar — cenário de reativação (Issue #18)", () => {
  const chave: ChavePreco = {
    paisId: "pais-cr",
    produtoId: "prod-ing-regular",
    modalidadeId: "mod-regular",
    tipoCobranca: TipoCobranca.MENSALIDADE,
  };
  const alvo = { id: "preco-antigo", ...chave };

  it("inativa o irmão ativo da mesma combinação ao reativar um preço antigo", () => {
    const atualAtivo = { id: "preco-novo", ...chave };
    expect(irmaosParaInativar(alvo, [atualAtivo])).toEqual(["preco-novo"]);
  });

  it("nunca inclui o próprio preço sendo reativado", () => {
    expect(irmaosParaInativar(alvo, [{ ...alvo }])).toEqual([]);
  });

  it("ignora ativos de outras combinações (país/produto/modalidade/tipo)", () => {
    const outroPais = { id: "p-mx", ...chave, paisId: "pais-mx" };
    const outroTipo = { id: "p-taxa", ...chave, tipoCobranca: TipoCobranca.MATRICULA };
    expect(irmaosParaInativar(alvo, [outroPais, outroTipo])).toEqual([]);
  });

  it("inativa todos os irmãos ativos da chave (cenário de dados legados)", () => {
    const irmaos = [
      { id: "a", ...chave },
      { id: "b", ...chave },
      { id: "outro", ...chave, produtoId: "x" },
    ];
    expect(irmaosParaInativar(alvo, irmaos)).toEqual(["a", "b"]);
  });

  it("não inativa nada quando não há outro ativo (apenas liga o registro)", () => {
    expect(irmaosParaInativar(alvo, [])).toEqual([]);
  });
});

describe("acumularPagamento", () => {
  it("pagamento parcial não quita e gera saldo pelo valor atual", () => {
    const r = acumularPagamento(0, 1000, 300);
    expect(r.recebidoTotal).toBe(300);
    expect(r.saldo).toBe(700);
    expect(r.quitada).toBe(false);
    expect(r.excedente).toBe(0);
  });

  it("parciais sucessivos ACUMULAM e o saldo cai pelo total recebido", () => {
    // primeiro recebe 300 (jaRecebido=0), depois 400 sobre os 300 anteriores
    const primeiro = acumularPagamento(0, 1000, 300);
    const segundo = acumularPagamento(primeiro.recebidoTotal, 1000, 400);
    expect(segundo.recebidoTotal).toBe(700);
    expect(segundo.saldo).toBe(300);
    expect(segundo.quitada).toBe(false);
  });

  it("quita só quando o ACUMULADO cobre o valor negociado", () => {
    const r = acumularPagamento(700, 1000, 300);
    expect(r.recebidoTotal).toBe(1000);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
    expect(r.excedente).toBe(0);
  });

  it("pagamento total de uma vez quita", () => {
    const r = acumularPagamento(0, 1000, 1000);
    expect(r.quitada).toBe(true);
    expect(r.saldo).toBe(0);
  });

  it("bloqueia recebimento acima do negociado por padrão", () => {
    expect(() => acumularPagamento(800, 1000, 300)).toThrow(ErroRegra);
    expect(() => acumularPagamento(0, 1000, 1500)).toThrow(/excede/i);
  });

  it("aceita excedente como crédito explícito quando permitido", () => {
    const r = acumularPagamento(800, 1000, 300, true);
    expect(r.recebidoTotal).toBe(1100);
    expect(r.saldo).toBe(0);
    expect(r.quitada).toBe(true);
    expect(r.excedente).toBe(100);
  });

  it("rejeita valor não positivo", () => {
    expect(() => acumularPagamento(0, 1000, 0)).toThrow(ErroRegra);
    expect(() => acumularPagamento(0, 1000, -50)).toThrow(/maior que zero/i);
  });
});

describe("avaliarPrecoReferencia", () => {
  it("não há ausência quando taxa + mensalidade existem", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
      { tipoCobranca: TipoCobranca.MENSALIDADE, valor: 50 },
    ]);
    expect(r.ausente).toBe(false);
    expect(r.tiposAusentes).toEqual([]);
  });

  it("marca ausência quando falta a mensalidade", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
    ]);
    expect(r.ausente).toBe(true);
    expect(r.tiposAusentes).toEqual([TipoCobranca.MENSALIDADE]);
  });

  it("marca ausência total quando não há preços ativos", () => {
    const r = avaliarPrecoReferencia([]);
    expect(r.ausente).toBe(true);
    expect(r.tiposAusentes).toEqual([TipoCobranca.MATRICULA, TipoCobranca.MENSALIDADE]);
  });

  it("ignora tipos extras irrelevantes (ex.: certificado)", () => {
    const r = avaliarPrecoReferencia([
      { tipoCobranca: TipoCobranca.MATRICULA, valor: 100 },
      { tipoCobranca: TipoCobranca.MENSALIDADE, valor: 50 },
      { tipoCobranca: TipoCobranca.CERTIFICADO, valor: 10 },
    ]);
    expect(r.ausente).toBe(false);
  });
});

describe("podeCheckinExperimental", () => {
  it("só permite quando a experimental está AGENDADA", () => {
    expect(podeCheckinExperimental(EtapaLead.EXPERIMENTAL_AGENDADA)).toBe(true);
  });
  it("recusa quando o check-in já foi feito ou o lead saiu do fluxo", () => {
    expect(podeCheckinExperimental(EtapaLead.EXPERIMENTAL_REALIZADA)).toBe(false);
    expect(podeCheckinExperimental(EtapaLead.NO_SHOW)).toBe(false);
    expect(podeCheckinExperimental(EtapaLead.NOVO)).toBe(false);
    expect(podeCheckinExperimental(EtapaLead.PERDIDO)).toBe(false);
    expect(podeCheckinExperimental(EtapaLead.MATRICULADO)).toBe(false);
  });
});

describe("professorNoEscopoExperimental", () => {
  it("só está no escopo o professor atribuído à experimental", () => {
    expect(professorNoEscopoExperimental("prof1", "prof1")).toBe(true);
  });
  it("recusa outro professor", () => {
    expect(professorNoEscopoExperimental("prof1", "prof2")).toBe(false);
  });
  it("recusa quando não há professor atribuído", () => {
    expect(professorNoEscopoExperimental(null, "prof1")).toBe(false);
    expect(professorNoEscopoExperimental(undefined, "prof1")).toBe(false);
  });
});
