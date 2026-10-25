import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { Resultado } from "@/server/_shared/resultado";
import { useGeracaoInsight,type PortaGeracaoInsight } from "./useGeracaoInsight";

type Props = { atendimentoId?:string;contexto?:string;ativo?:boolean;autorizado?:boolean;podeAtualizar?:boolean;podeRetomar?:boolean;leitura?:PortaGeracaoInsight["leitura"] };
const gerar=vi.fn<(e:{atendimentoId:string;chaveTentativa:string})=>Promise<Resultado<{geracaoId:string}>>>();
const retomar=vi.fn();const recarregar=vi.fn(); let contador=0;
let doc:Documento;let host:Elemento;let root:Root;
const useGeracao = useGeracaoInsight;
function Tela({atendimentoId="A",contexto="pessoa-A",ativo=true,autorizado=true,podeAtualizar=true,podeRetomar=false,leitura}:Props) {
  const c=useGeracao({atendimentoId,contexto,ativo,autorizado,podeAtualizar,gerar,aoSolicitarLeitura:recarregar,novaChave:()=>`t${++contador}`,leitura,podeRetomar,retomarGeracao:retomar});
  return createElement("section",null,
    createElement("button",{onClick:c.atualizar,disabled:c.ocupado},"Atualizar"),
    createElement("p",{"data-erro":""},c.erro),createElement("p",{"data-incerto":""},String(c.incerto)),createElement("p",{"data-aguarda":""},String(c.aguardandoLeitura)),createElement("button",{onClick:()=>c.retomar({atendimentoId,geracaoId:"g1",versaoEsperada:0,contextoAtualEsperadoHash:contexto})},"Retomar"));
}
async function montar(p:Props={}) {
  await act(async()=>root.render(createElement(Tela,p)));
}
const clicar=()=>act(async()=>{const b=host.querySelector("button")!;const p=Object.keys(b).find(k=>k.startsWith("__reactProps"))!;(b as unknown as Record<string,{onClick:()=>Promise<void>}>)[p].onClick();});
let resolver:(r:Resultado<{geracaoId:string}>)=>void;
beforeEach(async()=>{vi.clearAllMocks();recarregar.mockReset();retomar.mockReset();contador=0;gerar.mockResolvedValue({ok:true,dado:{geracaoId:"g1"}});const d=criarDomMinimo();doc=d.documento;vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",d.MutationObserver);host=doc.createElement("div");doc.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
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
it("NAO_CONFIRMADA bloqueia novo clique e pede GET da mesma geração",async()=>{
  recarregar.mockReturnValue(1);gerar.mockResolvedValueOnce({ok:true,dado:{geracaoId:"g1",statusPersistencia:"NAO_CONFIRMADA",resultadoIncerto:true}} as Resultado<{geracaoId:string}>);
  await montar();await clicar();expect(recarregar).toHaveBeenCalledExactlyOnceWith("g1");expect(host.querySelector('[data-incerto]')?.textContent).toBe("true");expect(host.querySelector('[data-aguarda]')?.textContent).toBe("true");await clicar();expect(gerar).toHaveBeenCalledOnce();
});
it("GET anterior ou de outra geração não resolve recibo incerto",async()=>{
  recarregar.mockReturnValue(2);gerar.mockResolvedValueOnce({ok:true,dado:{geracaoId:"g1",statusPersistencia:"NAO_CONFIRMADA"}} as Resultado<{geracaoId:string}>);await montar();await clicar();
  await montar({leitura:{solicitacao:1,status:200,observada:{geracaoId:"g1",estado:"PRONTA",versao:2,iniciada:true}}});expect(host.querySelector('[data-aguarda]')?.textContent).toBe("true");
  await montar({leitura:{solicitacao:2,status:200,observada:{geracaoId:"outra",estado:"PRONTA",versao:2,iniciada:true}}});expect(host.querySelector('[data-incerto]')?.textContent).toBe("true");
});
it.each(["PRONTA","FALHOU","RECUSADA"])("GET novo terminal%s resolve metadata sem repetir provider",async estado=>{
  recarregar.mockReturnValue(1);gerar.mockResolvedValueOnce({ok:true,dado:{geracaoId:"g1",statusPersistencia:"NAO_CONFIRMADA"}} as Resultado<{geracaoId:string}>);await montar();await clicar();
  await montar({leitura:{solicitacao:1,status:200,observada:{geracaoId:"g1",estado,versao:2,iniciada:true}}});expect(host.querySelector('[data-incerto]')?.textContent).toBe("false");expect(host.querySelector('[data-aguarda]')?.textContent).toBe("false");expect(gerar).toHaveBeenCalledOnce();
});
it("GET novo PROCESSANDO iniciado permite só resolução explícita, não novoSTART",async()=>{
  recarregar.mockReturnValue(1);gerar.mockResolvedValueOnce({ok:true,dado:{geracaoId:"g1",statusPersistencia:"NAO_CONFIRMADA"}} as Resultado<{geracaoId:string}>);await montar();await clicar();
  await montar({leitura:{solicitacao:1,status:200,observada:{geracaoId:"g1",estado:"PROCESSANDO",versao:1,iniciada:true}}});expect(host.querySelector('[data-aguarda]')?.textContent).toBe("false");expect(host.querySelector('[data-incerto]')?.textContent).toBe("true");await clicar();expect(gerar).toHaveBeenCalledOnce();
});it("retomada explícita usa mesma geração/versão/hash sem criar intenção nova",async()=>{
  retomar.mockResolvedValue({ok:true,dado:{geracaoId:"g1",statusPersistencia:"CONFIRMADA"}});await montar({podeAtualizar:false,podeRetomar:true});const b=host.querySelectorAll("button")[1];await act(async()=>{const p=Object.keys(b).find(k=>k.startsWith("__reactProps"))!;(b as unknown as Record<string,{onClick:()=>Promise<void>}>)[p].onClick();});expect(retomar).toHaveBeenCalledExactlyOnceWith({atendimentoId:"A",geracaoId:"g1",versaoEsperada:0,contextoAtualEsperadoHash:"pessoa-A"});expect(gerar).not.toHaveBeenCalled();
});