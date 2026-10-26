import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {OutrasOportunidades,situacaoOutra,hrefNovaOportunidade} from "./OutrasOportunidades";
const props={outras:[{id:"op/2",titulo:"Francês A1 · Semestral",etapa:"MATRICULADO" as const,valor:"0.00",moeda:"BRL"}],pessoaId:"p&8",podeCriar:true,verContato:true,podeAbrirFunil:true};
const h=(p:Partial<Parameters<typeof OutrasOportunidades>[0]>={})=>renderToStaticMarkup(createElement(OutrasOportunidades,{...props,...p}));
it("situações usam rótulos de etapa e distinguem encerradas",()=>{expect(situacaoOutra("MATRICULADO")).toBe("Ganha");expect(situacaoOutra("PERDIDO")).toBe("Perdida");expect(situacaoOutra("QUALIFICADO")).toBe("Qualificado · em aberto");});
it("links codificam somente IDs, valor zero é exibido e ícone vem do Tabler real",()=>{const t=h();expect(t).toContain('href="/funil?o=op%2F2"');expect(t).toContain('href="/contatos?c=p%268"');expect(t).toContain('href="/funil?nova=p%268"');expect(t).toContain('tabler-icon-briefcase');expect(t).toContain("R$ 0,00");expect(hrefNovaOportunidade("p?nome=segredo")).toBe("/funil?nova=p%3Fnome%3Dsegredo");});
it("vazio, valor indefinido e capacidades são independentes",()=>{expect(h({outras:[]})).toContain("Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade.");expect(h({outras:[{...props.outras[0],valor:null,moeda:null}]})).toContain("Sem valor");const t=h({podeCriar:false,verContato:false,podeAbrirFunil:false});expect(t).not.toContain('<a');expect(t).toContain("Francês A1");});
it("Nova exige Pessoa e alçada; abrir o Funil não concede criação ou contato",()=>{expect(h({pessoaId:null})).not.toContain('nova=');expect(h({podeCriar:false})).not.toContain('nova=');const t=h({podeCriar:false,verContato:false});expect(t).toContain('o=op%2F2');expect(t).not.toContain('/contatos');});

it.each([
 ["EM_ATENDIMENTO","Primeiro contato · em aberto"],
 ["EXPERIMENTAL_AGENDADA","Experimental agendada · em aberto"],
 ["EXPERIMENTAL_REALIZADA","Experimental realizada · em aberto"],
 ["AGUARDANDO_MATRICULA","Aguardando matrícula · em aberto"],
] as const)("a linha de outra oportunidade %s usa situação editorial central",(etapa,texto)=>{
 expect(h({outras:[{...props.outras[0],etapa}]})).toContain(texto);
});
