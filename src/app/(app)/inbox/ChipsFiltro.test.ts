import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const nav=vi.hoisted(()=>({replace:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:nav.replace}),usePathname:()=>"/inbox"}));
import {elementos} from "@/test/tela-sem-dom";
import {chipsDoInbox} from "./chips-inbox";
import { ChipsFiltro, chipsDaColuna } from "./ChipsFiltro";
it("cinco agregados do servidor mantêm ordem/rótulo/tom e não vêm do tamanho da página",()=>{
 expect(chipsDaColuna({todas:123,minhas:3,naoLidas:2,prazo:4,fila:9})).toEqual([
 {id:"todas",rotulo:"Todas",tom:"neutro",total:123},{id:"minhas",rotulo:"Minhas",tom:"humano",total:3},{id:"naoLidas",rotulo:"Não lidas",tom:"neutro",total:2},{id:"prazo",rotulo:"Prazo estourado",tom:"sem-resposta",total:4},{id:"fila",rotulo:"Não atribuídas",tom:"neutro",total:9}]);
 expect(chipsDaColuna().map(c=>c.total)).toEqual([0,0,0,0,0]);
});
it("aria-pressed e cor cinza identificam somente chip ativo; contagem mono e pontos semânticos",()=>{
 const h=renderToStaticMarkup(createElement(ChipsFiltro,{chips:chipsDaColuna({todas:123,minhas:3,naoLidas:2,prazo:4,fila:9}),ativo:"todas",filtros:{}}));
 expect(h).toMatch(/aria-pressed="true"[^>]*class="[^"]*bg-highlight/);expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
 for(const c of ['rounded-[20px]','text-[12.5px]','h-[7px]','bg-amber-600','bg-brand-solid','font-mono','123'])expect(h).toContain(c);
 expect(h).toMatch(/<span class="(?=[^"]*font-mono)(?=[^"]*tabular-nums)[^"]*">123<\/span>/);
 expect(renderToStaticMarkup(createElement(ChipsFiltro,{chips:chipsDaColuna(),ativo:null,filtros:{responsavel:"u9"}}))).not.toContain('aria-pressed="true"');
});

it("346 href autorizado do chip prevalece e mantém navegação legada quando ausente",()=>{
 nav.replace.mockClear();const chips=chipsDoInbox({todas:9,ia:3,aprovacao:2,handoff:1,humano:2,semResposta:4,naoAtribuidas:5},{setor:"COMERCIAL",responsavel:"eu"});
 const nodes=elementos(ChipsFiltro({chips,ativo:"handoff",filtros:{setor:"COMERCIAL",responsavel:"eu"}}));
 const botoes=nodes.filter(n=>n.type==="button");(botoes[3].props.onClick as ()=>void)();expect(nav.replace).toHaveBeenLastCalledWith("/inbox?setor=COMERCIAL&resp=eu&aria=handoff");
 const legados=elementos(ChipsFiltro({chips:chipsDaColuna(),ativo:null,filtros:{setor:"COMERCIAL"}})).filter(n=>n.type==="button");(legados[1].props.onClick as ()=>void)();expect(nav.replace).toHaveBeenLastCalledWith("/inbox?setor=COMERCIAL&resp=eu");
});
