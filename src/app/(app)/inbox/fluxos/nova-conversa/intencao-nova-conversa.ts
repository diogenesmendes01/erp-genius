import { executarAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
export type EntradaTelefone = {telefone:string;numeroId:string} & ({modo:"EXISTENTE"}|{modo:"NOVO";ownerId:string;nome?:string});
export type ComandoTelefone = EntradaTelefone & {chaveIdempotencia:string};
type Ack={atendimentoId:string;criado:boolean};
type Estado={comando:ComandoTelefone|null;ocupado:boolean;erro:string|null;incerto:boolean};
export function criarIntencaoNovaConversa(gerar:()=>string=()=>crypto.randomUUID()){
 let estado:Estado={comando:null,ocupado:false,erro:null,incerto:false};const ouvintes=new Set<()=>void>();
 const publicar=(e:Estado)=>{estado=e;for(const ouvir of ouvintes)ouvir();};
 return {
  ler:()=>estado,
  assinar:(fn:()=>void)=>{ouvintes.add(fn);return()=>{ouvintes.delete(fn);};},
  reiniciar:()=>{if(!estado.ocupado&&!estado.incerto)publicar({comando:null,ocupado:false,erro:null,incerto:false});},
  enviar:async(entrada:EntradaTelefone,action:(x:ComandoTelefone)=>Promise<Resultado<Ack>>)=>{
   if(estado.ocupado)return null;
   const comando=estado.comando??Object.freeze({...entrada,chaveIdempotencia:gerar()});
   publicar({...estado,comando,ocupado:true,erro:null});
   const resultado=await executarAcaoCliente(()=>action(comando),{idempotente:true});
   publicar(resultado.tipo==="ok"?{comando:null,ocupado:false,erro:null,incerto:false}:{comando,ocupado:false,erro:resultado.mensagem,incerto:resultado.tipo==="incerto"});
   return resultado;
  },
 };
}
export type IntencaoNovaConversa=ReturnType<typeof criarIntencaoNovaConversa>;