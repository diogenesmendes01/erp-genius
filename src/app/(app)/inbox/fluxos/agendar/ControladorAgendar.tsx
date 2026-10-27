"use client";
import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
import type {PortaRascunhoAgendamento} from "@/components/conversa/porta-rascunho-agendamento";
import type {RespostaDoCompositor} from "@/components/conversa/respostas-rapidas";
import type {AlvoAgendamento,ComandoAgendamento,IntencaoAgendamento,IntencoesAgendamento} from "./intencao-agendamento";
import {PopoverAgendar} from "./PopoverAgendar";
import {PopoverFluxo} from "../PopoverFluxo";
import {Botao} from "@/components/Botao";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {MensagemStatus} from "@/components/MensagemStatus";
import {agendadasDoAtendimento} from "@/server/whatsapp/consultas-acoes-atendimento";
import {agendarMensagemNoAtendimentoLocal,reagendarAgendamentoDoAtendimento} from "@/server/whatsapp/acoes-conversa";
import {MOTIVO_SEM_ENVIO} from "@/components/conversa/Compositor";
import type {Resultado} from "@/server/_shared/resultado";
export interface PropsControladorAgendar {
 atendimentoId:string;nomeContato:string;fuso:string;usuarioId:string;responsavelId:string|null;estadoAria?:string|null;
 aberto:boolean;grupo:boolean;podeEnviar:boolean|null;podeLer:boolean;leituraPronta:boolean;versao:number;
 intencoes?:IntencoesAgendamento;porta:PortaRascunhoAgendamento|null;respostas:readonly RespostaDoCompositor[];
 variaveisResposta:{nome?:string|null;responsavel?:string|null;curso?:string|null};agora?:Date;
 pedidoAbrir?:string|null;aoPedidoConsumido?():void;aoPrepararRascunho?():void;
 insightsAplicaveis?:boolean;versaoInsights?:number;aoConcluir(mensagem:string):void;
}
type Abertura={atorId:string;dono:IntencoesAgendamento;geracao:number;alvo:AlvoAgendamento;intencao:IntencaoAgendamento;fuso:string;porta:PortaRascunhoAgendamento|null};
type Leitura={chave:string;lista:AgendadaNoFio[];erro:null}|{chave:string;lista:null;erro:string};
function podeMutar(p:PropsControladorAgendar){return p.podeLer&&p.podeEnviar===true&&p.aberto&&!p.grupo&&p.responsavelId===p.usuarioId&&!["ia","aprovacao","handoff"].includes(p.estadoAria??"");}
export function useControladorAgendar(props:PropsControladorAgendar){
 const {pedidoAbrir,leituraPronta,podeLer,podeEnviar,porta,intencoes,aoPedidoConsumido}=props;
 const refDoMenu=useRef<HTMLButtonElement>(null),ancora=useRef<HTMLElement|null>(null),atual=useRef(props),viva=useRef(true),sequencia=useRef(0),abertaRef=useRef<Abertura|null>(null);
 const aguardandoPorta=useRef<{dto?:AgendadaNoFio;ancora?:HTMLElement}|null>(null),consumidos=useRef(new Set<string>());
 const [edicao,setEdicao]=useState<{geracao:number;dto:AgendadaNoFio}|null>(null);
 const [abertura,setAbertura]=useState<Abertura|null>(null),[leitura,setLeitura]=useState<Leitura|null>(null),[tentativa,setTentativa]=useState(0),[erro,setErro]=useState<string|null>(null),[sucesso,setSucesso]=useState<{atorId:string;mensagem:string}|null>(null);
 useEffect(()=>{atual.current=props;},[props]);useEffect(()=>{viva.current=true;return()=>{viva.current=false;abertaRef.current=null;};},[]);
 const fechar=useCallback(()=>{sequencia.current++;abertaRef.current=null;setAbertura(null);},[]);
 const abrirBase=useCallback((dto?:AgendadaNoFio,origem?:HTMLElement):"abriu"|"aguardar"|"recusou"=>{
  const p=atual.current;if(!p.intencoes||!viva.current)return "recusou";
  if(!p.leituraPronta)return "aguardar";
  if(!p.podeLer){setErro("Você não pode acessar este atendimento.");return "recusou";}
  const pendente=p.intencoes.pendente(p.atendimentoId);
  if(!pendente&&(p.podeEnviar!==true||p.grupo||!p.aberto)){setErro(MOTIVO_SEM_ENVIO);return "recusou";}
  if(!pendente&&!dto&&(!p.porta||p.porta.atendimentoId!==p.atendimentoId)){aguardandoPorta.current={dto,ancora:origem};p.aoPrepararRascunho?.();return "aguardar";}
  aguardandoPorta.current=null;setErro(null);setSucesso(null);
  const alvo:AlvoAgendamento=pendente?.alvo??(dto?{tipo:"REAGENDAR",atendimentoId:p.atendimentoId,intencaoId:dto.id}:{tipo:"CRIAR",atendimentoId:p.atendimentoId});
  const intencao=pendente?.intencao??p.intencoes.para(alvo),a:Abertura={atorId:p.usuarioId,dono:p.intencoes,geracao:++sequencia.current,alvo,intencao,fuso:intencao.ler().comando?.fuso??p.fuso,porta:p.porta?.atendimentoId===p.atendimentoId?p.porta:null};
  ancora.current=origem??refDoMenu.current;abertaRef.current=a;setAbertura(a);return "abriu";
 },[]);
 const abrir=useCallback((origem?:HTMLElement)=>{abrirBase(undefined,origem);},[abrirBase]);
 const abrirEditar=useCallback((dto:AgendadaNoFio,origem?:HTMLElement)=>{abrirBase(dto,origem);},[abrirBase]);
 useEffect(()=>{const pedido=pedidoAbrir;if(!pedido||!intencoes||consumidos.current.has(pedido))return;if(abrirBase()==="aguardar")return;consumidos.current.add(pedido);aoPedidoConsumido?.();},[pedidoAbrir,leituraPronta,podeLer,podeEnviar,porta,intencoes,aoPedidoConsumido,abrirBase]);
 useEffect(()=>{const pedido=aguardandoPorta.current;if(props.porta&&pedido)abrirBase(pedido.dto,pedido.ancora);},[props.porta,abrirBase]);
 const chave=abertura?`${abertura.geracao}:${props.versao}:${tentativa}`:"";
 useEffect(()=>{if(!abertura||!props.intencoes||!props.podeLer||abertura.atorId!==props.usuarioId||abertura.dono!==props.intencoes)return;let vigente=true;const capturada=abertura,chaveCapturada=chave;
  void agendadasDoAtendimento(capturada.alvo.atendimentoId).then(lista=>{if(vigente&&viva.current&&abertaRef.current===capturada){if(capturada.alvo.tipo==="REAGENDAR"){const id=capturada.alvo.intencaoId,dto=lista.find(l=>l.id===id);if(dto)setEdicao(anterior=>anterior?.geracao===capturada.geracao?anterior:{geracao:capturada.geracao,dto});}setLeitura({chave:chaveCapturada,lista,erro:null});}}).catch(()=>{if(vigente&&viva.current&&abertaRef.current===capturada)setLeitura({chave:chaveCapturada,lista:null,erro:"Não foi possível carregar os agendamentos."});});
  return()=>{vigente=false;};
 },[abertura,chave,props.intencoes,props.podeLer,props.usuarioId]);
 const lerAgora=leitura?.chave===chave?leitura:null,lista=lerAgora?.lista??[],carregando=!!abertura&&!lerAgora;
 const idEditar=abertura?.alvo.tipo==="REAGENDAR"?abertura.alvo.intencaoId:null;
 const dto=idEditar?lista.find(l=>l.id===idEditar):undefined;
 const dtoExibido=dto??(edicao?.geracao===abertura?.geracao?edicao?.dto:undefined);
 const incerto=abertura?.intencao.ler().incerto===true;
 const faltouAlvo=!!abertura&&abertura.alvo.tipo==="REAGENDAR"&&!!lerAgora&&!lerAgora.erro&&!dto&&!incerto;
 const motivo=carregando?"Carregando agendamentos…":lerAgora?.erro??(faltouAlvo?"Agendamento não encontrado ou mudou de situação.":"Assuma a conversa para agendar a mensagem.");
 let dialogo:ReactNode=null;
 if(abertura&&props.intencoes&&props.podeLer&&abertura.atorId===props.usuarioId&&abertura.dono===props.intencoes){const capturada=abertura;
  const fecharCapturada=()=>{if(abertaRef.current===capturada)fechar();};
  const executar=async(c:ComandoAgendamento):Promise<Resultado<{id:string}>>=>{const p=atual.current,e=capturada.intencao.ler();
   if(!viva.current||abertaRef.current!==capturada||p.usuarioId!==capturada.atorId||p.intencoes!==capturada.dono||p.atendimentoId!==c.atendimentoId||!p.podeLer)return {ok:false,erro:"Você não pode acessar este atendimento."};
   if(!e.incerto&&!podeMutar(p))return {ok:false,erro:"Assuma a conversa para agendar a mensagem."};
   return c.tipo==="CRIAR"?agendarMensagemNoAtendimentoLocal({atendimentoId:c.atendimentoId,texto:c.texto,quandoLocal:c.quandoLocal,fuso:c.fuso,chaveIdempotencia:c.chaveIdempotencia}):reagendarAgendamentoDoAtendimento({atendimentoId:c.atendimentoId,intencaoId:c.intencaoId,quandoLocal:c.quandoLocal,fuso:c.fuso,chaveIdempotencia:c.chaveIdempotencia});
  };
  if(capturada.alvo.tipo==="REAGENDAR"&&!dtoExibido&&!incerto)dialogo=<PopoverFluxo titulo="Editar agendamento" ancora={ancora} aoFechar={fecharCapturada}><MensagemStatus texto={carregando?"Carregando agendamentos…":null}/><FeedbackAcao erro={lerAgora?.erro??(faltouAlvo?"Agendamento não encontrado ou mudou de situação.":null)}/>{lerAgora?.erro&&<Botao variante="neutro" onClick={()=>setTentativa(t=>t+1)}>Tentar de novo</Botao>}<Botao variante="neutro" onClick={fecharCapturada}>Cancelar</Botao></PopoverFluxo>;
  else dialogo=<PopoverAgendar key={capturada.geracao} atendimentoId={props.atendimentoId} nomeContato={props.nomeContato} fuso={capturada.fuso} textoInicial={capturada.porta?.textoAtual??""} ancora={ancora} agendadas={lista} respostas={props.respostas} variaveisResposta={props.variaveisResposta} intencao={capturada.intencao} executar={executar} editar={dto??(dtoExibido?{...dtoExibido,podeAlterar:false}:undefined)} agora={props.agora}
   podeAgendar={podeMutar(props)&&!!lerAgora&&!lerAgora.erro&&!faltouAlvo} podeRecuperar={props.podeLer} motivoBloqueio={motivo}
   estadoLeitura={carregando?"carregando":lerAgora?.erro?"erro":"ok"} erroLeitura={lerAgora?.erro??null} aoTentarLeitura={()=>setTentativa(t=>t+1)} insightsAplicaveis={props.insightsAplicaveis} versaoInsights={props.versaoInsights}
   aoSalvarRascunho={texto=>{const p=atual.current;if(!viva.current||abertaRef.current!==capturada||p.usuarioId!==capturada.atorId||p.intencoes!==capturada.dono||!p.podeLer||p.atendimentoId!==capturada.alvo.atendimentoId||!capturada.porta)return {ok:false,erro:"O rascunho mudou. Reabra o agendamento antes de salvar."};return capturada.porta.salvar({texto,revisaoEsperada:capturada.porta.revisao});}}
   aoFechar={fecharCapturada} aoConcluir={mensagem=>{if(viva.current&&abertaRef.current===capturada&&atual.current.atendimentoId===capturada.alvo.atendimentoId&&atual.current.usuarioId===capturada.atorId&&atual.current.intencoes===capturada.dono){fechar();setSucesso({atorId:capturada.atorId,mensagem});atual.current.aoConcluir(mensagem);}}}/>;
 }
 return {refDoMenu,abrir,abrirEditar,dialogo,feedback:<FeedbackAcao erro={erro??(abertura&&!props.podeLer?"Você não pode acessar este atendimento.":null)} sucesso={sucesso?.atorId===props.usuarioId?sucesso.mensagem:null}/>};
}