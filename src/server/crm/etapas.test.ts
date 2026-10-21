import { describe, expect, it } from "vitest";
import type { EtapaLead } from "@prisma/client";
import { COLUNAS_FUNIL, COLUNAS_RECOLHIDAS, destinoDoArraste } from "./etapas";

describe("etapas do funil", () => {
  it("colunas seguem as 10 etapas do ERP, inclusive NO_SHOW", () => {
    expect(COLUNAS_FUNIL).toEqual(["NOVO","EM_ATENDIMENTO","QUALIFICADO","EXPERIMENTAL_AGENDADA","EXPERIMENTAL_REALIZADA","NO_SHOW","PROPOSTA","AGUARDANDO_MATRICULA","MATRICULADO","PERDIDO"]);
    expect(COLUNAS_RECOLHIDAS).toEqual(["MATRICULADO", "PERDIDO"]);
  });
  it.each([
    ["NOVO", "EM_ATENDIMENTO", { tipo: "mover" }],
    ["QUALIFICADO", "EXPERIMENTAL_AGENDADA", { tipo: "acao", acao: "agendarExperimental" }],
    ["QUALIFICADO", "PERDIDO", { tipo: "acao", acao: "marcarPerdido" }],
    ["PROPOSTA", "MATRICULADO", { tipo: "acao", acao: "prepararContratacao" }],
    ["QUALIFICADO", "PROPOSTA", { tipo: "acao", acao: "enviarProposta" }],
  ])("%s → %s", (o, d, esperado) => expect(destinoDoArraste(o as EtapaLead, d as EtapaLead)).toEqual(esperado));
  it.each([
    "NOVO","EM_ATENDIMENTO","QUALIFICADO","EXPERIMENTAL_AGENDADA","EXPERIMENTAL_REALIZADA","NO_SHOW","PROPOSTA","AGUARDANDO_MATRICULA","MATRICULADO","PERDIDO",
  ])("soltar na mesma coluna (%s) não faz nada", (e) =>
    expect(destinoDoArraste(e as EtapaLead, e as EtapaLead)).toEqual({ tipo: "nenhum" }));
  // Proposta e contratação aceitam arraste de QUALQUER etapa aberta: a ação só
  // abre o diálogo; quem valida a transição é o servidor ao confirmar.
  const ABERTAS = ["NOVO","EM_ATENDIMENTO","QUALIFICADO","EXPERIMENTAL_AGENDADA","EXPERIMENTAL_REALIZADA","NO_SHOW","PROPOSTA","AGUARDANDO_MATRICULA"] as const;
  it("NOVO → PROPOSTA e AGUARDANDO_MATRICULA → PROPOSTA abrem enviarProposta", () => {
    expect(destinoDoArraste("NOVO", "PROPOSTA")).toEqual({ tipo: "acao", acao: "enviarProposta" });
    expect(destinoDoArraste("AGUARDANDO_MATRICULA", "PROPOSTA")).toEqual({ tipo: "acao", acao: "enviarProposta" });
  });
  it.each(ABERTAS.filter((o) => o !== "PROPOSTA"))("%s → PROPOSTA devolve enviarProposta", (o) =>
    expect(destinoDoArraste(o as EtapaLead, "PROPOSTA")).toEqual({ tipo: "acao", acao: "enviarProposta" }));
  it.each(
    ABERTAS.flatMap((o) => (["AGUARDANDO_MATRICULA", "MATRICULADO"] as const).filter((d) => d !== o).map((d) => [o, d] as const)),
  )("%s → %s devolve prepararContratacao", (o, d) =>
    expect(destinoDoArraste(o as EtapaLead, d as EtapaLead)).toEqual({ tipo: "acao", acao: "prepararContratacao" }));
  it("recusa salto, etapa de evento e saída de etapa final", () => {
    expect(destinoDoArraste("NOVO", "QUALIFICADO")).toEqual({ tipo: "recusar", motivo: "Avance uma etapa por vez." });
    expect(destinoDoArraste("NOVO", "EXPERIMENTAL_REALIZADA")).toEqual({ tipo: "recusar", motivo: "Esta etapa é registrada pelo check-in do professor." });
    expect(destinoDoArraste("MATRICULADO", "NOVO")).toEqual({ tipo: "recusar", motivo: "Oportunidade encerrada não volta ao funil." });
    expect(destinoDoArraste("PERDIDO", "NOVO")).toEqual({ tipo: "recusar", motivo: "Oportunidade encerrada não volta ao funil." });
  });
});
