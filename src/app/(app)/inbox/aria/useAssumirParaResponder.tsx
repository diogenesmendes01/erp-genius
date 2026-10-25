"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject}from"react";
import{Botao}from"@/components/Botao";
import{FeedbackAcao}from"@/components/FeedbackAcao";
import{useAcaoCliente}from"@/lib/acao-cliente";
import{assumirConversaDaAria}from"@/server/whatsapp/acoes-atendimento";
import type{EstadoAria}from"@/server/inbox/estado-aria-valores";
import type{ControleResposta}from"../RodapeConversa";
import type{LeituraPainelHandoff}from"./useHandoffConversa";
import{modoRodape}from"./modo-rodape";
export interface PropsAssumirParaResponder {atendimentoId:string;usuarioId:string;responsavelId:string|null;estadoAria:EstadoAria|null;podeAssumirAria:boolean;podeEnviar:boolean|null;leitura?:LeituraPainelHandoff;aoMudar():void;controleResposta:RefObject<ControleResposta|null>}
type Sessao={ativa:boolean;emCurso:boolean;ack:boolean;minimo:number;token:symbol};
const useLayoutCliente=typeof window==="undefined"?useEffect:useLayoutEffect;
export function useAssumirParaResponder(props:PropsAssumirParaResponder){
 const acao=useAcaoCliente({idempotente:true});
 const chave=JSON.stringify([props.atendimentoId,props.usuarioId,props.podeAssumirAria,props.podeEnviar]);
 const[geracao,setGeracao]=useState(()=>({chave,token:Symbol("resposta")}));
 if(geracao.chave!==chave)setGeracao({chave,token:Symbol("resposta")});
 const ciclo=useRef({ativo:false,token:geracao.token}),atual=useRef(props),sessao=useRef<Sessao|null>(null),campo=useRef<HTMLTextAreaElement|null>(null);
 const focoPendente=useRef<symbol|null>(null);
 const[visual,setVisual]=useState<{token:symbol;aguardando:boolean;retry:boolean;erro:string|null}|null>(null);
 const aoCampoResponder=useCallback((no:HTMLTextAreaElement|null)=>{campo.current=no;if(no&&focoPendente.current===ciclo.current.token&&ciclo.current.ativo){focoPendente.current=null;no.focus({preventScroll:true});}},[]);
 useLayoutCliente(()=>{const c={ativo:true,token:geracao.token};ciclo.current=c;return()=>{c.ativo=false;focoPendente.current=null;if(sessao.current?.token===c.token)sessao.current.ativa=false;};},[geracao.token]);
 useLayoutCliente(()=>{
  atual.current=props;const s=sessao.current,l=props.leitura;
  if(s?.ativa&&!s.ack&&props.responsavelId!==null&&props.responsavelId!==props.usuarioId){s.ativa=false;setVisual({token:s.token,aguardando:false,retry:false,erro:"Sua permissão mudou. Atualize a conversa antes de responder."});return;}
  if(!s?.ativa||!s.ack||s.token!==geracao.token)return;
  const corrente=!!l&&l.finalizada===l.solicitada&&l.finalizada>=s.minimo;
  if(!props.podeAssumirAria||l?.resultado==="sem-acesso"||(props.responsavelId!==null&&props.responsavelId!==props.usuarioId)||(corrente&&l.resultado==="ok"&&props.podeEnviar===false)){
   s.ativa=false;setVisual({token:s.token,aguardando:false,retry:false,erro:"Sua permissão mudou. Atualize a conversa antes de responder."});return;
  }
  if(corrente&&l.resultado==="falha"){setVisual(v=>v?.token===s.token&&!v.aguardando&&v.erro==="Não foi possível atualizar a conversa. Tente de novo."?v:{token:s.token,aguardando:false,retry:true,erro:"Não foi possível atualizar a conversa. Tente de novo."});return;}
  if(!corrente||l.resultado!=="ok"||props.responsavelId!==props.usuarioId||props.podeEnviar!==true||modoRodape(props.estadoAria,false)==="travado"||!props.controleResposta.current)return;
  s.ativa=false;focoPendente.current=s.token;props.controleResposta.current.selecionarResponder();if(campo.current){focoPendente.current=null;campo.current.focus({preventScroll:true});}setVisual(null);
 },[props,geracao.token]);
 async function assumir(token:symbol){
  const c=ciclo.current,p=atual.current;
  if(!c.ativo||c.token!==token||!p.podeAssumirAria||p.podeEnviar!==true||p.leitura?.resultado!=="ok"||p.leitura.finalizada!==p.leitura.solicitada||modoRodape(p.estadoAria,false)!=="travado"||(p.responsavelId!==null&&p.responsavelId!==p.usuarioId))return;
  if(sessao.current?.ativa&&(sessao.current.ack||sessao.current.emCurso))return;
  const s:Sessao={ativa:true,emCurso:true,ack:false,minimo:0,token};sessao.current=s;setVisual({token,aguardando:false,retry:false,erro:null});
  const d=await acao.executar(async()=>{try{const r=await assumirConversaDaAria(p.atendimentoId);return c.ativo&&s.ativa?r:{ok:true as const};}catch(e){if(!c.ativo||!s.ativa)return{ok:true as const};throw e;}});
  s.emCurso=false;
  if(d?.tipo!=="ok"||!c.ativo||!s.ativa||sessao.current!==s){s.ativa=false;return;}
  s.ack=true;s.minimo=(atual.current.leitura?.solicitada??0)+1;setVisual({token,aguardando:true,retry:false,erro:null});atual.current.aoMudar();
 }
 function tentar(){const s=sessao.current;if(!s?.ativa||!s.ack||s.token!==geracao.token)return;s.minimo=(atual.current.leitura?.solicitada??0)+1;setVisual({token:s.token,aguardando:true,retry:false,erro:null});atual.current.aoMudar();}
 const v=visual?.token===geracao.token?visual:null;
 const oferecida=props.podeAssumirAria&&props.podeEnviar===true&&props.leitura?.resultado==="ok"&&props.leitura.finalizada===props.leitura.solicitada&&modoRodape(props.estadoAria,false)==="travado"&&(props.responsavelId===null||props.responsavelId===props.usuarioId);
 return{aoCampoResponder,aoAssumir:oferecida?()=>void assumir(geracao.token):undefined,ocupado:acao.ocupado||v?.aguardando===true,feedback:v?<><FeedbackAcao erro={v.erro??acao.erro} progresso={v.aguardando?"Atualizando a conversa…":null}/>{v.erro&&v.retry&&<Botao variante="secundario" onClick={tentar}>Tentar de novo</Botao>}</>:null};
}
