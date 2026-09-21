import { expect, it } from "vitest";
import { conferirRecomposicaoCobertura } from "./recomposicao-cobertura";

const entrada = () => ({
  matriculaId: "m1", moeda: "BRL", retornoOferta: "2026-10-01", inicioCompensacao: "2026-10-01", motivo: "Retorno da oferta de turma", evidenciaCondicoes: "Compensação aprovada conforme contrato",
  direitos: ["2026-09-10", "2026-09-11"].map((diaOrigem, i) => ({ id: `d${i}`, matriculaId: "m1", compensacaoId: "cp1", diaOrigem, estado: "PENDENTE" as const, versao: 1 })),
  periodosAtuais: [{ cobrancaId: "c1", matriculaId: "m1", versao: 2, cobertura: { inicio: "2026-10-01", fim: "2026-10-31" }, valor: "400.00", moeda: "BRL", vencimento: "2026-10-05" }],
  periodosPropostos: [{ cobrancaId: "c1", cobertura: { inicio: "2026-10-03", fim: "2026-11-02" } }],
});
it("recompõe dias sem cobrança adicional e conserva valor, duração e vencimento do período seguinte", () => {
  const e = entrada(); const antes = structuredClone(e); const r = conferirRecomposicaoCobertura(e);
  expect(r.compensacao).toEqual({ inicio: "2026-10-01", fim: "2026-10-02" });
  expect(r.destinos.map((v) => v.diaCompensadoProposto)).toEqual(["2026-10-01", "2026-10-02"]);
  expect(r.periodos[0]).toMatchObject({ valor: "400.00", vencimento: "2026-10-05", versao: 2, alterado: true });
  expect(r.valorAdicional).toBe("0.00"); expect(r.exigeAprovacaoIndependente).toBe(true); expect(e).toEqual(antes);
});
it("recusa sobreposição dos dias compensados e omissão de cobranças", () => {
  const e = entrada(); e.periodosPropostos[0].cobertura = e.periodosAtuais[0].cobertura;
  expect(() => conferirRecomposicaoCobertura(e)).toThrow(/sobrepostas/);
  expect(() => conferirRecomposicaoCobertura({ ...entrada(), periodosPropostos: [] })).toThrow(/exatamente/);
});
it("recusa uso duplicado, outra matrícula e direitos já utilizados", () => {
  const e = entrada(); e.direitos[1] = e.direitos[0]; expect(() => conferirRecomposicaoCobertura(e)).toThrow(/repetido/);
  expect(() => conferirRecomposicaoCobertura({ ...entrada(), matriculaId: "m2" })).toThrow(/desta matrícula/);
  expect(() => conferirRecomposicaoCobertura({ ...entrada(), direitos: [{ ...entrada().direitos[0], estado: "RECOMPOSTO" }] })).toThrow(/pendentes/);
});
it("não reescreve período anterior ao retorno nem altera sua duração", () => {
  const e = entrada(); e.retornoOferta = "2026-10-02"; e.inicioCompensacao = "2026-10-02";
  expect(() => conferirRecomposicaoCobertura(e)).toThrow(/histórico/);
  const f = entrada(); f.periodosPropostos[0].cobertura.fim = "2026-11-03";
  expect(() => conferirRecomposicaoCobertura(f)).toThrow(/dias contratados/);
});
