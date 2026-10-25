import {createElement,isValidElement,type ReactNode} from "react";
import Link from "next/link";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import type {SituacaoAriaInbox} from "@/server/inbox/contagens";
import {FaixaAriaAtiva} from "./FaixaAriaAtiva";
import {BASE_BOTAO} from "@/components/Botao";
const montar=(s:Partial<SituacaoAriaInbox>={},contagens={ia:3,aprovacao:1,handoff:1})=>renderToStaticMarkup(createElement(FaixaAriaAtiva,{situacao:{estado:"ATIVA",pausada:false,podeGerenciar:false,...s},contagens}));
const texto=(s:string)=>s.replace(/<[^>]*>/g,"");
it("ativa_com_contagens",()=>{const h=montar();expect(texto(h)).toContain("Aria ativa3 em atendimento · 2 aguardando você");expect(h.match(/class="font-mono tabular-nums"/g)).toHaveLength(2);expect(h).toContain('role="status"');});
it("zero é contado e handoff sozinho compõe aguardando você",()=>{expect(texto(montar({}, {ia:0,aprovacao:0,handoff:7}))).toContain("0 em atendimento · 7 aguardando você");});
it("pausada_e_shadow · pausa",()=>{const h=texto(montar({pausada:true}));expect(h).toContain("Aria pausadaPausada · novas conversas vão para a equipe");expect(h).not.toContain("em atendimento");});
it.each([false,true])("pausada_e_shadow · shadow com pausada=%s",pausada=>{const h=texto(montar({estado:"SHADOW",pausada}));expect(h).toContain("Aria em ensaioSimula respostas sem falar com os contatos");expect(h).not.toContain("em atendimento");});
it.each([false,true])("desligada_nao_renderiza · pausada=%s",pausada=>expect(montar({estado:"DESLIGADA",pausada,podeGerenciar:true})).toBe(""));
it("D4 interruptor só para quem pode pausar, com estado global atual",()=>{for(const estado of ["ATIVA","SHADOW"] as const){expect(montar({estado,podeGerenciar:true})).toContain('role="switch"');expect(montar({estado,podeGerenciar:false})).not.toContain('role="switch"');expect(montar({estado,podeGerenciar:true,pausada:true})).toContain('aria-checked="false"');}expect(montar({estado:"DESLIGADA",podeGerenciar:true})).toBe("");});
it("gerenciar_so_para_quem_pode_pausar",()=>{expect(montar({podeGerenciar:true})).toMatch(/<a[^>]*href="\/aria"[^>]*>Gerenciar<\/a>/);expect(montar({podeGerenciar:false})).not.toContain('href="/aria"');});
it("Gerenciar mantém aparência AI no botão canônico sem redefinir sua superfície",()=>{const h=montar({podeGerenciar:true});const link=h.match(/<a[^>]*>Gerenciar<\/a>/)?.[0];expect(link).toContain(BASE_BOTAO);expect(link).toContain("text-ai-700 hover:bg-highlight");expect(link).toContain("px-3 py-1 text-xs");});
it("usa tokens e dimensões originais com corpo flexível e ícone decorativo",()=>{const h=montar({podeGerenciar:true});for(const c of ["mx-[18px]","mb-3","rounded-[10px]","bg-ai-50","h-7","w-7","rounded-lg","bg-ai-solid","text-[13px]","font-semibold","text-xs","text-gray-600","min-w-0","text-ai-700"])expect(h).toContain(c);expect(h).toContain('aria-hidden="true"');});
it("anuncia somente o título de estado, sem repetir contagens na região viva",()=>{
 for(const contagens of [{ia:3,aprovacao:1,handoff:1},{ia:8,aprovacao:3,handoff:2}]){const h=montar({},contagens);const status=h.match(/<p role="status"[^>]*>(.*?)<\/p>/)?.[1];expect(status).toBe("Aria ativa");expect(h).toContain(String(contagens.ia)+"</span> em atendimento");}
 expect(montar({pausada:true})).toMatch(/<p role="status"[^>]*>Aria pausada<\/p>/);
 expect(montar({estado:"SHADOW"})).toMatch(/<p role="status"[^>]*>Aria em ensaio<\/p>/);
});
it("Gerenciar usa NextLink real sem prefetch para preservar navegação e não antecipar rede",()=>{
 function encontrar(n:ReactNode):{href?:string;prefetch?:boolean}|undefined {if(Array.isArray(n)){for(const c of n){const p=encontrar(c);if(p)return p;}return;}if(!isValidElement<{children?:ReactNode;href?:string;prefetch?:boolean}>(n))return;if(n.type===Link)return n.props;return encontrar(n.props.children);}
 const situacao={estado:"ATIVA" as const,pausada:false,podeGerenciar:true};
 const link=encontrar(FaixaAriaAtiva({situacao,contagens:{ia:3,aprovacao:1,handoff:1}}));
 expect(link?.href).toBe("/aria");expect(link?.prefetch).toBe(false);
 expect(encontrar(FaixaAriaAtiva({situacao:{...situacao,podeGerenciar:false},contagens:{ia:3,aprovacao:1,handoff:1}}))).toBeUndefined();
});
it.each([{estado:"ATIVA" as const,pausada:false},{estado:"ATIVA" as const,pausada:true},{estado:"SHADOW" as const,pausada:false}])("R2 faixa é região nomeada, com somente título vivo: %j",situacao=>{
 const h=montar(situacao);expect(h).toMatch(/^<div role="region" aria-label="Situação da Aria"/);expect(h.match(/role="region"/g)).toHaveLength(1);expect(h.match(/role="status"/g)).toHaveLength(1);
});
