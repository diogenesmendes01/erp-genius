import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { SeparadorDia } from "./SeparadorDia";
it("centraliza também fora de flex/VirtualList e usa pílula superfície12/500",()=>{
 const h=renderToStaticMarkup(createElement(SeparadorDia,{rotulo:"Hoje"}));for(const c of ["flex justify-center","bg-surface","rounded-md","text-xs","font-medium","text-gray-600",">Hoje<"])expect(h).toContain(c);expect(h).not.toContain("<button");
});
