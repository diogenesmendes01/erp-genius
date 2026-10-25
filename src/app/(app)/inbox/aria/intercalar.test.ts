import { describe, expect, it } from "vitest";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { intercalarSugestoes } from "./intercalar";
const s=(id:string,criadoEm:string,status:SugestaoAriaThread["status"]="SUGERIDA"):SugestaoAriaThread=>({id,criadoEm,status,turnoId:"t",acao:"RESPONDER",expiraEm:null,justificativa:null,texto:null,detalhe:{tipo:"outro"},decididaPorId:null,decididaPorNome:null,decididaEm:null});
const i=(id:string,em:string|null)=>({id,em});const em=(i:{em:string|null})=>i.em;
const ids=(r:ReturnType<typeof intercalarSugestoes<{id:string;em:string|null}>>)=>r.map(x=>"s"in x?x.s.id:x.id);
describe("intercalação temporal de sugestões",()=>{
 it("empate coloca sugestão depois dos itens; entradas e empates são estáveis",()=>{expect(ids(intercalarSugestoes([i("a","2026-10-23T10:00Z"),i("b","2026-10-23T10:00Z")],em,[s("p","2026-10-23T10:00Z"),s("q","2026-10-23T10:00Z")],{inicioJanela:null}))).toEqual(["a","b","p","q"]);});
 it("ordena por instante incluindo offsets, não texto",()=>{expect(ids(intercalarSugestoes([i("m","2026-10-23T10:00Z")],em,[s("depois","2026-10-23T08:01:00-02:00"),s("antes","2026-10-23T18:59:00+09:00")],{inicioJanela:null}))).toEqual(["antes","m","depois"]);});
 it("itens sem instante permanecem no fim estáveis",()=>{expect(ids(intercalarSugestoes([i("x",null),i("m","2026-10-23T10:00Z"),i("y",null)],em,[s("s","2026-10-23T11:00Z")],{inicioJanela:null}))).toEqual(["m","s","x","y"]);});
 it("pendente antiga entra no topo, decidida antiga sai, fronteira é inclusiva",()=>{expect(ids(intercalarSugestoes([i("m","2026-10-23T10:00Z")],em,[s("p","2026-10-22T10:00Z"),s("d","2026-10-22T10:00Z","APROVADA"),s("e","2026-10-23T10:00Z","EXPIRADA")],{inicioJanela:"2026-10-23T10:00Z"}))).toEqual(["p","m","e"]);});
 it("janela nula admite decididas e vazio admite sugestões sem mensagens",()=>{expect(ids(intercalarSugestoes<{id:string;em:string|null}>([],em,[s("d","2026-10-22T10:00Z","REJEITADA")],{inicioJanela:null}))).toEqual(["d"]);});
 it("não muta entradas nem suas identidades e usa key própria",()=>{const item=Object.freeze(i("sug","2026-10-23T10:00Z")),sug=Object.freeze(s("sug","2026-10-23T10:00Z"));const r=intercalarSugestoes(Object.freeze([item]),em,Object.freeze([sug]),{inicioJanela:null});expect(r[0]).toBe(item);expect(r[1]).toMatchObject({tipo:"sugestao-aria",id:"sugestao-aria:sug",s:sug});});
});
