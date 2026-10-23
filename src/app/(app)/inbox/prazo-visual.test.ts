import { describe, expect, it } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { proximaMudancaVisualEm } from "./prazo-vivo";
const T=Date.UTC(2026,9,22,12), M=60_000;
const item=(prazo:number|string|null,o:Partial<ItemListaInbox>={})=>({ grupo:false,status:"EM_ATENDIMENTO",prazoRespostaEm:typeof prazo==="number"?new Date(prazo).toISOString():prazo,...o } as ItemListaInbox);
describe("próxima mudança visual de prazo",()=>{
 it("vencimento é estrito, inclusive no instante igual, sem timer zero",()=>{
  expect(proximaMudancaVisualEm([item(T+1000)],T)).toBe(T+1001);
  expect(proximaMudancaVisualEm([item(T)],T)).toBe(T+1);
 });
 it("só acorda quando muda texto/cor:1min não muda aos60seg;29→30 e59→60 exatos",()=>{
  expect(proximaMudancaVisualEm([item(T-1)],T)).toBe(T+2*M-1);
  expect(proximaMudancaVisualEm([item(T-M)],T)).toBe(T+M);
  expect(proximaMudancaVisualEm([item(T-29*M)],T)).toBe(T+M);
  expect(proximaMudancaVisualEm([item(T-59*M)],T)).toBe(T+M);
  expect(proximaMudancaVisualEm([item(T-30*M)],T)).toBe(T+M);
 });
 it("escolhe mínimo entre vários vencimentos e minutos e ignora não elegíveis",()=>{
  const vencido=item(T-29*M+500), futuro=item(T+200);
  expect(proximaMudancaVisualEm([vencido,futuro,item(T+10,{grupo:true}),item(T-59*M,{status:"ENCERRADO"})],T)).toBe(T+201);
  expect(proximaMudancaVisualEm([vencido,item(T-59*M-400)],T)).toBe(T+500);
  expect(proximaMudancaVisualEm([vencido,item(T-59*M-59_800)],T)).toBe(T+200);
 });
 it.each([[],[item(null)],[item("inválida")],[item(T,{grupo:true})],[item(T,{status:"ENCERRADO"})]].map(itens=>({itens})))("sem badge elegível não agenda:%j",({itens})=>{
  expect(proximaMudancaVisualEm(itens,T)).toBeNull();
 });
});
