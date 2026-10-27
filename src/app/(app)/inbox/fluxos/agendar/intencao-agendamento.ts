import type {Resultado} from "@/server/_shared/resultado";
import {executarAcaoCliente,type DesfechoAcao} from "@/lib/acao-cliente";
export type EntradaAgendamento={atendimentoId:string;quandoLocal:string;fuso:string}&({tipo:"CRIAR";texto:string}|{tipo:"EDITAR";intencaoId:string;texto:string});
export type ComandoAgendamento=EntradaAgendamento&{chaveIdempotencia:string};
export type AlvoAgendamento={atendimentoId:string}&({tipo:"CRIAR"}|{tipo:"EDITAR";intencaoId:string});
type Estado=Readonly<{comando:ComandoAgendamento|null;ocupado:boolean;erro:string|null;incerto:boolean}>;
export type IntencaoAgendamento={ler():Estado;assinar(f:()=>void):()=>void;reiniciar():void;enviar(e:EntradaAgendamento,action:(c:ComandoAgendamento)=>Promise<Resultado<{id:string}>>):Promise<DesfechoAcao<{id:string}>|null>};
export type IntencoesAgendamento={para(alvo:AlvoAgendamento):IntencaoAgendamento;pendente(atendimentoId:string):{alvo:AlvoAgendamento;intencao:IntencaoAgendamento}|null};
function identidade(alvo:AlvoAgendamento){return JSON.stringify([alvo.atendimentoId,alvo.tipo,alvo.tipo==="EDITAR"?alvo.intencaoId:null]);}
export function criarIntencoesAgendamento(gerar:()=>string=()=>crypto.randomUUID()):IntencoesAgendamento{
 const porAlvo=new Map<string,IntencaoAgendamento>(),alvos=new Map<string,AlvoAgendamento>();
 return {para(alvo){const chave=identidade(alvo),anterior=porAlvo.get(chave);if(anterior)return anterior;
  let estado:Estado=Object.freeze({comando:null,ocupado:false,erro:null,incerto:false});const ouvintes=new Set<()=>void>();
  const publicar=(e:Estado)=>{estado=Object.freeze(e);for(const ouvir of ouvintes)ouvir();};
  const intencao:IntencaoAgendamento={ler:()=>estado,assinar:f=>{ouvintes.add(f);return()=>{ouvintes.delete(f);};},
   reiniciar(){if(!estado.ocupado&&!estado.incerto)publicar({comando:null,ocupado:false,erro:null,incerto:false});},
   async enviar(entrada,action){if(estado.ocupado)return null;
    if(identidade(entrada)!==chave){const mensagem="O atendimento ou agendamento mudou. Reabra a operação.";publicar({...estado,erro:mensagem});return {tipo:"erro",mensagem};}
    const eraIncerto=estado.incerto;const comando=estado.comando??Object.freeze({...entrada,chaveIdempotencia:gerar()});publicar({comando,ocupado:true,erro:null,incerto:estado.incerto});
    const resultado=await executarAcaoCliente(()=>action(comando),{idempotente:true});
    publicar(resultado.tipo==="ok"?{comando:null,ocupado:false,erro:null,incerto:false}:{comando,ocupado:false,erro:resultado.mensagem,incerto:eraIncerto||resultado.tipo==="incerto"});
    return resultado;
   },
  };porAlvo.set(chave,intencao);alvos.set(chave,Object.freeze({...alvo}));return intencao;
 },pendente(atendimentoId){for(const [chave,intencao] of porAlvo){const alvo=alvos.get(chave),e=intencao.ler();if(alvo?.atendimentoId===atendimentoId&&(e.ocupado||e.incerto))return {alvo,intencao};}return null;}};
}