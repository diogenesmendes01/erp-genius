import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn()}),usePathname:()=>"/inbox"}));
import { ChipsFiltro, chipsDaColuna } from "./ChipsFiltro";
it("cinco agregados do servidor mantêm ordem/rótulo/tom e não vêm do tamanho da página",()=>{
 expect(chipsDaColuna({todas:123,minhas:3,naoLidas:2,prazo:4,fila:9})).toEqual([
 {id:"todas",rotulo:"Todas",tom:"neutro",total:123},{id:"minhas",rotulo:"Minhas",tom:"humano",total:3},{id:"naoLidas",rotulo:"Não lidas",tom:"neutro",total:2},{id:"prazo",rotulo:"Prazo estourado",tom:"sem-resposta",total:4},{id:"fila",rotulo:"Não atribuídas",tom:"neutro",total:9}]);
 expect(chipsDaColuna().map(c=>c.total)).toEqual([0,0,0,0,0]);
});
it("aria-pressed e cor cinza identificam somente chip ativo; contagem mono e pontos semânticos",()=>{
 const h=renderToStaticMarkup(createElement(ChipsFiltro,{chips:chipsDaColuna({todas:123,minhas:3,naoLidas:2,prazo:4,fila:9}),ativo:"todas",filtros:{}}));
 expect(h).toMatch(/aria-pressed="true"[^>]*class="[^"]*bg-gray-100/);expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
 for(const c of ['rounded-[20px]','text-[12.5px]','h-[7px]','bg-amber-600','bg-brand-solid','font-mono','123'])expect(h).toContain(c);
 expect(renderToStaticMarkup(createElement(ChipsFiltro,{chips:chipsDaColuna(),ativo:null,filtros:{responsavel:"u9"}}))).not.toContain('aria-pressed="true"');
});
