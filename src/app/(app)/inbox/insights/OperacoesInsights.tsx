"use client";
import { useLayoutEffect,useRef,useState } from "react";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { reconciliarInsightNoInbox,descartarInsightNoInbox } from "@/server/inbox/acoes-insights";
import type { ReconciliarInsightInput,DescartarInsightInput } from "@/server/aria/insights/entradas";
import type { DadosInsights } from "./useLeituraInsights";
import type { RetomadaInsight } from "./useGeracaoInsight";

type Props={dados:DadosInsights;atendimentoId:string;ativo:boolean;bloqueado:boolean;leituraFresca:boolean;aoSolicitarLeitura(id?:string):number|void;aoRetomar(i:RetomadaInsight):Promise<void>};
type Alvo=({tipo:"reconciliar";entrada:ReconciliarInsightInput}|{tipo:"descartar";entrada:DescartarInsightInput})&{token:object;invalidada:boolean};
export function OperacoesInsights(p:Props){
  const identidade=p.ativo?JSON.stringify([p.atendimentoId,p.dados.contextoAtualEsperadoHash]):null;
  const [ciclo,setCiclo]=useState<{identidade:string|null;token:object;alvo:Alvo|null;feedback:string|null;emExecucao:boolean}>(()=>({identidade,token:{},alvo:null,feedback:null,emExecucao:false}));
  if(ciclo.identidade!==identidade)setCiclo({identidade,token:{},alvo:null,feedback:null,emExecucao:false});
  const vigente=useRef<object|null>(null),atual=useRef<Alvo|null>(null),props=useRef(p);
  useLayoutEffect(()=>{vigente.current=ciclo.token;atual.current=ciclo.alvo;props.current=p;return()=>{if(vigente.current===ciclo.token){vigente.current=null;atual.current=null;}};},[ciclo.token,ciclo.alvo,p]);
  const e=p.dados.emCurso,alvo=ciclo.alvo,disponivel=!!identidade&&p.leituraFresca&&!p.bloqueado;
  const confere=!!alvo&&disponivel&&e?.geracaoId===alvo.entrada.geracaoId&&e.versao===alvo.entrada.versaoEsperada&&e.estado===alvo.entrada.estadoEsperado;
  if(alvo&&!alvo.invalidada&&!ciclo.emExecucao&&!confere)setCiclo({...ciclo,alvo:{...alvo,invalidada:true}});
  function abrir(tipo:Alvo["tipo"]){
    if(!disponivel||!e)return;
    const base={atendimentoId:p.atendimentoId,geracaoId:e.geracaoId,versaoEsperada:e.versao,contextoAtualEsperadoHash:p.dados.contextoAtualEsperadoHash};
    const novo:Alvo=tipo==="reconciliar"?{tipo,entrada:{...base,estadoEsperado:"PROCESSANDO",chaveReconciliacao:crypto.randomUUID()},token:ciclo.token,invalidada:false}:{tipo,entrada:{...base,estadoEsperado:"INCERTO",chaveDescarte:crypto.randomUUID()},token:ciclo.token,invalidada:false};
    atual.current=novo;setCiclo({...ciclo,alvo:novo,feedback:null,emExecucao:false});
  }
  function entradaVigente<T extends Alvo>(pedido:T):T["entrada"]{
    const c=props.current,ativo=c.dados.emCurso;
    if(vigente.current!==pedido.token||atual.current!==pedido||pedido.invalidada||!c.ativo||!c.leituraFresca||c.bloqueado
      ||c.atendimentoId!==pedido.entrada.atendimentoId||c.dados.contextoAtualEsperadoHash!==pedido.entrada.contextoAtualEsperadoHash
      ||ativo?.geracaoId!==pedido.entrada.geracaoId||ativo.versao!==pedido.entrada.versaoEsperada||ativo.estado!==pedido.entrada.estadoEsperado)throw new Error("O contexto mudou. Atualize os Insights.");
    setCiclo(anterior=>({...anterior,emExecucao:true}));return pedido.entrada;
  }
  function cancelar(){atual.current=null;setCiclo(anterior=>({...anterior,alvo:null,emExecucao:false}));}
  function concluir(dado:{geracaoId:string}|undefined){
    if(!alvo||vigente.current!==alvo.token||atual.current!==alvo)return;
    atual.current=null;setCiclo(anterior=>({...anterior,alvo:null,emExecucao:false,feedback:dado?.geracaoId===alvo.entrada.geracaoId?"Estado da análise atualizado.":null}));p.aoSolicitarLeitura(alvo.entrada.geracaoId);
  }
  function falhar(){setCiclo(anterior=>({...anterior,emExecucao:false}));if(alvo&&vigente.current===alvo.token&&atual.current===alvo)p.aoSolicitarLeitura(alvo.entrada.geracaoId);}
  return <div className="space-y-2">
    {disponivel&&e?.podeRetomar&&<Botao variante="iaFantasma" tamanho="sm" onClick={()=>p.aoRetomar({atendimentoId:p.atendimentoId,geracaoId:e.geracaoId,versaoEsperada:e.versao,contextoAtualEsperadoHash:p.dados.contextoAtualEsperadoHash})}>Retomar análise</Botao>}
    {disponivel&&e?.podeReconciliar&&<Botao variante="secundario" tamanho="sm" onClick={()=>abrir("reconciliar")}>Verificar análise inconclusiva</Botao>}
    {disponivel&&e?.podeDescartar&&<Botao variante="perigoContorno" tamanho="sm" onClick={()=>abrir("descartar")}>Descartar análise inconclusiva</Botao>}
    <FeedbackAcao sucesso={ciclo.feedback} erro={alvo?.invalidada?"O estado da análise mudou. Atualize os Insights.":null}/>
    {alvo?.tipo==="reconciliar"&&<ConfirmarAcao titulo="Registrar resultado como inconclusivo?" confirmacao="análise inconclusiva" idempotente podeConfirmar={confere&&!alvo.invalidada} acao={()=>reconciliarInsightNoInbox(entradaVigente(alvo))} aoConcluir={concluir} aoFalhar={falhar} aoCancelar={cancelar}><p>O pedido pode ainda estar em andamento. Esta operação impede publicar a análise, mas não cancela o gasto já iniciado. Nenhuma nova geração será iniciada.</p></ConfirmarAcao>}
    {alvo?.tipo==="descartar"&&<ConfirmarAcao titulo="Descartar análise inconclusiva?" confirmacao="descarte da análise" idempotente podeConfirmar={confere&&!alvo.invalidada} acao={()=>descartarInsightNoInbox(entradaVigente(alvo))} aoConcluir={concluir} aoFalhar={falhar} aoCancelar={cancelar}><p>Esta análise não será publicada. Ela pode ter gerado custo; clicar em Atualizar depois do descarte pode gerar novo custo. O descarte não inicia outra geração.</p></ConfirmarAcao>}
  </div>;
}
