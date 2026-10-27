"use client";
import { useCallback,useEffect,useId,useLayoutEffect,useRef,useState } from "react";
import { IconSparkles,IconSend,IconClock,IconArrowRight,IconListCheck,IconTag,IconForms,IconX,IconNote,IconPercentage,IconAlertTriangle } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { aprovarSugestaoNoInbox as aprovarAcaoAria,rejeitarSugestaoNoInbox as rejeitarAcaoAria,desfazerSugestaoNoInbox,aprovarTurnoAria,rejeitarTurnoAria } from "@/server/aria/acoes";
import { useChavesPorAlvo,type ChaveTentativa } from "@/lib/chave-idempotencia";
import type { Resultado } from "@/server/_shared/resultado";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { EditorSugestaoAria } from "./EditorSugestaoAria";
import { visualPacote,visualSugestao } from "./sugestao-visual";

type Props={atendimentoId:string;s:SugestaoAriaThread;usuarioId:string;fuso:string|null;aoDecidir():void;bloqueado?:boolean};
const ICONES={enviar:IconSend,agendar:IconClock,etapa:IconArrowRight,tarefa:IconListCheck,tag:IconTag,campo:IconForms,perdido:IconX,nota:IconNote,condicao:IconPercentage};
export function CartaoSugestaoAria(props:Props){return <SessaoCartao key={props.atendimentoId+":"+props.s.id} {...props}/>;}
function SessaoCartao({atendimentoId,s,usuarioId,fuso,aoDecidir,bloqueado=false}:Props){
 const tituloId=useId(),acao=useAcaoCliente({idempotente:true}),ciclo=useRef({ativa:false,chave:""});
 const [editando,setEditando]=useState(false);
 const [confirmacao,setConfirmacao]=useState<{ativa:boolean;chave:string}|null>(null);
 const podeDecidir=s.podeDecidir!==false,podeDesfazer=s.podeDesfazer===true&&(s.status==="APROVADA"||s.status==="EXECUTADA");
 const chave=String(bloqueado)+":"+String(podeDecidir)+":"+String(podeDesfazer);
 const v=visualSugestao(s,{usuarioId,fuso});
 const grupo=useRef<HTMLDivElement|null>(null),origem=useRef<Element|null>(null),retorno=useRef<Element|null>(null);
 const resultado=useRef<HTMLParagraphElement|null>(null),gatilhoDesfazer=useRef<HTMLButtonElement|null>(null),focoDesfazer=useRef<Element|null>(null);
 const gatilhoEdicao=useRef<HTMLButtonElement|null>(null),retornoEditor=useRef(false);
 const limpar=acao.limpar;
 useLayoutEffect(()=>{if(editando||!retornoEditor.current)return;retornoEditor.current=false;if(bloqueado||!podeDecidir||!gatilhoEdicao.current?.isConnected)return;retorno.current=null;origem.current=null;gatilhoEdicao.current.focus({preventScroll:true});},[editando,bloqueado,podeDecidir]);
 useLayoutEffect(()=>{const atual={ativa:!bloqueado,chave};ciclo.current=atual;limpar();if(bloqueado){origem.current=null;retorno.current=null;focoDesfazer.current=null;}return()=>{atual.ativa=false;};},[bloqueado,chave,limpar]);
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
  if(ativo!==pedido&&ativo!==documento.body&&ativo?.isConnected)return;
  if(alvo.closest('[hidden],[inert],[aria-hidden="true"]'))return;
  alvo.focus({preventScroll:true});
 },[v.pendente]);
 useEffect(()=>{
  if(s.status!=="DESFEITA"||bloqueado||!focoDesfazer.current)return;
  const pedido=focoDesfazer.current;focoDesfazer.current=null;
  const alvo=resultado.current;if(!alvo?.isConnected||alvo.closest('[hidden],[inert],[aria-hidden="true"]'))return;
  const documento=alvo.ownerDocument,ativo=documento.activeElement;
  if(ativo!==pedido&&ativo!==documento.body&&ativo?.isConnected)return;
  alvo.focus({preventScroll:true});
 },[s.status,bloqueado]);
 async function decidir(aprovar:boolean){
  const atual=ciclo.current;if(bloqueado||!podeDecidir||!atual.ativa||!v.pendente)return;
  const controles=grupo.current,ativo=controles?.ownerDocument.activeElement;
  origem.current=ativo&&controles?.contains(ativo)?ativo:null;
  const d=await acao.executar(async()=>{try{const r=await(aprovar?aprovarAcaoAria(atendimentoId,s.id):rejeitarAcaoAria(atendimentoId,s.id));return atual.ativa?r:{ok:true as const};}catch(e){if(!atual.ativa)return {ok:true as const};throw e;}});
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
   {v.pendente&&editando&&<div ref={ligarGrupo} onClickCapture={()=>{const controles=grupo.current,ativo=controles?.ownerDocument.activeElement;origem.current=ativo&&controles?.contains(ativo)?ativo:null;}}><EditorSugestaoAria s={s} atendimentoId={atendimentoId} fuso={fuso} bloqueado={bloqueado||!podeDecidir} aoCancelar={()=>{retornoEditor.current=true;setEditando(false);}} aoDecidir={aoDecidir}/></div>}
   {v.pendente&&!editando&&<div ref={ligarGrupo} className="flex min-h-9 gap-2">
    <Botao disabled={bloqueado||!podeDecidir} ocupado={acao.ocupado} className="flex-1" onClick={()=>void decidir(true)}>{v.rotuloAprovar}</Botao>
    <Botao variante="perigoContorno" disabled={bloqueado||!podeDecidir} ocupado={acao.ocupado} onClick={()=>void decidir(false)}>{v.rotuloRejeitar}</Botao>
   </div>}
   {podeDesfazer&&<Botao ref={gatilhoDesfazer} variante="neutro" disabled={bloqueado} ocupado={acao.ocupado} onClick={()=>{if(!bloqueado&&ciclo.current.ativa){origem.current=gatilhoDesfazer.current;setConfirmacao(ciclo.current);}}}>Desfazer</Botao>}
   {v.pendente&&!editando&&["RESPONDER","ENVIAR_DOCUMENTO","AGENDAR_MENSAGEM","CRIAR_TAREFA","NOTA_INTERNA"].includes(s.acao)&&<Botao ref={gatilhoEdicao} variante="neutro" disabled={bloqueado||!podeDecidir||acao.ocupado} onClick={()=>{if(!bloqueado&&podeDecidir&&!acao.ocupado&&ciclo.current.ativa)setEditando(true);}}>{s.acao==="CRIAR_TAREFA"?"Editar tarefa":"Editar"}</Botao>}
   {confirmacao?.ativa&&confirmacao.chave===chave&&!bloqueado&&podeDesfazer&&<ConfirmarAcao titulo="Desfazer esta sugestão da Aria?" confirmacao="desfazer sugestão" idempotente={false}
    acao={async()=>{
     const atual=confirmacao;
     if(!atual.ativa||bloqueado||!podeDesfazer)return {ok:false,erro:"A autorização mudou. Reabra o painel antes de decidir."};
     try{const r=await desfazerSugestaoNoInbox(atendimentoId,s.id);return atual.ativa?r:{ok:true};}catch(e){if(!atual.ativa)return {ok:true};throw e;}
    }}
    aoConcluir={()=>{if(confirmacao.ativa){focoDesfazer.current=origem.current;setConfirmacao(null);aoDecidir();}}}
    aoCancelar={()=>setConfirmacao(null)}>
    A Aria tentará reverter esta ação. Alterações posteriores de uma pessoa e mensagens já enviadas serão preservadas.
   </ConfirmarAcao>}
   <p ref={resultado} role="status" tabIndex={-1} className={v.decidido?"text-xs font-semibold "+(v.decidido.tom==="brand"?"text-brand-700":"text-gray-600"):"sr-only"}>{v.decidido?.texto}</p>
   <FeedbackAcao erro={acao.erro}/>
  </div>
 </article>;
}

