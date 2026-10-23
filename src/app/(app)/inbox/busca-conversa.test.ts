import { expect, it } from "vitest";
import { normalizarBusca, encontrarMensagens, moverAchado } from "./busca-conversa";
const m=(id:string,corpo:string|null,criadoEm="2026-10-22T12:00:00Z",apagada=false)=>({id,corpo,criadoEm,apagada});
it("normaliza NFD/marcas Unicode, caixa e espaços sem mudar conteúdo original",()=>{expect(normalizarBusca("  Ação   JÁ\n ")).toBe("acao ja");expect(normalizarBusca("a\u0301")).toBe("a");});
it("busca só corpo não apagado e exige dois caracteres normalizados",()=>{const ms=[m("1","MATRÍCULA"),m("2","matricula ok"),m("3","matrícula",undefined,true),m("4",null),m("5","outra")];expect(encontrarMensagens(ms," Matrícula  ")).toEqual(["1","2"]);expect(encontrarMensagens(ms,"á")).toEqual([]);expect(ms[0].corpo).toBe("MATRÍCULA");});
it("devolve ordem cronológica estável sem ordenar o array de entrada",()=>{const ms=[m("b","ação","2026-10-23T12:00:00Z"),m("a","ação")];expect(encontrarMensagens(ms,"acao")).toEqual(["a","b"]);expect(ms[0].id).toBe("b");});
it("navegação circular reconcilia porID e lida com vazio/remoção",()=>{expect(moverAchado(["a","b"],"a",-1)).toBe("b");expect(moverAchado(["a","b"],"b",1)).toBe("a");expect(moverAchado(["b"],"apagado",1)).toBe("b");expect(moverAchado([],null,1)).toBeNull();});
