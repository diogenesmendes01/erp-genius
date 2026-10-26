import {expect,it} from "vitest";
import { EntradaPresencaSchema, origemPresencaValida } from "./presenca-schema";
const abaId="12345678-1234-4234-8234-123456789012", aberturaId="12345678-1234-4234-8234-123456789013";
it("abrir diferencia entrada deliberada e reconexão, sem timestamp",()=>{expect(EntradaPresencaSchema.parse({modo:"abrir",abaId,aberturaId,geracaoEsperada:null,inscricaoEsperada:null,causa:"entrada"})).toMatchObject({causa:"entrada"});expect(EntradaPresencaSchema.parse({modo:"abrir",abaId,aberturaId,geracaoEsperada:"7",inscricaoEsperada:"id",causa:"reconexao"})).toMatchObject({geracaoEsperada:7n});});
it.each(["pulso","interacao","fechar"])("%s permite só inscrição e seq selfbound",modo=>expect(EntradaPresencaSchema.parse({modo,id:"inscricao",geracao:"4",seq:"5"})).toMatchObject({geracao:4n,seq:5n}));
it.each(["-1","1.2","01","9223372036854775808","NaN",1])("rejeita contador inválido %j",seq=>expect(()=>EntradaPresencaSchema.parse({modo:"pulso",id:"a",geracao:"1",seq})).toThrow());
it.each([{usuarioId:"outro"},{ultimaInteracaoEm:1000},{setor:"COMERCIAL"}])("não aceita estado/autorização vindo do browser %j",extra=>expect(()=>EntradaPresencaSchema.parse({modo:"pulso",id:"a",geracao:"1",seq:"1",...extra})).toThrow());
it("consulta limitada fecha token e IDs e só acompanha pulso/ler",()=>{expect(EntradaPresencaSchema.parse({modo:"ler",consulta:{atendimentoId:"a",tokenModal:"m"}})).toBeTruthy();expect(()=>EntradaPresencaSchema.parse({modo:"interacao",id:"a",geracao:"1",seq:"1",consulta:{atendimentoId:"a",tokenModal:"m"}})).toThrow();});
const req=(origin="https://erp.test",extra:Record<string,string>={})=>new Request("https://erp.test/api/inbox/presenca",{method:"POST",headers:{origin,"sec-fetch-site":"same-origin","content-type":"application/json","x-inbox-presenca":"1",...extra}});
it("origem configurada exata e header JSON não simples defendem CSRF",()=>expect(origemPresencaValida(req(),"https://erp.test/")).toBe(true));
it.each([req("https://evil.test"),req("null"),req("https://erp.test",{"sec-fetch-site":"cross-site"}),req("https://erp.test",{"x-inbox-presenca":""}),req("https://erp.test",{"content-type":"text/plain"})])("origem/headers não autorizados negam",r=>expect(origemPresencaValida(r,"https://erp.test")).toBe(false));
it("sem origem configurada não usa Host como fallback",()=>expect(origemPresencaValida(req(),undefined)).toBe(false));


it("binding de abertura precisa ID e geração juntos e reconexão precisa row conhecida",()=>{
 const base={modo:"abrir",abaId,aberturaId,geracaoEsperada:"1",causa:"reconexao"};
 expect(()=>EntradaPresencaSchema.parse({...base,inscricaoEsperada:null})).toThrow();
 expect(()=>EntradaPresencaSchema.parse({...base,inscricaoEsperada:"id",geracaoEsperada:null})).toThrow();
 expect(()=>EntradaPresencaSchema.parse({...base,inscricaoEsperada:null,geracaoEsperada:null})).toThrow();
 expect(EntradaPresencaSchema.parse({...base,inscricaoEsperada:"id"})).toMatchObject({inscricaoEsperada:"id",geracaoEsperada:1n});
});

it("resolver aceita sóabaUUID e nuncauser/ID/tempo dobrowser",()=>{expect(EntradaPresencaSchema.parse({modo:"resolver",abaId})).toEqual({modo:"resolver",abaId});expect(()=>EntradaPresencaSchema.parse({modo:"resolver",abaId,usuarioId:"outro"})).toThrow();});
