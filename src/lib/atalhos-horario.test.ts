import { describe, expect, it } from "vitest";
import { atalhosDeHorario, partesDoValorLocal } from "./atalhos-horario";
const sp = "America/Sao_Paulo";
const pegar = (iso: string, id: string, fuso = sp) => atalhosDeHorario(new Date(iso), fuso).find(a => a.id === id);
describe("atalhos no calendário institucional", () => {
 it("amanhã usa o dia civil da escola quando UTC já virou", () => {
  expect(pegar("2026-10-22T02:30:00Z", "amanha9")).toEqual({id:"amanha9",rotulo:"Amanhã 09:00",valorLocal:"2026-10-22T09:00"});
  expect(partesDoValorLocal("2026-10-22T14:00")).toEqual({dataCivil:"2026-10-22",hora:"14:00"});
 });
 it("hoje18 exige futuro estrito", () => {
  expect(pegar("2026-10-22T20:59:59Z","hoje18")?.valorLocal).toBe("2026-10-22T18:00");
  expect(pegar("2026-10-22T21:00:00Z","hoje18")).toBeUndefined();
  expect(pegar("2026-10-22T21:00:01Z","hoje18")).toBeUndefined();
 });
 it("segunda é sempre a próxima, inclusive numa segunda", () => {
  expect(pegar("2026-10-26T12:00:00Z","seg9")?.valorLocal).toBe("2026-11-02T09:00");
  expect(pegar("2026-10-22T12:00:00Z","seg9")?.valorLocal).toBe("2026-10-26T09:00");
 });
 it.each([["2026-12-31T12:00:00Z","2027-01-01"],["2028-02-28T12:00:00Z","2028-02-29"],["2026-04-30T12:00:00Z","2026-05-01"]])("preserva calendário em %s",(agora,dia)=>expect(pegar(agora,"amanha14")?.valorLocal).toBe(dia+"T14:00"));
 it("remove dia pulado na troca de fuso de Apia", () => {
  expect(pegar("2011-12-29T22:00:00Z","amanha9","Pacific/Apia")).toBeUndefined();
  expect(pegar("2011-12-29T22:00:00Z","amanha14","Pacific/Apia")).toBeUndefined();
 });
 it("dia diferente entre fusos muda amanhã sem usar preferência pessoal",()=>{
  expect(pegar("2026-10-22T12:00:00Z","amanha9","Pacific/Kiritimati")?.valorLocal).toBe("2026-10-24T09:00");
  expect(pegar("2026-10-22T12:00:00Z","amanha9","America/Costa_Rica")?.valorLocal).toBe("2026-10-23T09:00");
 });
 it("não fabrica atalhos para data ou fuso inválidos",()=>{
  expect(atalhosDeHorario(new Date("invalida"),sp)).toEqual([]);
  expect(atalhosDeHorario(new Date(),"invalido")).toEqual([]);
 });
 it.each(["2026-02-31T09:00","2026-10-22T25:00","2026-10-22","2026-10-22T09:00Z",""])("partes recusa %s",v=>expect(()=>partesDoValorLocal(v)).toThrow());
});