type PropsPacote={atendimentoId:string;pacote:readonly SugestaoAriaThread[];usuarioId:string;fuso:string|null;aoDecidir():void;bloqueado?:boolean};
const EDITAVEIS=["RESPONDER","ENVIAR_DOCUMENTO","AGENDAR_MENSAGEM","CRIAR_TAREFA","NOTA_INTERNA"];
export function CartaoPacoteAria(props:PropsPacote){return <SessaoPacote key={props.atendimentoId+":"+props.pacote.map(s=>s.id).join(",")} {...props}/>;}
function SessaoPacote({atendimentoId,pacote,usuarioId,fuso,aoDecidir,bloqueado=false}:PropsPacote){
 const tituloId=useId(),acao=useAcaoCliente({idempotente:true}),chaves=useChavesPorAlvo(),ciclo=useRef({ativa:false});
 const [editandoId,setEditandoId]=useState<string|null>(null);
 useLayoutEffect(()=>{const atual={ativa:!bloqueado};ciclo.current=atual;return()=>{atual.ativa=false;};},[bloqueado]);
 const v=visualPacote(pacote,{usuarioId,fuso});
 const podeDecidirTudo=pacote.every(s=>s.podeDecidir!==false),travado=bloqueado||acao.ocupado;
 const turnoId=pacote[0]?.turnoId??"",acaoIds=pacote.map(s=>s.id).sort();
 const primeiro=pacote.reduce<string|null>((a,s)=>a===null||Date.parse(s.criadoEm)<Date.parse(a)?s.criadoEm:a,null);
 async function executar(atual:{ativa:boolean},f:()=>Promise<Resultado<unknown>>,chave?:ChaveTentativa){
  const d=await acao.executar(async()=>{try{const r=await f();return atual.ativa?(r.ok?{ok:true as const}:r):{ok:true as const};}catch(e){if(!atual.ativa)return {ok:true as const};throw e;}});
  if(atual.ativa&&d?.tipo==="ok"){chave?.depoisDo(d);aoDecidir();}
 }
 function decidirTudo(aprovar:boolean){
  const atual=ciclo.current;if(!atual.ativa||bloqueado||!podeDecidirTudo||acao.ocupado||!acaoIds.length)return;
  const chave=chaves.para((aprovar?"aprovar:":"rejeitar:")+acaoIds.join(","));
  const entrada={turnoId,atendimentoId,acaoIds,chaveIdempotencia:chave.atual};
  void executar(atual,()=>aprovar?aprovarTurnoAria(entrada):rejeitarTurnoAria(entrada),chave);
 }
 function decidirUma(s:SugestaoAriaThread,aprovar:boolean){
  const atual=ciclo.current;if(!atual.ativa||bloqueado||s.podeDecidir===false||acao.ocupado)return;
  void executar(atual,()=>aprovar?aprovarAcaoAria(atendimentoId,s.id):rejeitarAcaoAria(atendimentoId,s.id));
 }
 return <article aria-labelledby={tituloId} className="my-2 ml-auto w-[min(520px,80%)] min-w-0 self-end overflow-hidden rounded-[14px] border border-amber-600 bg-surface">
  <div className="flex items-center gap-2 bg-ai-50 px-3.5 py-2.5 text-xs font-semibold text-ai-700">
   <IconSparkles size={14} aria-hidden/><span className="min-w-0 flex-1">{v.cabecalho}</span>{primeiro&&<time dateTime={primeiro} className="shrink-0 font-mono text-[11px] font-normal">{formatarInstanteExibicao(primeiro,fuso,"UTC","hora").texto}</time>}
  </div>
  <div className="flex min-w-0 flex-col gap-2.5 break-words px-3.5 pb-3.5 pt-3 [overflow-wrap:anywhere]">
   <h3 id={tituloId} className="text-[14.5px] font-semibold text-gray-800">{v.titulo}</h3>
   {v.justificativa&&<p className="whitespace-pre-wrap text-xs text-gray-600">{v.justificativa}</p>}
   {v.itens.filter(x=>x.v.textoProposto!==null&&x.s.id!==editandoId).map(x=><p key={x.s.id} className="whitespace-pre-wrap rounded-[10px] bg-bubble-ia p-3 text-[13px] text-gray-800">{x.v.textoProposto}</p>)}
   <ul className="space-y-2 text-[13px] text-gray-800">{v.itens.map(({s,v:vi,linha})=>{const Icone=ICONES[linha.icone];const podeEsta=s.podeDecidir!==false;return <li key={s.id} className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-wrap items-center gap-2"><Icone size={14} className="shrink-0 text-gray-600" aria-hidden/><span className="min-w-0 flex-1">{linha.texto}</span>
     {editandoId!==s.id&&<span role="group" aria-label={"Decidir: "+linha.texto} className="flex shrink-0 gap-1.5">
      <Botao tamanho="sm" variante="secundario" disabled={travado||!podeEsta} onClick={()=>decidirUma(s,true)}>{vi.rotuloAprovar}</Botao>
      {EDITAVEIS.includes(s.acao)&&<Botao tamanho="sm" variante="neutro" disabled={travado||!podeEsta} onClick={()=>{if(!travado&&podeEsta&&ciclo.current.ativa)setEditandoId(s.id);}}>{s.acao==="CRIAR_TAREFA"?"Editar tarefa":"Editar"}</Botao>}
      <Botao tamanho="sm" variante="perigoContorno" disabled={travado||!podeEsta} onClick={()=>decidirUma(s,false)}>{vi.rotuloRejeitar}</Botao>
     </span>}
    </div>
    {editandoId===s.id&&<EditorSugestaoAria s={s} atendimentoId={atendimentoId} fuso={fuso} bloqueado={bloqueado||!podeEsta} aoCancelar={()=>setEditandoId(null)} aoDecidir={aoDecidir}/>}
   </li>;})}</ul>
   {v.avisoEnvio&&<p className="flex items-start gap-1.5 text-xs text-amber-700"><IconAlertTriangle size={14} className="shrink-0" aria-hidden/><span>Isso será enviado agora no WhatsApp e não poderá ser desfeito.</span></p>}
   {v.expira&&<p className="text-xs text-gray-600">{v.expira}</p>}
   {editandoId===null&&<div className="flex min-h-9 gap-2">
    <Botao disabled={bloqueado||!podeDecidirTudo} ocupado={acao.ocupado} className="flex-1" onClick={()=>decidirTudo(true)}>{v.rotuloAprovar}</Botao>
    <Botao variante="perigoContorno" disabled={bloqueado||!podeDecidirTudo} ocupado={acao.ocupado} onClick={()=>decidirTudo(false)}>{v.rotuloRejeitar}</Botao>
   </div>}
   {editandoId===null&&!podeDecidirTudo&&<p className="text-xs text-gray-600">Há ações fora do seu escopo neste pacote. Decida as demais individualmente.</p>}
   <FeedbackAcao erro={acao.erro}/>
  </div>
 </article>;
}
