import { expect, it } from "vitest";
import { apurarFechamentoHoras, type EntradaFechamentoHoras } from "./fechamento-horas";

function base(): EntradaFechamentoHoras {
  return { matriculaId: "m1", periodo: { referencia: "contrato-ciclo-setembro", inicio: "2026-09-01T03:00:00Z", fimExclusivo: "2026-10-01T03:00:00Z" },
    vencimento: "2026-10-10", moeda: "BRL", escolha: "AGUARDAR", encontros: [{ encontroId: "e1", matriculaId: "m1",
      inicio: "2026-09-15T20:00:00-03:00", fim: "2026-09-15T21:15:00-03:00", contratoVersaoId: "v1", moeda: "BRL", valorHoraContratado: "100.00",
      destinacao: { tipo: "SEM_DESTINACAO" }, ocorrencia: { matriculaId: "m1", referenciaEncontro: "e1", contratoVersaoId: "v1",
        inicio: "2026-09-15T23:00:00Z", fim: "2026-09-16T00:15:00Z", registradoEm: "2026-09-16T10:00:00Z",
        evidencia: "Realização conferida", ocorrencia: { tipo: "REALIZADA" } } }] };
}

it("cobra 75 minutos por 1,25 hora, preservando versão/preço e sem efeitos acadêmicos", () => {
  expect(apurarFechamentoHoras(base())).toMatchObject({ estado: "APURACAO_COMPLETA", totalApurado: "125.00", minutosApurados: 75,
    itens: [{ contratoVersaoId: "v1", minutos: 75, unidadeMinutos: 60, valorHoraContratado: "100.00", valor: "125.00" }], emiteCobranca: false, alteraDiario: false });
});

it("arredonda cada item monetário uma vez e soma os itens, sem arredondar minutos para cima", () => {
  const d = base(), e = d.encontros[0];
  e.fim = "2026-09-15T23:01:00Z"; e.valorHoraContratado = "1.00"; e.ocorrencia!.fim = e.fim;
  d.encontros.push({ ...e, encontroId: "e2", ocorrencia: { ...e.ocorrencia!, referenciaEncontro: "e2" } });
  expect(apurarFechamentoHoras(d)).toMatchObject({ totalApurado: "0.04", minutosApurados: 2, itens: [{ valor: "0.02" }, { valor: "0.02" }] });
  e.fim = "2026-09-15T23:01:01Z"; e.ocorrencia!.fim = e.fim;
  expect(() => apurarFechamentoHoras(d)).toThrow(/minutos inteiros/);
});

it.each(["FATURADA", "ANTECIPACAO_CONFERIDA"] as const)("preserva %s sem duplicar obrigação nem recebimento", tipo => {
  const d = base();
  d.encontros[0].destinacao = tipo === "FATURADA" ? { tipo, cobrancaId: "c1", itemId: "i1" } : { tipo, registroId: "consumo1" };
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "SEM_ITENS_A_FATURAR", totalApurado: "0.00", itens: [], preservados: [{ encontroId: "e1", destinacao: { tipo } }] });
});

it("reserva antecipada pendente não vira quitação nem cobrança posterior", () => {
  const d = base(); d.encontros[0].destinacao = { tipo: "ANTECIPACAO_PENDENTE", reservaId: "r1" };
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "AGUARDANDO_CONFERENCIA", totalApurado: "0.00", pendencias: [{ encontroId: "e1" }], preservados: [] });
});

it("exibe pendências e somente propõe parcial; complementar contém apenas o item novo", () => {
  const d = base(); d.encontros.push({ ...d.encontros[0], encontroId: "e2", ocorrencia: null });
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "AGUARDANDO_CONFERENCIA", totalApurado: "125.00", pendencias: [{ encontroId: "e2" }] });
  d.escolha = "PROPOR_PARCIAL";
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "PROPOSTA_PARCIAL", exigeAprovacaoIndependente: true, emiteCobranca: false });
  d.encontros[1].ocorrencia = { ...d.encontros[0].ocorrencia!, referenciaEncontro: "e2" };
  d.encontros[0].destinacao = { tipo: "FATURADA", cobrancaId: "parcial1", itemId: "item1" };
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "APURACAO_COMPLETA", totalApurado: "125.00", itens: [{ encontroId: "e2" }], preservados: [{ encontroId: "e1" }] });
});

it("não propõe emissão parcial vazia quando todos os encontros estão pendentes", () => {
  const d = base(); d.escolha = "PROPOR_PARCIAL"; d.encontros[0].ocorrencia = null;
  expect(apurarFechamentoHoras(d)).toMatchObject({ estado: "AGUARDANDO_CONFERENCIA", exigeAprovacaoIndependente: false, itens: [] });
});

it.each([
  [{ tipo: "FALTA_ALUNO" }, "125.00", "FALTA_COBRAVEL"],
  [{ tipo: "CANCELAMENTO_ALUNO", comunicadoEm: "2026-09-15T22:00:00Z", antecedenciaMinutos: 60 }, "0.00", "CANCELAMENTO_NO_PRAZO"],
  [{ tipo: "CANCELAMENTO_ALUNO", comunicadoEm: "2026-09-15T22:00:00.001Z", antecedenciaMinutos: 60 }, "125.00", "CANCELAMENTO_TARDIO"],
  [{ tipo: "CANCELAMENTO_ESCOLA", comunicadoEm: "2026-09-15T23:00:00Z" }, "0.00", "CANCELAMENTO_ESCOLA"],
] as const)("apura a ocorrência %j sem inventar presença", (ocorrencia, total, desfecho) => {
  const d = base(); d.encontros[0].ocorrencia!.ocorrencia = ocorrencia;
  const r = apurarFechamentoHoras(d);
  expect(r.totalApurado).toBe(total);
  expect([...r.itens, ...r.semCobranca][0].desfecho).toBe(desfecho);
  expect(r.alteraDiario).toBe(false);
});

it("recusa duplicação, outra matrícula/moeda e origens divergentes", () => {
  const d = base(); d.encontros.push(d.encontros[0]);
  expect(() => apurarFechamentoHoras(d)).toThrow(/duplicado/);
  for (const campo of ["matriculaId", "moeda", "contratoVersaoId", "fim"] as const) {
    const entrada = base(); entrada.encontros[0][campo] = campo === "fim" ? "2026-09-16T01:00:00Z" : "outra-origem";
    expect(() => apurarFechamentoHoras(entrada)).toThrow();
  }
});

it("usa início inclusivo e fim exclusivo do período informado, independente do vencimento", () => {
  const d = base(); d.periodo.inicio = d.encontros[0].inicio;
  expect(apurarFechamentoHoras(d).itens).toHaveLength(1);
  d.periodo.fimExclusivo = d.encontros[0].inicio; d.periodo.inicio = "2026-09-01T03:00:00Z";
  expect(() => apurarFechamentoHoras(d)).toThrow(/fora do período/);
});

it("conserva preço zero com duração e memória, recusando total acima da precisão da cobrança", () => {
  const d = base(); d.encontros[0].valorHoraContratado = "0";
  expect(apurarFechamentoHoras(d)).toMatchObject({ totalApurado: "0.00", minutosApurados: 75, itens: [{ valor: "0.00" }] });
  d.encontros[0].valorHoraContratado = "9999999999.99";
  expect(() => apurarFechamentoHoras(d)).toThrow(/capacidade monetária/);
});
