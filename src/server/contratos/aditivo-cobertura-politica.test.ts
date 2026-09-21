import { describe, expect, it } from "vitest";
import { extrairPoliticaCoberturaFormalizada } from "./aditivo-cobertura-politica";
import { hashSubstituicao } from "./substituicao-estado";

const entrada = { matriculaId: "m", conclusaoOriginalId: "c", conclusaoHashEsperado: "a".repeat(64), modeloId: "x", modeloHashEsperado: "b".repeat(64), vigenciaInicio: "2027-01-01T00:00:00.000Z", motivo: "Motivo suficiente", chaveIdempotencia: "chave-123", cicloCoberturaFutura: { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2027-03-01" }, alteracoes: [{ origem: "COBERTURA_INICIO", novo: "2027-02-01", valorEstruturado: { tipo: "DATA", data: "2027-02-01" } }, { origem: "COBERTURA_FIM", novo: "2027-02-28", valorEstruturado: { tipo: "DATA", data: "2027-02-28" } }] };
describe("política formalizada da cobertura", () => {
  it("extrai a escolha do snapshot íntegro, não da ação financeira", () => {
    const snapshot = { entrada }; expect(extrairPoliticaCoberturaFormalizada(snapshot, hashSubstituicao(snapshot))).toMatchObject({ escolha: "MUDAR_REFERENCIA", dataReferencia: "2027-03-01" });
  });
  it("recusa alteração ou falta do campo assinado", () => {
    const snapshot = { entrada: { ...entrada, cicloCoberturaFutura: undefined } }; expect(() => extrairPoliticaCoberturaFormalizada(snapshot, hashSubstituicao(snapshot))).toThrow(/referências dos ciclos futuros/);
  });
});

