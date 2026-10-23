import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { EventoSistema } from "./EventoSistema";
it("centraliza por própria caixa, pílula IA/neutra e hora mono, sem controle fictício",()=>{
 const h=renderToStaticMarkup(createElement(EventoSistema,{tom:"ia",icone:"★",texto:"Aria preencheu Nível",hora:"09:58"}));
 for(const c of ["flex justify-center","rounded-[20px]","bg-ai-50","text-ai-700","font-mono","09:58","text-xs"])expect(h).toContain(c);
 const n=renderToStaticMarkup(createElement(EventoSistema,{tom:"neutro",icone:"★",texto:"Transferido de Secretaria",riscado:true}));expect(n).toContain("bg-surface");expect(n).toContain("line-through");expect(n).not.toContain("<button");
});
