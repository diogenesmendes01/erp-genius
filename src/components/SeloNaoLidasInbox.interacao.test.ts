import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ subs: [] as ((f: () => void) => () => void)[] }));
vi.mock("react", () => ({ useCallback: (f: unknown) => f, useSyncExternalStore: (sub: (f: () => void) => () => void, valor: () => number) => { m.subs.push(sub); return valor(); } }));
import { useNaoLidasInbox } from "./SeloNaoLidasInbox";
it("render não inicia rede; múltiplos consumidores compartilham SSE e nova propSSR reconta sem desmontar os demais", async () => {
 let fontes=0, ativas=0, maximas=0;
 class Fonte { onopen=null; onerror=null; fechada=false; constructor(){fontes++;maximas=Math.max(maximas,++ativas);} addEventListener(){} close(){if(!this.fechada){this.fechada=true;ativas--;}} }
 const buscar=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({total:2}))).mockImplementation(async()=>new Response(JSON.stringify({total:5})));
 vi.stubGlobal("window",{});vi.stubGlobal("EventSource",Fonte);vi.stubGlobal("fetch",buscar);
 const saidas:(()=>void)[]=[];
 try {
  expect(useNaoLidasInbox(2)).toBe(2);expect(buscar).not.toHaveBeenCalled();saidas.push(m.subs[0](()=>{}));await vi.waitFor(()=>expect(buscar).toHaveBeenCalledTimes(1));
  useNaoLidasInbox(5);const sub=m.subs.at(-1)!;saidas.push(sub(()=>{}));await vi.waitFor(()=>expect(buscar).toHaveBeenCalledTimes(2));await vi.waitFor(()=>expect(useNaoLidasInbox(5)).toBe(5));
  expect(fontes).toBe(1);saidas[0]();saidas[0]();expect(ativas).toBe(1);saidas[1]();expect(ativas).toBe(0);
  useNaoLidasInbox(5);saidas.push(m.subs.at(-1)!(()=>{}));expect(maximas).toBe(1);expect(fontes).toBe(2);
 } finally {for(const sair of saidas)sair();vi.unstubAllGlobals();}
});
