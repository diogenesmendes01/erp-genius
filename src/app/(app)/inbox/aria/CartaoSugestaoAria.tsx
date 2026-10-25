"use client";
import { useCallback,useId,useLayoutEffect,useRef } from "react";
import { IconSparkles,IconSend,IconClock,IconArrowRight,IconListCheck,IconTag,IconForms,IconX,IconNote,IconPercentage,IconAlertTriangle } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { aprovarAcaoAria,rejeitarAcaoAria } from "@/server/aria/acoes";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { visualSugestao } from "./sugestao-visual";

type Props={s:SugestaoAriaThread;usuarioId:string;fuso:string|null;aoDecidir():void;bloqueado?:boolean};
const ICONES={enviar:IconSend,agendar:IconClock,etapa:IconArrowRight,tarefa:IconListCheck,tag:IconTag,campo:IconForms,perdido:IconX,nota:IconNote,condicao:IconPercentage};
/** A identidade da ação monta uma sessão própria: um ACK antigo não afeta outro cartão. */
export function CartaoSugestaoAria(props:Props){return <SessaoCartao key={props.s.id} {...props}/>;}
function SessaoCartao({s,usuarioId,fuso,aoDecidir,bloqueado=false}:Props){
 const tituloId=useId(),acao=useAcaoCliente({idempotente:true}),ciclo=useRef({ativa:false});
 const v=visualSugestao(s,{usuarioId,fuso});
 const grupo=useRef<HTMLDivElement|null>(null),origem=useRef<Element|null>(null),retorno=useRef<Element|null>(null);
 const resultado=useRef<HTMLParagraphElement|null>(null);
 const limpar=acao.limpar;
 useLayoutEffect(()=>{const atual={ativa:!bloqueado};ciclo.current=atual;limpar();origem.current=null;retorno.current=null;return()=>{atual.ativa=false;};},[bloqueado,limpar]);
 // Ref estável: o detach precede a remoção do grupo, inclusive em decisão recebida por SSE sem nosso ACK.
 const ligarGrupo=useCallback((no:HTMLDivElement|null)=>{
  const anterior=grupo.current;
  if(!no&&anterior){
   const documento=anterior.ownerDocument,ativo=documento.activeElement;
   if(ativo&&anterior.contains(ativo))retorno.current=ativo;
   else if(ativo===documento.body&&origem.current&&anterior.contains(origem.current))retorno.current=origem.current;
  }
  grupo.current=no;
 },[]);
 useLayoutEffect(()=>{
  const pedido=retorno.current;retorno.current=null;
  if(v.pendente||!pedido)return;
  origem.current=null;
  const alvo=resultado.current;if(!alvo?.isConnected)return;
  const documento=alvo.ownerDocument,ativo=documento.activeElement;
  // Quem saiu para outro controle conserva seu foco; não há foco genérico a cada recarga.
  if(ativo!==pedido&&ativo!==documento.body&&ativo?.isConnected)return;
  if(alvo.closest('[hidden],[inert],[aria-hidden="true"]'))return;
  alvo.focus({preventScroll:true});
 },[v.pendente]);
 async function decidir(aprovar:boolean){
  const atual=ciclo.current;if(bloqueado||!atual.ativa||!v.pendente)return;
  // Botao ocupado pode perder foco antes do ACK; guardar a origem enquanto ainda está habilitado.
  const controles=grupo.current,ativo=controles?.ownerDocument.activeElement;
  origem.current=ativo&&controles?.contains(ativo)?ativo:null;
  const d=await acao.executar(async()=>{try{const r=await(aprovar?aprovarAcaoAria(s.id):rejeitarAcaoAria(s.id));return atual.ativa?r:{ok:true as const};}catch(e){if(!atual.ativa)return {ok:true as const};throw e;}});
  if(atual.ativa&&d?.tipo==="ok")aoDecidir();
 }
 return <article aria-labelledby={tituloId} className={"my-2 ml-auto w-[min(520px,80%)] min-w-0 self-end overflow-hidden rounded-[14px] border bg-surface "+(v.pendente?"border-amber-600":"border-gray-200")}>
  <div className="flex items-center gap-2 bg-ai-50 px-3.5 py-2.5 text-xs font-semibold text-ai-700">
   <IconSparkles size={14} aria-hidden/><span className="min-w-0 flex-1">{v.cabecalho}</span><time dateTime={s.criadoEm} className="shrink-0 font-mono text-[11px] font-normal">{formatarInstanteExibicao(s.criadoEm,fuso,"UTC","hora").texto}</time>
  </div>
  <div className="flex min-w-0 flex-col gap-2.5 break-words px-3.5 pb-3.5 pt-3 [overflow-wrap:anywhere]">
   <h3 id={tituloId} className="text-[14.5px] font-semibold text-gray-800">{v.titulo}</h3>
   {s.justificativa&&<p className="whitespace-pre-wrap text-xs text-gray-600">{s.justificativa}</p>}
   {v.textoProposto!==null&&<p className="whitespace-pre-wrap rounded-[10px] bg-bubble-ia p-3 text-[13px] text-gray-800">{v.textoProposto}</p>}
   {v.linhas.length>0&&<ul className="space-y-2 text-[13px] text-gray-800">{v.linhas.map((l,i)=>{const Icone=ICONES[l.icone];return <li key={i} className="flex items-start gap-2"><Icone size={14} className="mt-0.5 shrink-0 text-gray-600" aria-hidden/><span className="min-w-0">{l.texto}</span></li>;})}</ul>}
   {v.avisoEnvio&&<p className="flex items-start gap-1.5 text-xs text-amber-700"><IconAlertTriangle size={14} className="shrink-0" aria-hidden/><span>Isso será enviado agora no WhatsApp e não poderá ser desfeito.</span></p>}
   {v.expira&&<p className="text-xs text-gray-600">{v.expira}</p>}
   {v.pendente&&<div ref={ligarGrupo} className="flex min-h-9 gap-2">
    <Botao disabled={bloqueado} ocupado={acao.ocupado} className="flex-1" onClick={()=>void decidir(true)}>{v.rotuloAprovar}</Botao>
    <Botao variante="perigoContorno" disabled={bloqueado} ocupado={acao.ocupado} onClick={()=>void decidir(false)}>{v.rotuloRejeitar}</Botao>
   </div>}
   {/* Região permanece montada vazia antes da decisão; status anuncia mudança de texto real. */}
   <p ref={resultado} role="status" tabIndex={-1} className={v.decidido?"text-xs font-semibold "+(v.decidido.tom==="brand"?"text-brand-700":"text-gray-600"):"sr-only"}>{v.decidido?.texto}</p>
   <FeedbackAcao erro={acao.erro}/>
  </div>
 </article>;
}
