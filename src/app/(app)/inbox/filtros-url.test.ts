import { expect, it } from "vitest";
import { chipAtivo, filtrosDoChip, hrefDosFiltros, paramsDaUrl } from "./filtros-url";
import type { FiltrosInbox } from "@/server/inbox/filtros";
it("preserva formato público e codifica busca sem perder setor/número/status", () => {
 const f: FiltrosInbox = { setor:"FINANCEIRO",numeroId:"n1",responsavel:"eu",status:"EM_ATENDIMENTO",naoLidas:true,prazoEstourado:true,busca:"Ana & Beto" };
 expect(Object.fromEntries(paramsDaUrl(f))).toEqual({setor:"FINANCEIRO",numero:"n1",resp:"eu",status:"EM_ATENDIMENTO",naoLidas:"1",prazo:"estourado",busca:"Ana & Beto"});
 expect(hrefDosFiltros("/inbox",{ busca:"Ana & Beto",numeroId:"n1" })).toBe("/inbox?numero=n1&busca=Ana+%26+Beto");
 expect(hrefDosFiltros("/inbox",{})).toBe("/inbox");
});
it("chip substitui só as dimensões rápidas, não muta origem nem deixa flags antigas", () => {
 const f: FiltrosInbox={setor:"FINANCEIRO",numeroId:"n1",status:"ENCERRADO",busca:"ana",responsavel:"u9",naoLidas:true,prazoEstourado:true};
 const fixos={setor:"FINANCEIRO",numeroId:"n1",status:"ENCERRADO",busca:"ana"};
 expect(filtrosDoChip("todas",f)).toEqual(fixos);
 expect(filtrosDoChip("minhas",f)).toEqual({...fixos,responsavel:"eu"});
 expect(filtrosDoChip("fila",f)).toEqual({...fixos,responsavel:"fila"});
 expect(filtrosDoChip("naoLidas",f)).toEqual({...fixos,naoLidas:true});
 expect(filtrosDoChip("prazo",f)).toEqual({...fixos,prazoEstourado:true});
 expect(f.responsavel).toBe("u9");expect(f.prazoEstourado).toBe(true);
});
it("chip ativo só representa sua dimensão exclusiva, inclusive filtros externos combinados", () => {
 expect(chipAtivo({})).toBe("todas");expect(chipAtivo({responsavel:"fila",setor:"COMERCIAL"})).toBe("fila");
 expect(chipAtivo({responsavel:"eu"})).toBe("minhas");expect(chipAtivo({naoLidas:true})).toBe("naoLidas");expect(chipAtivo({prazoEstourado:true})).toBe("prazo");
 expect(chipAtivo({responsavel:"u9"})).toBeNull();expect(chipAtivo({responsavel:"eu",naoLidas:true})).toBeNull();
 expect(chipAtivo({naoLidas:true,prazoEstourado:true})).toBeNull();
});
