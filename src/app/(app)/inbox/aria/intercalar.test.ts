import { describe, expect, it } from "vitest";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { agruparPorTurno, intercalarSugestoes } from "./intercalar";
const s=(id:string,criadoEm:string,status:SugestaoAriaThread["status"]="SUGERIDA"):SugestaoAriaThread=>({id,criadoEm,status,turnoId:"t-"+id,acao:"RESPONDER",expiraEm:null,justificativa:null,texto:null,detalhe:{tipo:"outro"},decididaPorId:null,decididaPorNome:null,decididaEm:null});
const i=(id:string,em:string|null)=>({id,em});const em=(i:{em:string|null})=>i.em;
const ids=(r:ReturnType<typeof intercalarSugestoes<{id:string;em:string|null}>>)=>r.map(x=>"s"in x?x.s.id:x.id);
describe("intercalação temporal de sugestões",()=>{
 it("janela antiga inclui fronteira superior por instante e omite sugestões posteriores de qualquer estado",()=>{
  const opcoes={inicioJanela:null,fimJanela:"2026-10-23T11:00:00Z"};
  expect(ids(intercalarSugestoes([i("m","2026-10-23T10:00Z")],em,[s("fronteira","2026-10-23T13:00:00+02:00"),s("futura","2026-10-23T11:00:01Z"),s("decidida-futura","2026-10-23T12:00Z","APROVADA")],opcoes))).toEqual(["m","fronteira"]);
 });
 it("instantes inválidos ficam estáveis no fim, junto aos sem instante, sem comparador NaN",()=>{
  expect(ids(intercalarSugestoes([i("invalida","invalido"),i("m","2026-10-23T10:00Z"),i("sem",null)],em,[s("p","invalido"),s("valida","2026-10-23T11:00Z"),s("q","tambem-invalido")],{inicioJanela:null}))).toEqual(["m","valida","invalida","sem","p","q"]);
 });
 it("janela limitada não admite sugestão sem instante válido; limite nulo mantém a janela mais recente",()=>{
  const sugestoes=[s("sem-instante","invalido"),s("futura","2026-10-23T12:00Z")];
  expect(ids(intercalarSugestoes<{id:string;em:string|null}>([],em,sugestoes,{inicioJanela:null,fimJanela:"2026-10-23T11:00Z"}))).toEqual([]);
  expect(ids(intercalarSugestoes<{id:string;em:string|null}>([],em,sugestoes,{inicioJanela:null,fimJanela:null}))).toEqual(["futura","sem-instante"]);
 });
 it("empate coloca sugestão depois dos itens; entradas e empates são estáveis",()=>{expect(ids(intercalarSugestoes([i("a","2026-10-23T10:00Z"),i("b","2026-10-23T10:00Z")],em,[s("p","2026-10-23T10:00Z"),s("q","2026-10-23T10:00Z")],{inicioJanela:null}))).toEqual(["a","b","p","q"]);});
 it("ordena por instante incluindo offsets, não texto",()=>{expect(ids(intercalarSugestoes([i("m","2026-10-23T10:00Z")],em,[s("depois","2026-10-23T08:01:00-02:00"),s("antes","2026-10-23T18:59:00+09:00")],{inicioJanela:null}))).toEqual(["antes","m","depois"]);});
 it("itens sem instante permanecem no fim estáveis",()=>{expect(ids(intercalarSugestoes([i("x",null),i("m","2026-10-23T10:00Z"),i("y",null)],em,[s("s","2026-10-23T11:00Z")],{inicioJanela:null}))).toEqual(["m","s","x","y"]);});
 it("pendente antiga entra no topo, decidida antiga sai, fronteira é inclusiva",()=>{expect(ids(intercalarSugestoes([i("m","2026-10-23T10:00Z")],em,[s("p","2026-10-22T10:00Z"),s("d","2026-10-22T10:00Z","APROVADA"),s("e","2026-10-23T10:00Z","EXPIRADA")],{inicioJanela:"2026-10-23T10:00Z"}))).toEqual(["p","m","e"]);});
 it("janela nula admite decididas e vazio admite sugestões sem mensagens",()=>{expect(ids(intercalarSugestoes<{id:string;em:string|null}>([],em,[s("d","2026-10-22T10:00Z","REJEITADA")],{inicioJanela:null}))).toEqual(["d"]);});
 it("não muta entradas nem suas identidades e usa key própria",()=>{const item=Object.freeze(i("sug","2026-10-23T10:00Z")),sug=Object.freeze(s("sug","2026-10-23T10:00Z"));const r=intercalarSugestoes(Object.freeze([item]),em,Object.freeze([sug]),{inicioJanela:null});expect(r[0]).toBe(item);expect(r[1]).toMatchObject({tipo:"sugestao-aria",id:"sugestao-aria:sug",s:sug});});
 it("agrupa_so_pendentes_do_mesmo_turno; decididas ficam sozinhas e a ordem de chegada é mantida",()=>{
  const t=(id:string,turnoId:string,status:SugestaoAriaThread["status"]="SUGERIDA")=>({...s(id,"2026-10-23T10:00Z",status),turnoId});
  const g=agruparPorTurno([t("a","t1"),t("b","t2"),t("c","t1","APROVADA"),t("d","t1"),t("e","t2","REJEITADA")]);
  expect(g.map(x=>x.map(y=>y.id))).toEqual([["a","d"],["b"],["c"],["e"]]);
 });
 it("pacote do turno vira um único item na posição da primeira sugestão, com chave estável",()=>{
  const t=(id:string,em:string)=>({...s(id,em),turnoId:"t1"});
  const r=intercalarSugestoes([i("m","2026-10-23T10:30Z")],em,[t("tarde","2026-10-23T10:40Z"),t("cedo","2026-10-23T10:20Z")],{inicioJanela:null});
  expect(ids(r)).toEqual(["cedo","m"]);
  expect(r[0]).toMatchObject({tipo:"sugestao-aria",id:"sugestao-aria:cedo",pacote:[{id:"tarde"},{id:"cedo"}]});
  expect(intercalarSugestoes<{id:string;em:string|null}>([],em,[t("so","2026-10-23T10:20Z")],{inicioJanela:null})[0]).not.toHaveProperty("pacote");
 });
});
