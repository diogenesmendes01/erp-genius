import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {ResumoAria} from "./ResumoAria";
import type {AriaNoContato} from "@/server/inbox/painel-atividade-aria";
const dado:AriaNoContato={ultimaAcao:{texto:"Moveu para Qualificado",confianca:77,em:"2026-10-27T12:00Z"},faixa:{executaAPartirDe:75,transfereAbaixoDe:55},etapa:"QUALIFICADO",automatico:["RESPONDER"],comAprovacao:["CRIAR_TAREFA"]};
const h=(d=dado)=>renderToStaticMarkup(createElement(ResumoAria,{dado:d,fuso:"America/Costa_Rica",fusoEscola:"America/Sao_Paulo"}));
it("334 resumo usa rótulos, fuso explícito e confiança além de cor",()=>{
 const s=h();for(const t of["Aria neste contato","Moveu para Qualificado","77%","Confiança alta","27/10/2026, 06:00","Responder","Criar tarefa","Qualificado"])expect(s).toContain(t);
 expect(s).not.toContain("CRIAR_TAREFA");expect(s).not.toContain("QUALIFICADO");
 expect(s).toContain('role="meter"');expect(s).toContain('aria-valuenow="77"');
});
it("334 resumo vazio mantém informação sem fingir última ação",()=>{
 const s=h({...dado,ultimaAcao:null,etapa:null,automatico:[],comAprovacao:[]});expect(s).toContain("Aria ainda não atuou neste contato.");expect(s).not.toContain('role="meter"');expect(s).toContain("nenhuma");
});
it("334 faixa custom publicada muda texto da confiança sem alterar percentual",()=>{
 const s=h({...dado,faixa:{executaAPartirDe:80,transfereAbaixoDe:50}});expect(s).toContain("Confiança média");expect(s).toContain("77%");
});
it.each([[77,"bg-brand-solid"],[60,"bg-amber-600"],[30,"bg-danger"]] as const)("334 barra4px explicita percentual e limites na faixa%j",(confianca,cor)=>{
 const s=h({...dado,ultimaAcao:{...dado.ultimaAcao!,confianca}});expect(s).toContain("h-1");expect(s).toContain(`width:${confianca}%`);expect(s).toContain(cor);expect(s).toContain("aria-valuetext=");expect(s).toContain("75%");expect(s).toContain("55%");
});
it("334 regras usam etapa canônica autorizada e não inventam etapa ausente",()=>{
 expect(h()).toContain("Automático em Qualificado:");const s=h({...dado,etapa:null});expect(s).not.toContain("Automático em");
});