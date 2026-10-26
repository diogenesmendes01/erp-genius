"use client";
import {useEffect,useRef,useState} from "react";
import {Botao} from "@/components/Botao";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {useAcaoCliente} from "@/lib/acao-cliente";
import {formatarDataCivil} from "@/lib/data-civil";
import {definirPrevisaoNoInbox} from "@/server/inbox/acoes-previsao";
import type {ValoresPrevisao} from "@/server/comercial/previsao-schema";

type Props=ValoresPrevisao&{atendimentoId:string;oportunidadeId:string;podeEditar:boolean;aoMudar():void};
/** A identidade encerra a abertura anterior; atualizações de dados não remontam o formulário. */
export function PrevisaoOportunidade(p:Props){return <PrevisaoDoAlvo key={JSON.stringify([p.atendimentoId,p.oportunidadeId])} {...p}/>;}
function PrevisaoDoAlvo(p:Props){
 const acao=useAcaoCliente({idempotente:false});
 const [edicao,setEdicao]=useState<{base:ValoresPrevisao;percentual:string;dia:string}|null>(null);
 const vivo=useRef(false),capacidade=useRef(p.podeEditar),geracao=useRef({valor:0});
 useEffect(()=>{const g=geracao.current;vivo.current=true;return()=>{vivo.current=false;g.valor++;};},[]);
 useEffect(()=>{const g=geracao.current;capacidade.current=p.podeEditar;g.valor++;return()=>{capacidade.current=false;g.valor++;};},[p.podeEditar]);
 function abrir(){if(!p.podeEditar)return;geracao.current.valor++;acao.limpar();setEdicao({base:{probabilidadePct:p.probabilidadePct,previsaoFechamento:p.previsaoFechamento},percentual:p.probabilidadePct===null?'':String(p.probabilidadePct),dia:p.previsaoFechamento??''});}
 function cancelar(){geracao.current.valor++;setEdicao(null);acao.limpar();}
 async function salvar(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!edicao||!p.podeEditar||acao.ocupado)return;
  const ciclo=geracao.current.valor,alteracoes:Partial<ValoresPrevisao>={};
  const percentual=edicao.percentual.trim()===''?null:Number(edicao.percentual),dia=edicao.dia||null;
  if(percentual!==edicao.base.probabilidadePct)alteracoes.probabilidadePct=percentual;
  if(dia!==edicao.base.previsaoFechamento)alteracoes.previsaoFechamento=dia;
  const r=await acao.executar(()=>definirPrevisaoNoInbox(p.atendimentoId,{oportunidadeIdEsperada:p.oportunidadeId,esperado:edicao.base,alteracoes}));
  if(r?.tipo==='ok'&&vivo.current&&capacidade.current&&geracao.current.valor===ciclo){setEdicao(null);p.aoMudar();}
 }
 return <section className="space-y-2" aria-label="Probabilidade e previsão de fechamento">
  <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Probabilidade</span><span>{p.probabilidadePct===null?'Não informada':`${p.probabilidadePct}%`}</span></div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Previsão de fechamento</span><span>{p.previsaoFechamento===null?'Não informada':formatarDataCivil(p.previsaoFechamento)}</span></div>
  {p.podeEditar&&!edicao&&<Botao variante="fantasma" tamanho="sm" onClick={abrir}>Editar previsão</Botao>}
  {p.podeEditar&&edicao&&<form onSubmit={salvar} className="space-y-3">
   <label className="block text-sm">Probabilidade (%)<input className="mt-1 w-full rounded-md border border-border-soft bg-surface p-2" type="number" min={0} max={100} step={1} value={edicao.percentual} disabled={acao.ocupado} onChange={e=>setEdicao({...edicao,percentual:e.target.value})}/></label>
   <label className="block text-sm">Previsão de fechamento<input className="mt-1 w-full rounded-md border border-border-soft bg-surface p-2" type="date" value={edicao.dia} disabled={acao.ocupado} onChange={e=>setEdicao({...edicao,dia:e.target.value})}/></label>
   <div className="flex flex-wrap gap-2"><Botao type="submit" variante="primario" tamanho="sm" disabled={acao.ocupado}>Salvar previsão</Botao><Botao variante="neutro" tamanho="sm" onClick={cancelar} disabled={acao.ocupado}>Cancelar</Botao></div>
  </form>}
  <FeedbackAcao erro={acao.erro}/>
 </section>;
}