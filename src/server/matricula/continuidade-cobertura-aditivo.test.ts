import { describe,it,expect } from "vitest";
import { selecionarPoliticaCoberturaAditivo } from "./continuidade-cobertura-aditivo";
describe("política de cobertura formalizada",()=>{
 it("mantém MUDAR após PRESERVAR e ignora vigência futura",()=>{ const m={status:"COMPLETO" as const,prova:true,escolha:"MUDAR_REFERENCIA" as const,ciclo:{referencia:"CICLO_MATRICULA" as const,dataReferencia:"2027-03-01"}}; const p={status:"COMPLETO" as const,prova:true,escolha:"PRESERVAR_REFERENCIA" as const,ciclo:{referencia:"CICLO_MATRICULA" as const,dataReferencia:"2027-03-01"}}; expect(selecionarPoliticaCoberturaAditivo([{...m,vigenciaInicio:"2027-02-01"},{...p,vigenciaInicio:"2027-03-01"},{...m,vigenciaInicio:"2028-01-01"}],"2027-04-01")).toMatchObject({dataReferencia:"2027-03-01"}); });
});
