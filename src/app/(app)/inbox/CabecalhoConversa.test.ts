import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { elementos } from "@/test/tela-sem-dom";
import { MenuConversa } from "./MenuConversa";
import { CabecalhoConversa, type PropsCabecalhoConversa } from "./CabecalhoConversa";
const at = {id:"a",contatoId:"c",contatoNome:"Pessoa fictícia de nome extenso",finalidade:"COMERCIAL",numeroRotulo:"Central da escola",status:"EM_ATENDIMENTO",responsavelId:"u",responsavelNome:"Camila",grupo:false};
const h=(o:Partial<PropsCabecalhoConversa>={})=>renderToStaticMarkup(createElement(CabecalhoConversa,{atendimento:at,usuarioId:"u",acoes:{assumir:{rotulo:"Assumir conversa",aoEscolher(){}},transferir:{rotulo:"Transferir",aoEscolher(){}},menu:[],dialogos:null,feedback:null,abrirAgendar:null},painelAberto:false,painelAuto:true,aoAlternarPainel(){},aoBuscar(){},buscaAberta:false,aoVoltar(){},...o} as PropsCabecalhoConversa));
describe("cabeçalho315",()=>{
 it.each([
  ["ABERTO_SEM_RESPONSAVEL", "Na fila"],
  ["EM_ATENDIMENTO", "Em atendimento"],
  ["AGUARDANDO_CLIENTE", "Aguardando cliente"],
  ["ENCERRADO", "Encerrado"],
 ])("traduz %s antes de imprimir o título e o texto do selo",(status,rotulo)=>{
  const html=h({atendimento:{...at,status} as PropsCabecalhoConversa["atendimento"]});
  expect(html).toContain(`title="${rotulo}"`);
  expect(html).toContain(`<span class="truncate">${rotulo}</span>`);
  expect(html).not.toContain(status);
 });
 it("68px e identidade com o estado puro do ERP",()=>{
  const html=h(); for(const x of ["h-[68px]","h-10","text-[15px]","font-semibold","Em atendimento","Você está atendendo","Comercial · Central da escola"]) expect(html).toContain(x);
  expect(html).toContain("truncate"); expect(html).not.toMatch(/<span[^>]*max-\[699px\]:hidden[^>]*>Em atendimento/); expect(html).not.toContain("Status da conversa");
 });
 it("voltar continua na vista única até960; alvo móvel não diminui",()=>{
  const html=h(); expect(html).toMatch(/aria-label="Voltar para a lista"[^>]*min-\[960px\]:hidden/);
  expect(html).toContain("max-sm:min-h-11"); expect(html).toContain("min-[1200px]:[@container(min-width:576px)]:inline");
 });
 it("busca316 ligada e painel efetivo único com corte1400",()=>{
  const html=h(); expect(html).not.toMatch(/disabled=""[^>]*aria-label="Buscar na conversa"|aria-label="Buscar na conversa"[^>]*disabled=""/);
  expect(html).not.toContain("Em breve"); expect(html).toContain('aria-controls="painel-contato"');
  expect(html).toContain("min-[1400px]:bg-gray-100"); expect(h({painelAberto:true})).toContain('aria-pressed="true"');
 });
 it("não fabrica ações para grupo nem ausência de capacidade",()=>{
  const html=h({atendimento:{...at,grupo:true} as PropsCabecalhoConversa["atendimento"],acoes:{assumir:null,transferir:null,menu:[],dialogos:null,feedback:null,abrirAgendar:null}});
  expect(html).toContain("Conversa em grupo"); expect(html).not.toContain("Assumir"); expect(html).not.toContain("Transferir");
 });
});

it("rótulos consideram largura útil local sem alterar shell ou nomes acessíveis",()=>{
 const html=h(); expect(html).toContain("[container-type:inline-size]");
 expect(html).toContain("[@container(min-width:576px)]"); expect(html).toContain("[@container(min-width:432px)]");
 expect(html).toContain('title="Transferir"'); expect(html).toContain('title="Assumir conversa"');
});

it("348 linha autorizada e slot de ação preservam header68 e subtítulo",()=>{
 const html=h({linhaAria:{tom:"handoff",texto:"Aria pediu um humano",dica:"Aria pausada · Transferido para humano"},acoesAria:createElement("button",null,"Devolver teste")});
 expect(html).toContain("Aria pediu um humano");expect(html).toContain('title="Aria pausada · Transferido para humano"');expect(html).toContain("Devolver teste");expect(html).toContain("Comercial · Central da escola");expect(html).toContain("h-[68px]");expect(html).toContain("text-red-700");
});

it("agrupa as ações principais com seus handlers e mantém Mais ações separado",()=>{
 const transferir=vi.fn(),assumir=vi.fn(),devolver=vi.fn(),painel=vi.fn(),buscar=vi.fn();
 const tree=CabecalhoConversa({atendimento:at as PropsCabecalhoConversa["atendimento"],usuarioId:"u",acoes:{assumir:{rotulo:"Assumir conversa",aoEscolher:assumir},transferir:{rotulo:"Transferir",aoEscolher:transferir},menu:[],dialogos:null,feedback:null,abrirAgendar:null},linhaAria:{tom:"handoff",texto:"Aria pediu um humano",dica:null},acoesAria:createElement("button",{"aria-label":"Devolver para Aria",onClick:devolver},"Devolver"),painelAberto:false,painelAuto:false,aoAlternarPainel:painel,aoBuscar:buscar,buscaAberta:false,aoVoltar(){}});
 const group=elementos(tree).find(n=>n.props.role==="group"&&n.props["aria-label"]==="Ações principais da conversa");
 expect(group).toBeDefined();
 if(!isValidElement<{children:ReactNode}>(group))throw new Error("Grupo de ações não é um elemento React.");
 const actions=elementos(group.props.children);
 for(const handler of [transferir,assumir,devolver,painel,buscar]){
  const button=actions.find(n=>n.props.onClick===handler);expect(button).toBeDefined();
  (button!.props.onClick as ()=>void)();expect(handler).toHaveBeenCalledOnce();
 }
 expect(actions.some(n=>n.type===MenuConversa)).toBe(false);
 expect(elementos(tree).filter(n=>n.type===MenuConversa)).toHaveLength(1);
});
