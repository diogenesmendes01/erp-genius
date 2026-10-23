import {afterEach,expect,it,vi} from "vitest";
import {criarGanchos,elementos} from "@/test/tela-sem-dom";
const m=vi.hoisted(()=>({g:null as null|import("@/test/tela-sem-dom").Ganchos,push:vi.fn(),abrir:vi.fn()}));
vi.mock("react",async(original)=>{const real=await original<typeof import("react")>();return{...real,useState:((i:unknown)=>m.g!.useState(i)) as typeof real.useState,useRef:((i:unknown)=>m.g!.useRef(i)) as typeof real.useRef,useCallback:((f:unknown)=>f) as typeof real.useCallback};});
vi.mock("next/navigation",()=>({useRouter:()=>({push:m.push})}));
vi.mock("@/server/whatsapp/operacoes-atendimento",()=>({abrirAtendimentoInstitucional:m.abrir}));
import {NovoAtendimento} from "./NovoAtendimento";
const opcoes={destinos:[{chave:"SECRETARIA:a1",nome:"Secretaria · Ana fictícia",finalidade:"SECRETARIA",alunoId:"a1"}],numeros:[{id:"n1",nome:"Canal fictício",comercial:false}],comercial:false} as Parameters<typeof NovoAtendimento>[0]["opcoes"];
afterEach(()=>{m.g=null;vi.clearAllMocks();});
it("compacto conserva uma action, trava duplo submit e navega uma vez após confirmação",async()=>{
 m.g=criarGanchos();const tela=()=>m.g!.renderizar(NovoAtendimento,{opcoes,compacto:true});let raiz=tela();const campos=elementos(raiz).filter(n=>n.type==="select");
 (campos[0].props.onChange as (e:unknown)=>void)({target:{value:"SECRETARIA:a1"}});(campos[1].props.onChange as (e:unknown)=>void)({target:{value:"n1"}});raiz=tela();
 let concluir!:(r:unknown)=>void;m.abrir.mockReturnValueOnce(new Promise(r=>{concluir=r;}));const forms=elementos(raiz).filter(n=>n.type==="form");expect(forms).toHaveLength(1);const submit=forms[0].props.onSubmit as (e:unknown)=>Promise<void>;
 const primeiro=submit({preventDefault(){}});await submit({preventDefault(){}});expect(m.abrir).toHaveBeenCalledTimes(1);expect(m.abrir.mock.calls[0][0]).toEqual({destinoChave:"SECRETARIA:a1",numeroId:"n1",chaveIdempotencia:expect.any(String)});expect(m.push).not.toHaveBeenCalled();
 concluir({ok:true,dado:{id:"a2"}});await primeiro;expect(m.push).toHaveBeenCalledExactlyOnceWith("/inbox?c=a2");
});
it("resultado incerto conserva chave na repetição e não navega antes do sucesso",async()=>{
 m.g=criarGanchos();const tela=()=>m.g!.renderizar(NovoAtendimento,{opcoes,compacto:true});const submeter=async()=>{const form=elementos(tela()).find(n=>n.type==="form")!;await (form.props.onSubmit as (e:unknown)=>Promise<void>)({preventDefault(){}});};
 m.abrir.mockRejectedValueOnce(new Error("transporte fictício")).mockResolvedValueOnce({ok:true,dado:{id:"a2"}});await submeter();expect(m.push).not.toHaveBeenCalled();await submeter();expect(m.abrir).toHaveBeenCalledTimes(2);expect(m.abrir.mock.calls[1][0].chaveIdempotencia).toBe(m.abrir.mock.calls[0][0].chaveIdempotencia);expect(m.push).toHaveBeenCalledExactlyOnceWith("/inbox?c=a2");
});
