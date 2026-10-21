import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validarCadeiaAditivo } from "./aditivo-cadeia";
import { hashSubstituicao } from "./substituicao-estado";

const elo = (id: string, versao: number, anteriorId: string | null) => {
  const condicoes = { ALUNO_NOME: { tipo: "TEXT", texto: `Nome versão ${versao}` } };
  const pdfAssinado = Buffer.from("%PDF-teste"); const pdfHash = createHash("sha256").update(pdfAssinado).digest("hex");
  return { id, matriculaId: "m", propostaId: `p${versao}`, versao, anteriorId, vigenciaInicio: new Date(`2027-0${versao}-01T00:00:00Z`), condicoes, condicoesHash: hashSubstituicao(condicoes),
    conferenciaFinal: { conclusao: { originalHash: "a".repeat(64), pdfHash, pdfAssinado, processo: { ambiente: "PRODUCAO", proposta: { id: `p${versao}`, matriculaId: "m" }, artefato: { id: `a${versao}`, pdfHash: "a".repeat(64) } } } } };
};
describe("cadeia de aditivo", () => {
  it("recusa arquivo assinado corrompido e campo incompatível", () => {
    const a = elo("v1", 1, null);
    a.conferenciaFinal.conclusao.pdfAssinado = Buffer.from("%PDF-alterado");
    expect(() => validarCadeiaAditivo([a])).toThrow();
    const b = elo("v1", 1, null);
    const condicoes = { ALUNO_NOME: { tipo: "MOEDA", moeda: "BRL" } };
    expect(() => validarCadeiaAditivo([{ ...b, condicoes, condicoesHash: hashSubstituicao(condicoes) }])).toThrow();
  });
  it("recusa mistura de matrículas e vigência retrocedente", () => {
    const a = elo("v1", 1, null), b = elo("v2", 2, "v1");
    b.matriculaId = "outra";
    b.conferenciaFinal.conclusao.processo.proposta.matriculaId = "outra";
    expect(() => validarCadeiaAditivo([a, b])).toThrow();
    const c = elo("v2", 2, "v1"); c.vigenciaInicio = a.vigenciaInicio;
    expect(() => validarCadeiaAditivo([a, c])).toThrow();
  });
  it("preserva referências em ordem", () => expect(validarCadeiaAditivo([elo("v1", 1, null), elo("v2", 2, "v1")])).toMatchObject({ ids: ["v1", "v2"], referencias: [{ documentoId: "a1" }, { documentoId: "a2" }] }));
  it("rejeita hash e elo quebrados", () => { const a = elo("v1", 1, null), b = elo("v2", 2, null); expect(() => validarCadeiaAditivo([a, b])).toThrow(); expect(() => validarCadeiaAditivo([{ ...a, condicoesHash: "0".repeat(64) }])).toThrow(); });
});
