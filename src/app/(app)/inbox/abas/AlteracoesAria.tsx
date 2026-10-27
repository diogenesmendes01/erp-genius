"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {IconSparkles,IconLock,IconArrowBackUp} from "@tabler/icons-react";
import {Botao} from "@/components/Botao";
import {ConfirmarAcao} from "@/components/ConfirmarAcao";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {EstadoVazio} from "@/components/EstadoVazio";
import {desfazerSugestaoNoInbox} from "@/server/aria/acoes";
import {formatarInstanteExibicao} from "@/server/operacao/fuso-exibicao";
import type {AlteracaoAriaPainel} from "@/server/inbox/painel-atividade-aria";
type Props={itens:AlteracaoAriaPainel[];atendimentoId:string;fuso:string|null;fusoEscola:string;aoMudar():void};
export function AlteracoesAria(p:Props){return <AlteracoesDaConversa key={p.atendimentoId} {...p}/>;}
function AlteracoesDaConversa({itens,atendimentoId,fuso,fusoEscola,aoMudar}:Props){
 const [alvo,setAlvo]=useState<{item:AlteracaoAriaPainel;sessao:number;invalidada:boolean}|null>(null),[sucesso,setSucesso]=useState<string|null>(null);
 const vivo=useRef(false),sessao=useRef(0),atual=useRef(alvo);
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useLayoutEffect(()=>{atual.current=alvo;},[alvo]);
 const itemAtual=alvo?itens.find(i=>i.id===alvo.item.id):undefined;
 if(alvo&&!alvo.invalidada&&(!itemAtual||(!itemAtual.podeDesfazer&&!itemAtual.desfeita)||itemAtual.acao!==alvo.item.acao||itemAtual.em!==alvo.item.em))setAlvo({...alvo,invalidada:true});
 const podeConfirmar=!!itemAtual?.podeDesfazer&&!alvo?.invalidada;
 return <section aria-label="Alterações da Aria" className="space-y-3">
  <h3 className="text-sm font-medium">Alterações da Aria</h3>
  <p className="text-xs text-gray-600">Tudo que Aria fez neste contato. Desfazer restaura o valor anterior. Mensagens enviadas e handoffs já comunicados ao lead não podem ser desfeitos.</p>
  {itens.length?<ul className="space-y-3">{itens.map(i=><li key={i.id} className="flex min-w-0 items-start gap-2">
   <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg border border-ai-200 bg-ai-50 text-ai-700"><IconSparkles size={16} aria-hidden/></span>
   <div className="min-w-0 flex-1"><p className={"text-[13.5px] [overflow-wrap:anywhere]"+(i.desfeita?" text-gray-500 line-through opacity-50":" text-gray-800")}>{i.texto}</p><p className="mt-1 font-mono text-[11px] text-gray-500">{i.desfeita?"Desfeito · ":""}{formatarInstanteExibicao(i.em,fuso,fusoEscola).texto}</p>
   {!i.podeDesfazer&&!i.desfeita&&<p className="mt-1 flex items-start gap-1 text-xs text-gray-600"><IconLock size={13} className="mt-0.5 shrink-0" aria-hidden/><span className="[overflow-wrap:anywhere]">{i.motivoIrreversivel??"Esta alteração não está disponível para desfazer."}</span></p>}</div>
   {i.podeDesfazer&&<Botao variante="neutro" tamanho="sm" aria-label="Desfazer" onClick={()=>{setSucesso(null);setAlvo({item:i,sessao:++sessao.current,invalidada:false});}}><IconArrowBackUp size={14} aria-hidden/>Desfazer</Botao>}
  </li>)}</ul>:<EstadoVazio>Aria ainda não alterou nada neste contato.</EstadoVazio>}
  <FeedbackAcao erro={alvo?.invalidada?"Esta alteração não está mais disponível. Atualize a atividade.":null} sucesso={sucesso}/>
  {alvo&&<ConfirmarAcao key={alvo.sessao} titulo="Desfazer esta alteração da Aria?" confirmacao="desfazer alteração" idempotente podeConfirmar={podeConfirmar} acao={()=>desfazerSugestaoNoInbox(atendimentoId,alvo.item.id)} aoCancelar={()=>setAlvo(null)} aoConcluir={()=>{if(vivo.current&&atual.current===alvo&&!alvo.invalidada){setAlvo(null);setSucesso("Alteração da Aria desfeita.");aoMudar();}}}><p>A Aria tentará reverter esta alteração. Mudanças posteriores de uma pessoa e mensagens já enviadas serão preservadas.</p><p className="mt-2 text-sm">{itemAtual?.texto??alvo.item.texto}</p></ConfirmarAcao>}
 </section>;
}