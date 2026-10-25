"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {IconClock,IconX} from "@tabler/icons-react";
import {BotaoIcone} from "@/components/BotaoIcone";
import {ConfirmarAcao} from "@/components/ConfirmarAcao";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {formatarInstanteExibicao} from "@/server/operacao/fuso-exibicao";
import {cancelarAgendadaNoInbox} from "@/server/inbox/acoes-painel";
import type {AgendadaAtividade} from "@/server/inbox/painel-atividade";
type Props={itens:AgendadaAtividade[];atendimentoId:string;fuso:string|null;fusoEscola:string;aoMudar():void};
export function AgendadasAtividade(p:Props){return <AgendadasDaConversa key={p.atendimentoId} {...p}/>;}
function AgendadasDaConversa({itens,atendimentoId,fuso,fusoEscola,aoMudar}:Props){
 const [alvo,setAlvo]=useState<{item:AgendadaAtividade;sessao:number;invalidada:boolean}|null>(null),[sucesso,setSucesso]=useState<string|null>(null);
 const vivo=useRef(false),sessao=useRef(0),atual=useRef(alvo);
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useLayoutEffect(()=>{atual.current=alvo;},[alvo]);
 const itemAtual=alvo?itens.find(i=>i.id===alvo.item.id):undefined;
 if(alvo&&itemAtual&&!itemAtual.podeCancelar&&!alvo.invalidada)setAlvo({...alvo,invalidada:true});
 // Ausência esperada após SSE próprio não invalida o ACK em voo; impede iniciar outra chamada.
 const podeConfirmar=!!itemAtual?.podeCancelar&&!alvo?.invalidada;
 return <div className="space-y-2">
  {!!itens.length&&<section aria-label="Mensagens agendadas" className="space-y-2"><h3 className="text-sm font-medium">Mensagens agendadas</h3><ul className="space-y-2">{itens.map(m=><li key={m.id} className="flex min-w-0 items-start gap-2 rounded-lg border border-border-soft bg-surface p-2"><IconClock size={17} className="mt-0.5 shrink-0 text-brand-700" aria-hidden/><div className="min-w-0 flex-1"><p className="text-xs text-gray-600">{formatarInstanteExibicao(m.agendadaPara,fuso,fusoEscola).texto} · <span className={m.autor.tipo==="aria"?"text-ai-700":undefined}>{m.autor.tipo==="voce"?"Você":m.autor.tipo==="aria"?"Aria":m.autor.nome}</span></p><p className="truncate text-[13px]" title={m.texto}>{m.texto}</p></div>{m.podeCancelar&&<BotaoIcone rotulo="Cancelar mensagem agendada" tamanho={34} onClick={()=>{setSucesso(null);setAlvo({item:m,sessao:++sessao.current,invalidada:false});}}><IconX size={15}/></BotaoIcone>}</li>)}</ul></section>}
  <FeedbackAcao erro={alvo?.invalidada?"Esta mensagem não está mais disponível para cancelar. Atualize a atividade.":null} sucesso={sucesso}/>
  {alvo&&<ConfirmarAcao key={alvo.sessao} titulo="Cancelar esta mensagem agendada?" confirmacao="cancelamento" idempotente podeConfirmar={podeConfirmar} acao={()=>cancelarAgendadaNoInbox(atendimentoId,alvo.item.id)} aoCancelar={()=>setAlvo(null)} aoConcluir={()=>{if(vivo.current&&atual.current===alvo&&!alvo.invalidada){setAlvo(null);setSucesso("Mensagem agendada cancelada.");aoMudar();}}}><p>A mensagem agendada não será enviada ao contato. Este cancelamento não pode ser desfeito pela tela.</p><p className="mt-2 text-sm">{itemAtual?.texto??alvo.item.texto}</p></ConfirmarAcao>}
 </div>;
}