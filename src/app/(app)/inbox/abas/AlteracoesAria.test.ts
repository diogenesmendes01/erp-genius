import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("@/server/aria/acoes",()=>({desfazerSugestaoNoInbox:vi.fn()}));
import {AlteracoesAria} from "./AlteracoesAria";
import type {AlteracaoAriaPainel} from "@/server/inbox/painel-atividade-aria";
const item:AlteracaoAriaPainel={id:"registro-interno334",acao:"TAG",texto:"Adicionou a tag Interesse",em:"2026-10-25T12:00Z",desfeita:false,podeDesfazer:true,motivoIrreversivel:null};
const h=(itens=[item])=>renderToStaticMarkup(createElement(AlteracoesAria,{itens,atendimentoId:"atendimento-interno334",fuso:"UTC",fusoEscola:"America/Sao_Paulo",aoMudar(){}}));
it("334 texto desfeito tem opacidade0,5/riscado e meta Desfeito antes da hora",()=>{
 const s=h([{...item,desfeita:true,podeDesfazer:false}]);expect(s).toContain("line-through opacity-50");expect(s).toContain("Desfeito · 25/10/2026, 12:00");expect(s).not.toContain('aria-label="Desfazer"');
});
it("334 introdução explica limites e vazio usa texto da issue",()=>{
 const s=h([]);expect(s).toContain("Tudo que Aria fez neste contato.");expect(s).toContain("Desfazer restaura o valor anterior.");expect(s).toContain("handoffs já comunicados ao lead");expect(s).toContain("Aria ainda não alterou nada neste contato.");expect(s).toContain('data-estado-vazio=""');
});
it("334 ação autorizada tem ícone de retorno e IDs nunca viram texto",()=>{
 const s=h();expect(s).toContain("tabler-icon-arrow-back-up");expect(s).toContain(">Desfazer</button>");expect(s).not.toContain(item.id);expect(s).not.toContain("atendimento-interno334");
});