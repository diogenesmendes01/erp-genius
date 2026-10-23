import { DriverWhatsApp } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn()}),usePathname:()=>"/inbox"}));
import { ColunaConversas, ehAtalhoBusca, type PropsColunaConversas } from "./ColunaConversas";
const item:ItemListaInbox={id:"a1",numeroId:"n1",numeroRotulo:"Central",finalidade:"COMERCIAL",driver:DriverWhatsApp.META_CLOUD,contatoId:"c1",contatoNome:"Ana",contatoTelefone:"+5500000000301",optOut:false,vinculo:null,naoLidas:2,ultimaMensagemEm:null,preview:"Oi",linhaComercial:false,status:"EM_ATENDIMENTO",responsavelNome:null,prazoRespostaEm:null,fixada:false,silenciada:false,grupo:false,responsavelId:null,numeroDonoId:null,setoresDoNumero:["COMERCIAL"],atendimentoOrigemId:null,capacidades:[]};
const html=(extra:Partial<PropsColunaConversas>={})=>renderToStaticMarkup(createElement(ColunaConversas,{filtros:{},itens:[item],proximo:null,selecionado:null,aoSelecionar(){},aoCarregarMais(){},aoNovaConversa(){},usuarioId:"u1",podeGerenciarNumeros:false,fuso:null,...extra}));
it("coluna mantém busca/chips/lista mesmo sem opções e usa agregado real",()=>{
 const h=html({contagens:{todas:123,minhas:3,naoLidas:2,prazo:4,fila:9}});
 for(const t of ['Conversas','placeholder="Buscar conversas e contatos"','⌘K','aria-label="Filtros"','aria-label="Nova conversa"','Não atribuídas','Ana','text-xl font-semibold','h-[38px]','rounded-item','123'])expect(h).toContain(t);
 expect(h).not.toContain('data-faixa-aria');expect(h).not.toContain('Todos os números');
 expect(html({faixaAria:createElement("div",{"data-faixa-aria":""})})).toContain('data-faixa-aria');
});
it("setor/status viram removíveis com selo2, preservando lista e seletorD17",()=>{
 const h=html({filtros:{setor:"FINANCEIRO",status:"ENCERRADO"},opcoesFiltro:{setores:["FINANCEIRO"],numeros:[{id:"n1",rotulo:"Central",saude:"conectado"}]}});
 for(const t of ['aria-label="Remover filtro Financeiro"','aria-label="Remover filtro Encerrado"','Todos os números · 1 conectado','Limpar'])expect(h).toContain(t);
 expect(h).toMatch(/aria-label="Filtros"[\s\S]*?>2</);
});
it("SSR de lista usa o mesmo instante serializado mesmo com relógio cliente posterior",()=>{
 const T=Date.UTC(2026,9,22,12);vi.useFakeTimers({toFake:["Date"]});try{vi.setSystemTime(T+60_000);const h=html({agoraInicial:T,itens:[{...item,prazoRespostaEm:new Date(T-29*60_000).toISOString()}]});expect(h).toContain("29 min");expect(h).not.toContain("30 min");}finally{vi.useRealTimers();}
});
it("atalho exigeCtrl/MetaK e não captura composição,Alt ou evento já consumido",()=>{
 expect(ehAtalhoBusca({key:"k",metaKey:true,ctrlKey:false})).toBe(true);expect(ehAtalhoBusca({key:"K",metaKey:false,ctrlKey:true})).toBe(true);
 for(const f of [{key:"j",metaKey:true,ctrlKey:false},{key:"k",metaKey:false,ctrlKey:false},{key:"k",metaKey:false,ctrlKey:true,isComposing:true},{key:"k",metaKey:false,ctrlKey:true,altKey:true},{key:"k",metaKey:true,ctrlKey:false,defaultPrevented:true}])expect(ehAtalhoBusca(f)).toBe(false);
});
