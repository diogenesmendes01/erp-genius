import { describe,it,expect } from "vitest";
import { selecionarPoliticaCoberturaAditivo } from "./continuidade-cobertura-aditivo";
describe("política de cobertura formalizada",()=>{
 it("normaliza mês civil para o formato aceito pelo planejador", () => {
   expect(selecionarPoliticaCoberturaAditivo([{ vigenciaInicio: "2027-02-01", status: "COMPLETO", prova: true, escolha: "MUDAR_REFERENCIA", ciclo: { referencia: "MES_CIVIL", dataReferencia: "2027-03-01" } }], "2027-03-01")).toEqual({ referencia: "MES_CIVIL" });
 });
 it("recusa data impossível, vigência ambígua e prova ausente", () => {
   const entrada = { vigenciaInicio: "2027-02-01", status: "COMPLETO", prova: true, escolha: "MUDAR_REFERENCIA", ciclo: { referencia: "CICLO_MATRICULA", dataReferencia: "2027-03-01" } };
   expect(() => selecionarPoliticaCoberturaAditivo([entrada], "2027-02-30")).toThrow("Data civil");
   expect(() => selecionarPoliticaCoberturaAditivo([entrada, entrada], "2027-03-01")).toThrow("ambígua");
   expect(() => selecionarPoliticaCoberturaAditivo([{ ...entrada, prova: false }], "2027-03-01")).toThrow("prova íntegra");
 });
 it("mantém MUDAR após PRESERVAR e ignora vigência futura",()=>{ const m={status:"COMPLETO" as const,prova:true,escolha:"MUDAR_REFERENCIA" as const,ciclo:{referencia:"CICLO_MATRICULA" as const,dataReferencia:"2027-03-01"}}; const p={status:"COMPLETO" as const,prova:true,escolha:"PRESERVAR_REFERENCIA" as const,ciclo:{referencia:"CICLO_MATRICULA" as const,dataReferencia:"2027-03-01"}}; expect(selecionarPoliticaCoberturaAditivo([{...m,vigenciaInicio:"2027-02-01"},{...p,vigenciaInicio:"2027-03-01"},{...m,vigenciaInicio:"2028-01-01"}],"2027-04-01")).toMatchObject({dataReferencia:"2027-03-01"}); });
});
