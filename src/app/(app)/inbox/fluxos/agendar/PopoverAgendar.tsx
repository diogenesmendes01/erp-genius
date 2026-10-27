"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type RefObject,type FormEvent} from "react";
import type {Resultado} from "@/server/_shared/resultado";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
import type {RespostaDoCompositor} from "@/components/conversa/respostas-rapidas";
import type {ComandoAgendamento,EntradaAgendamento,IntencaoAgendamento} from "./intencao-agendamento";
import {PopoverFluxo} from "../PopoverFluxo";
import {Botao} from "@/components/Botao";
import {Campo} from "@/components/Campo";
import {CampoTexto} from "@/components/CampoTexto";
import {CampoDataHoraLocal} from "@/components/CampoDataHoraLocal";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {MensagemStatus} from "@/components/MensagemStatus";
import {IconBolt} from "@tabler/icons-react";
import {aplicarVariaveisResposta} from "@/components/conversa/respostas-rapidas";
import {instanteDoCampoLocal,valorCampoLocal} from "@/server/operacao/fuso-entrada";
import {atalhosDeAgendamento} from "./atalhos-agendamento";
import {agendadaProxima} from "./conflito";
import {validarQuando} from "./validar-quando";
import {quandoAgendada} from "./quando-agendada";
import {useSugestaoAgendamento} from "../../insights/useSugestaoAgendamento";
export interface PropsPopoverAgendar {
 atendimentoId:string;fuso:string;nomeContato:string;textoInicial:string;ancora:RefObject<HTMLElement|null>;
 agendadas:readonly AgendadaNoFio[];respostas:readonly RespostaDoCompositor[];variaveisResposta:{nome?:string|null;responsavel?:string|null;curso?:string|null};
 intencao:IntencaoAgendamento;executar(c:ComandoAgendamento):Promise<Resultado<{id:string}>>;
 podeAgendar:boolean|null;podeRecuperar:boolean;motivoBloqueio?:string|null;editar?:AgendadaNoFio|null;relogio?():Date;podeSalvarRascunho?:boolean;
 insightsAplicaveis?:boolean;versaoInsights?:number;
 estadoLeitura?:"carregando"|"erro"|"ok";erroLeitura?:string|null;aoTentarLeitura?():void;
 aoSalvarRascunho(texto:string):Resultado;aoFechar():void;aoConcluir(mensagem:string):void;
}
function agoraReal(){return new Date();}
export function PopoverAgendar({atendimentoId,fuso,nomeContato,textoInicial,ancora,agendadas,respostas,variaveisResposta,intencao,executar,podeAgendar,podeRecuperar,motivoBloqueio,editar,relogio=agoraReal,podeSalvarRascunho=true,insightsAplicaveis=false,versaoInsights=0,estadoLeitura="ok",erroLeitura=null,aoTentarLeitura,aoSalvarRascunho,aoFechar,aoConcluir}:PropsPopoverAgendar){
 const estado=useSyncExternalStore(intencao.assinar,intencao.ler,intencao.ler);
 const modoEditar=!!editar||estado.comando?.tipo==="EDITAR";
 const [agoraAtual,setAgoraAtual]=useState(relogio);
 const [texto,setTexto]=useState(()=>{const c=intencao.ler().comando;return c?c.texto:editar?.texto??textoInicial;});
 const [quando,setQuando]=useState(()=>intencao.ler().comando?.quandoLocal??(editar?valorCampoLocal(editar.agendadaPara,fuso):atalhosDeAgendamento(agoraAtual,fuso).find(a=>a.id==="amanha9")?.valorLocal??""));
 const [erroLocal,setErroLocal]=useState<string|null>(null),[revisaoTexto,setRevisaoTexto]=useState(0);
 const viva=useRef(true);useEffect(()=>{viva.current=true;return()=>{viva.current=false;};},[]);
 const recuperando=estado.incerto&&estado.comando!==null;
 const fusoEfetivo=estado.comando?.fuso??fuso;
 const validacao=recuperando?null:validarQuando(quando,fusoEfetivo,agoraAtual);
 const conversao=instanteDoCampoLocal(quando,fusoEfetivo);
 const conflito=conversao.ok?agendadaProxima(conversao.instante,agendadas,editar?.id):null;
 const bloqueado=estado.ocupado||estado.incerto,somenteLeitura=bloqueado||!!editar&&!editar.podeAlterar;
 const permitido=recuperando?podeRecuperar:podeAgendar===true&&estadoLeitura==="ok"&&(!editar||editar.podeAlterar)&&!!texto.trim()&&texto.length<=4000&&!validacao;
 function mudarTexto(t:string){if(!viva.current||somenteLeitura)return;setAgoraAtual(relogio());intencao.reiniciar();setTexto(t);setRevisaoTexto(r=>r+1);setErroLocal(null);}
 const sugestao=useSugestaoAgendamento({atendimentoId,texto,revisao:revisaoTexto,ocupado:bloqueado,versao:versaoInsights,ativo:insightsAplicaveis&&!modoEditar,aoTexto:mudarTexto});
 function mudarQuando(valor:string){if(!viva.current||bloqueado)return;setAgoraAtual(relogio());intencao.reiniciar();setQuando(valor);setErroLocal(null);}
 async function enviar(e:FormEvent){e.preventDefault();if(!viva.current)return;if(intencao.ler().ocupado)return;
  const atual=intencao.ler(),recuperar=atual.incerto&&atual.comando!==null;
  if(recuperar&&!podeRecuperar){setErroLocal("Você não pode acessar este atendimento.");return;}
  if(!recuperar){const instante=relogio();setAgoraAtual(instante);const erro=validarQuando(quando,fusoEfetivo,instante);
   if(podeAgendar!==true||estadoLeitura!=="ok"||editar&&!editar.podeAlterar){setErroLocal(motivoBloqueio??(modoEditar?"Assuma a conversa para alterar a mensagem agendada.":"Assuma a conversa para agendar a mensagem."));return;}
   if(erro||!texto.trim()||texto.length>4000){setErroLocal(erro??"Escreva uma mensagem de até 4000 caracteres.");return;}
  }
  const entrada:EntradaAgendamento=recuperar&&atual.comando?atual.comando:editar?{tipo:"EDITAR",atendimentoId,intencaoId:editar.id,texto,quandoLocal:quando,fuso:fusoEfetivo}:{tipo:"CRIAR",atendimentoId,texto,quandoLocal:quando,fuso:fusoEfetivo};
  const resultado=await intencao.enviar(entrada,executar);
  if(viva.current&&resultado?.tipo==="ok")aoConcluir(modoEditar?"Agendamento atualizado.":"Mensagem agendada.");
 }
 function salvar(){if(!viva.current||bloqueado||modoEditar||!podeRecuperar||!podeSalvarRascunho)return;const r=aoSalvarRascunho(texto);if(r.ok){intencao.reiniciar();aoFechar();}else setErroLocal(r.erro);}
 return <PopoverFluxo titulo={modoEditar?"Editar agendamento":"Agendar mensagem"} ancora={ancora} aoFechar={aoFechar} ocupado={estado.ocupado}>
  <form onSubmit={e=>void enviar(e)} className="space-y-3">
   <Campo rotulo="Mensagem" obrigatorio>{c=><CampoTexto {...c} name="texto" rows={4} maxLength={4000} className="w-full rounded-lg border border-border-soft bg-brand-bg p-3 text-sm" value={texto} readOnly={somenteLeitura} onChange={e=>mudarTexto(e.target.value)}/>}</Campo>
   <div className="flex flex-wrap gap-1">{respostas.slice(0,5).map(r=><Botao key={r.id} variante="fantasma" tamanho="sm" disabled={somenteLeitura} onClick={()=>mudarTexto(aplicarVariaveisResposta(r.corpo,variaveisResposta))}><IconBolt size={14} aria-hidden/>{r.titulo}</Botao>)}</div>
   {insightsAplicaveis&&!modoEditar&&<><Botao variante="iaFantasma" tamanho="sm" disabled={!sugestao.disponivel||bloqueado} ocupado={sugestao.ocupado} onClick={sugestao.pedirUso}>Escrever com Aria</Botao><MensagemStatus texto={sugestao.aviso} progresso={sugestao.carregando?"Carregando sugestão…":null}/><FeedbackAcao erro={sugestao.erro} sucesso={sugestao.sucesso}/>{sugestao.confirmacao}</>}
   <fieldset className="space-y-2"><legend className="text-sm font-medium">Quando</legend><div className="flex flex-wrap gap-1">{atalhosDeAgendamento(agoraAtual,fusoEfetivo).map(a=><Botao key={a.id} aria-pressed={quando===a.valorLocal} variante={quando===a.valorLocal?"secundario":"fantasma"} tamanho="sm" disabled={bloqueado} onClick={()=>mudarQuando(a.valorLocal)}>{a.rotulo}</Botao>)}</div>
    <Campo rotulo="Data e hora" obrigatorio erro={quando?validacao:null}>{c=><CampoDataHoraLocal {...c} name="quandoLocal" fuso={fusoEfetivo} className="w-full rounded-lg border border-border-soft bg-surface p-2" value={quando} disabled={bloqueado} onChange={e=>mudarQuando(e.target.value)}/>}</Campo>
   </fieldset>
   {conflito&&<p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">Já existe uma mensagem agendada para {nomeContato} {quandoAgendada(conflito.agendadaPara,fusoEfetivo,agoraAtual)}, perto desse horário.</p>}
   {!recuperando&&podeAgendar!==true&&<p role="status" className="text-sm text-gray-600">{motivoBloqueio??(modoEditar?"Assuma a conversa para alterar a mensagem agendada.":"Assuma a conversa para agendar a mensagem.")}</p>}
   <FeedbackAcao erro={erroLocal??estado.erro??erroLeitura}/>{estadoLeitura==="erro"&&aoTentarLeitura&&<Botao variante="neutro" onClick={aoTentarLeitura}>Tentar de novo</Botao>}
   <div className="flex flex-wrap justify-end gap-2 border-t border-border-soft pt-3">{!modoEditar&&podeSalvarRascunho&&<Botao variante="fantasma" disabled={bloqueado||!podeRecuperar} onClick={salvar}>Salvar rascunho</Botao>}<Botao variante="neutro" disabled={estado.ocupado} onClick={aoFechar}>{estado.incerto?"Fechar":"Cancelar"}</Botao><Botao type="submit" ocupado={estado.ocupado} disabled={!permitido}>{recuperando?"Recuperar resultado":modoEditar?"Salvar":"Agendar"}</Botao></div>
  </form>
 </PopoverFluxo>;
}