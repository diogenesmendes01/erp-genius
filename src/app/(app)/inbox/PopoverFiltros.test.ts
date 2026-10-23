import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PopoverFiltros, contarFiltrosAplicados } from "./PopoverFiltros";
it("selo aplicado conta apenas setor/status sem confundir chips e número",()=>{expect(contarFiltrosAplicados({})).toBe(0);expect(contarFiltrosAplicados({setor:"COMERCIAL",status:"ENCERRADO",naoLidas:true,numeroId:"n1",responsavel:"eu"})).toBe(2);});
it("oferece só setores do escopo e quatro status atuais; rodapé conserva ações DS",()=>{
 const h=renderToStaticMarkup(createElement(PopoverFiltros,{filtros:{setor:"FINANCEIRO"},setores:["FINANCEIRO"],aoAplicar:()=>{},aoFechar:()=>{}}));
 for(const t of ['Filtrar conversas','Financeiro','Em atendimento','Encerrado','Limpar','Mostrar conversas','role="dialog"','max-[699px]:max-h-[85dvh]'])expect(h).toContain(t);
 for(const t of ['aria-modal','Comercial','Etapa','Tags','Tipo'])expect(h).not.toContain(t);
});
