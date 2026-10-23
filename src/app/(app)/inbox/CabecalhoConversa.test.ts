import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabecalhoConversa, type PropsCabecalhoConversa } from "./CabecalhoConversa";
const at = {id:"a",contatoId:"c",contatoNome:"Pessoa fictícia de nome extenso",finalidade:"COMERCIAL",numeroRotulo:"Central da escola",status:"EM_ATENDIMENTO",responsavelId:"u",responsavelNome:"Camila",grupo:false};
const h=(o:Partial<PropsCabecalhoConversa>={})=>renderToStaticMarkup(createElement(CabecalhoConversa,{atendimento:at,usuarioId:"u",acoes:{assumir:{rotulo:"Assumir conversa",aoEscolher(){}},transferir:{rotulo:"Transferir",aoEscolher(){}},menu:[],dialogos:null,feedback:null,abrirAgendar:null},painelAberto:false,painelAuto:true,aoAlternarPainel(){},aoBuscar(){},buscaAberta:false,aoVoltar(){},...o} as PropsCabecalhoConversa));
describe("cabeçalho315",()=>{
 it("68px e identidade com o estado puro do ERP",()=>{
  const html=h(); for(const x of ["h-[68px]","h-10","text-[15px]","font-semibold","Em atendimento","Você está atendendo","Comercial · Central da escola"]) expect(html).toContain(x);
  expect(html).toContain("truncate"); expect(html).not.toMatch(/<span[^>]*max-\[699px\]:hidden[^>]*>Em atendimento/); expect(html).not.toContain("Status da conversa");
 });
 it("voltar continua na vista única até960; alvo móvel não diminui",()=>{
  const html=h(); expect(html).toMatch(/aria-label="Voltar para a lista"[^>]*min-\[960px\]:hidden/);
  expect(html).toContain("max-sm:min-h-11"); expect(html).toContain("min-[1200px]:[@container(min-width:576px)]:inline");
 });
 it("busca indisponível até316 e painel efetivo único com corte1400",()=>{
  const html=h(); expect(html).toMatch(/disabled=""[^>]*aria-label="Buscar na conversa"|aria-label="Buscar na conversa"[^>]*disabled=""/);
  expect(html).toContain("Em breve"); expect(html).toContain('aria-controls="painel-contato"');
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
