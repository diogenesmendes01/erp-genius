import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { Resultado } from "@/server/_shared/resultado";
import { useGeracaoInsight } from "./useGeracaoInsight";

type Props = { atendimentoId?:string;contexto?:string;ativo?:boolean;autorizado?:boolean;podeAtualizar?:boolean };
const gerar=vi.fn<(e:{atendimentoId:string;chaveTentativa:string})=>Promise<Resultado<{geracaoId:string}>>>();
const recarregar=vi.fn(); let contador=0;
let doc:Documento;let host:Elemento;let root:Root;
const useGeracao = useGeracaoInsight;
function Tela({atendimentoId="A",contexto="pessoa-A",ativo=true,autorizado=true,podeAtualizar=true}:Props) {
  const c=useGeracao({atendimentoId,contexto,ativo,autorizado,podeAtualizar,gerar,aoSolicitarLeitura:recarregar,novaChave:()=>`t${++contador}`});
  return createElement("section",null,
    createElement("button",{onClick:c.atualizar,disabled:c.ocupado},"Atualizar"),
    createElement("p",{"data-erro":""},c.erro),createElement("p",{"data-incerto":""},String(c.incerto)));
}
async function montar(p:Props={}) {
  await act(async()=>root.render(createElement(Tela,p)));
}
const clicar=()=>act(async()=>{const b=host.querySelector("button")!;const p=Object.keys(b).find(k=>k.startsWith("__reactProps"))!;(b as unknown as Record<string,{onClick:()=>Promise<void>}>)[p].onClick();});
let resolver:(r:Resultado<{geracaoId:string}>)=>void;
beforeEach(async()=>{vi.clearAllMocks();contador=0;gerar.mockResolvedValue({ok:true,dado:{geracaoId:"g1"}});const d=criarDomMinimo();doc=d.documento;vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",d.MutationObserver);host=doc.createElement("div");doc.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("não gera no mount nem em refresh de leitura",async()=>{await montar();await montar({podeAtualizar:false});expect(gerar).not.toHaveBeenCalled();});
it("clique explícito usa chave única e pede leitura depois do ACK",async()=>{await montar();await clicar();expect(gerar).toHaveBeenCalledExactlyOnceWith({atendimentoId:"A",chaveTentativa:"t1"});expect(recarregar).toHaveBeenCalledOnce();});
it("duplo clique durante execução chama apenas uma vez",async()=>{gerar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar();await clicar();expect(gerar).toHaveBeenCalledOnce();await act(async()=>resolver({ok:true,dado:{geracaoId:"g1"}}));expect(recarregar).toHaveBeenCalledOnce();});
it("SSE próprio PROCESSANDO antes do ACK não invalida intenção nem gera novamente",async()=>{gerar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar();await montar({podeAtualizar:false});expect(recarregar).not.toHaveBeenCalled();await act(async()=>resolver({ok:true,dado:{geracaoId:"g1"}}));expect(recarregar).toHaveBeenCalledOnce();expect(gerar).toHaveBeenCalledOnce();});
it.each([
  [{atendimentoId:"B"},{}], [{contexto:"outraPessoa"},{}], [{autorizado:false},{}], [{ativo:false},{}],
])("ACK antigo não atravessa perda de identidade/capacidade/abertura %j",async(primeiro,segundo)=>{gerar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar();await montar(primeiro);await montar(segundo);await act(async()=>resolver({ok:true,dado:{geracaoId:"antiga"}}));expect(recarregar).not.toHaveBeenCalled();});
it("erro conhecido é exibido e nova intenção manual recebe nova chave",async()=>{gerar.mockResolvedValueOnce({ok:false,erro:"Orçamento esgotado."});await montar();await clicar();expect(host.querySelector('[data-erro]')?.textContent).toBe("Orçamento esgotado.");await clicar();expect(gerar).toHaveBeenNthCalledWith(2,{atendimentoId:"A",chaveTentativa:"t2"});});
it("transporte incerto não dispara retry nem libera novo clique nesta abertura",async()=>{gerar.mockRejectedValueOnce(new Error("rede"));await montar();await clicar();expect(host.querySelector('[data-incerto]')?.textContent).toBe("true");await clicar();expect(gerar).toHaveBeenCalledOnce();expect(recarregar).toHaveBeenCalledOnce();});
it("sem autorização/atualização ou aba fechada não chama a porta",async()=>{await montar({autorizado:false});await clicar();await montar({podeAtualizar:false});await clicar();await montar({ativo:false});await clicar();expect(gerar).not.toHaveBeenCalled();});
it("unmount não recebe leitura/feedback tardio",async()=>{gerar.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar();await act(async()=>root.unmount());await act(async()=>resolver({ok:true,dado:{geracaoId:"g1"}}));expect(recarregar).not.toHaveBeenCalled();const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
