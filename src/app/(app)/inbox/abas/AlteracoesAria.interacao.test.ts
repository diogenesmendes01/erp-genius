import {act,createElement} from "react";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
const {cancelar}=vi.hoisted(()=>({cancelar:vi.fn()}));vi.mock("@/server/aria/acoes",()=>({desfazerSugestaoNoInbox:cancelar}));
vi.mock("@tabler/icons-react",()=>({IconSparkles:()=>null,IconLock:()=>null,IconArrowBackUp:()=>null}));
import {AlteracoesAria} from "./AlteracoesAria";
import type {AlteracaoAriaPainel} from "@/server/inbox/painel-atividade-aria";
const item:AlteracaoAriaPainel={id:"m334",acao:"NOTA_INTERNA",texto:"Criou uma nota",em:"2026-10-27T12:00Z",desfeita:false,podeDesfazer:true,motivoIrreversivel:null};
let root:Root,host:Elemento,pagina:Elemento;const mudar=vi.fn();
const render=(atendimentoId="a334",itens=[item])=>act(async()=>root.render(createElement(AlteracoesAria,{atendimentoId,itens,fuso:"UTC",fusoEscola:"America/Sao_Paulo",aoMudar:mudar})));
function prop(e:Elemento,n:string){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"))!;(e as unknown as Record<string,Record<string,()=>unknown>>)[k][n]();}
const b=(nome:string)=>pagina.querySelectorAll("button").find(e=>e.textContent===nome)!;const abrir=()=>act(async()=>prop(host.querySelectorAll("button").find(e=>e.getAttribute("aria-label")==="Desfazer")!,"onClick"));const clicar=(nome:string)=>act(async()=>prop(b(nome),"onClick"));
beforeEach(async()=>{vi.clearAllMocks();cancelar.mockResolvedValue({ok:true});const d=criarDomMinimo();pagina=d.documento.body;vi.stubGlobal("document",d.documento);vi.stubGlobal("window",d.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=d.documento.createElement("div");pagina.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("334 Desfazer abre confirmação canônica e Voltar não chama action",async()=>{await render();await abrir();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();expect(cancelar).not.toHaveBeenCalled();await clicar("Voltar");expect(cancelar).not.toHaveBeenCalled();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();});
it("334 confirmação trava duplo clique e SSE próprio antes do ACK não perde sucesso",async()=>{let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await act(async()=>{prop(b("Confirmar desfazer alteração"),"onClick");prop(b("Confirmar desfazer alteração"),"onClick");});expect(cancelar).toHaveBeenCalledExactlyOnceWith("a334","m334");await render("a334",[{...item,desfeita:true,podeDesfazer:false}]);await act(async()=>fim({ok:true}));expect(mudar).toHaveBeenCalledOnce();expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();expect(host.textContent).toContain("Alteração da Aria desfeita.");});
it("334 A→B→A invalida ACK e preserva nova abertura",async()=>{let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await clicar("Confirmar desfazer alteração");await render("b334");await render();await abrir();await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();});
it.each(["negocio","transporte"])("334 erro %s fica na confirmação sem retry automático",async tipo=>{if(tipo==="transporte")cancelar.mockRejectedValue(Error("rede"));else cancelar.mockResolvedValue({ok:false,erro:"Alteração mudou334"});await render();await abrir();await clicar("Confirmar desfazer alteração");expect(cancelar).toHaveBeenCalledOnce();expect(mudar).not.toHaveBeenCalled();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();});
it("334 item removido antes do clique fica indisponível, sem chamada silenciosa",async()=>{await render();await abrir();await render("a334",[]);expect(b("Confirmar desfazer alteração").hasAttribute("disabled")).toBe(true);await clicar("Confirmar desfazer alteração");expect(cancelar).not.toHaveBeenCalled();});
it("334 permissão conhecida revogada invalida ACK mesmo após recuperar",async()=>{let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));await render();await abrir();await clicar("Confirmar desfazer alteração");await render("a334",[{...item,podeDesfazer:false}]);await render();await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(host.textContent).not.toContain("Alteração da Aria desfeita.");});
it("334 confirmação aberta mostra texto fresco sem remontar diálogo",async()=>{await render();await abrir();const dialogo=pagina.querySelector('[role="alertdialog"]');await render("a334",[{...item,texto:"Aviso atualizado334"}]);expect(pagina.querySelector('[role="alertdialog"]')).toBe(dialogo);expect(dialogo!.textContent).toContain("Aviso atualizado334");expect(cancelar).not.toHaveBeenCalled();});
it("334 desmontar e reabrir invalida ACK sem fechar a nova confirmação",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));
 await render();await abrir();await clicar("Confirmar desfazer alteração");await act(async()=>root.render(null));await render();await abrir();
 await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(pagina.querySelector('[role="alertdialog"]')).toBeTruthy();
});
it("334 alteração da identidade do alvo invalida ACK mesmo se voltar",async()=>{
 let fim!:(r:{ok:true})=>void;cancelar.mockImplementation(()=>new Promise(r=>fim=r));
 await render();await abrir();await clicar("Confirmar desfazer alteração");await render("a334",[{...item,em:"2026-10-28T12:00Z"}]);await render();
 await act(async()=>fim({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(host.textContent).not.toContain("Alteração da Aria desfeita.");
});
it("334 somente leitura mostra motivo inline e não oferece botão nem expõe IDs",async()=>{
 await render("a334",[{...item,podeDesfazer:false,motivoIrreversivel:"O envio já foi registrado. Histórico preservado."}]);
 expect(host.textContent).toContain("O envio já foi registrado. Histórico preservado.");expect(host.textContent).not.toContain(item.id);expect(host.querySelectorAll("button")).toHaveLength(0);
 await render("a334",[{...item,podeDesfazer:false,motivoIrreversivel:null}]);expect(host.textContent).toContain("Esta alteração não está disponível para desfazer.");
});