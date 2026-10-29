"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type RefObject,type FormEvent} from "react";
import type {Resultado} from "@/server/_shared/resultado";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
import type {RespostaDoCompositor} from "@/components/conversa/respostas-rapidas";
import type {AnexoAgendamento,ComandoAgendamento,EntradaAgendamento,IntencaoAgendamento,VinculoAgendamento} from "./intencao-agendamento";
import {PopoverFluxo} from "../PopoverFluxo";
import {Botao} from "@/components/Botao";
import {Checkbox} from "@/components/ui/checkbox";
import {RadioGroup,RadioGroupItem} from "@/components/ui/radio-group";
import {garantirEstilo} from "@/app/(app)/inbox/garantir-estilo";
import {Campo} from "@/components/Campo";
import {CampoTexto} from "@/components/CampoTexto";
import {CampoDataHoraLocal} from "@/components/CampoDataHoraLocal";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {MensagemStatus} from "@/components/MensagemStatus";
import {IconBolt,IconChevronDown,IconChevronUp,IconFileCheck,IconPaperclip,IconX} from "@tabler/icons-react";
import {ACEITA_ANEXO} from "./subir-anexo";
import {aplicarVariaveisResposta} from "@/components/conversa/respostas-rapidas";
import {instanteDoCampoLocal,valorCampoLocal} from "@/server/operacao/fuso-entrada";
import {atalhosDeAgendamento} from "./atalhos-agendamento";
import {agendadaProxima} from "./conflito";
import {validarQuando} from "./validar-quando";
import {quandoAgendada} from "./quando-agendada";
import {useSugestaoAgendamento} from "../../insights/useSugestaoAgendamento";
export interface OpcoesAgendamento{oportunidadeId:string|null;propostas:readonly {id:string;nome:string}[];tarefas:readonly {id:string;titulo:string}[];erroPropostas?:boolean}
export interface PropsPopoverAgendar {
 atendimentoId:string;fuso:string;nomeContato:string;textoInicial:string;ancora:RefObject<HTMLElement|null>;
 agendadas:readonly AgendadaNoFio[];respostas:readonly RespostaDoCompositor[];variaveisResposta:{nome?:string|null;responsavel?:string|null;curso?:string|null};
 intencao:IntencaoAgendamento;executar(c:ComandoAgendamento):Promise<Resultado<{id:string}>>;
 podeAgendar:boolean|null;podeRecuperar:boolean;motivoBloqueio?:string|null;editar?:AgendadaNoFio|null;relogio?():Date;podeSalvarRascunho?:boolean;
 insightsAplicaveis?:boolean;versaoInsights?:number;
 opcoes?:OpcoesAgendamento|null;subirArquivo?(arquivo:File):Promise<Resultado<{url:string;nome:string}>>;
 estadoLeitura?:"carregando"|"erro"|"ok";erroLeitura?:string|null;aoTentarLeitura?():void;
 aoSalvarRascunho(texto:string):Resultado;aoFechar():void;aoConcluir(mensagem:string):void;
}
function agoraReal(){return new Date();}
export function PopoverAgendar({atendimentoId,fuso,nomeContato,textoInicial,ancora,agendadas,respostas,variaveisResposta,intencao,executar,podeAgendar,podeRecuperar,motivoBloqueio,editar,relogio=agoraReal,podeSalvarRascunho=true,insightsAplicaveis=false,versaoInsights=0,opcoes,subirArquivo,estadoLeitura="ok",erroLeitura=null,aoTentarLeitura,aoSalvarRascunho,aoFechar,aoConcluir}:PropsPopoverAgendar){
 garantirEstilo();
 const estado=useSyncExternalStore(intencao.assinar,intencao.ler,intencao.ler);
 const modoEditar=!!editar||estado.comando?.tipo==="EDITAR";
 const [agoraAtual,setAgoraAtual]=useState(relogio);
 const [texto,setTexto]=useState(()=>{const c=intencao.ler().comando;return c?c.texto:editar?.texto??textoInicial;});
 const [quando,setQuando]=useState(()=>intencao.ler().comando?.quandoLocal??(editar?valorCampoLocal(editar.agendadaPara,fuso):atalhosDeAgendamento(agoraAtual,fuso).find(a=>a.id==="amanha9")?.valorLocal??""));
 const [perguntar,setPerguntar]=useState(()=>{const c=intencao.ler().comando;return c?.tipo==="CRIAR"?c.perguntarSeResponder:true;});
 const [erroLocal,setErroLocal]=useState<string|null>(null),[revisaoTexto,setRevisaoTexto]=useState(0);
 const [anexo,setAnexo]=useState<AnexoAgendamento|null>(()=>{const c=intencao.ler().comando;return c?.tipo==="CRIAR"?c.anexo??null:null;});
 const [vinculo,setVinculo]=useState<VinculoAgendamento|null>(()=>{const c=intencao.ler().comando;return c?.tipo==="CRIAR"?c.vinculo??null:null;});
 const [maisOpcoes,setMaisOpcoes]=useState(()=>{const c=intencao.ler().comando;return c?.tipo==="CRIAR"&&!!c.vinculo;});
 const [painelProposta,setPainelProposta]=useState(false),[subindo,setSubindo]=useState(false);
 const arquivoRef=useRef<HTMLInputElement>(null);
 const viva=useRef(true);useEffect(()=>{viva.current=true;return()=>{viva.current=false;};},[]);
 const recuperando=estado.incerto&&estado.comando!==null;
 const fusoEfetivo=estado.comando?.fuso??fuso;
 const validacao=recuperando?null:validarQuando(quando,fusoEfetivo,agoraAtual);
 const conversao=instanteDoCampoLocal(quando,fusoEfetivo);
 const conflito=conversao.ok?agendadaProxima(conversao.instante,agendadas,editar?.id):null;
 const bloqueado=estado.ocupado||estado.incerto,somenteLeitura=bloqueado||!!editar&&!editar.podeAlterar;
 const anexoEditado=modoEditar&&editar?.temAnexo===true,comAnexo=!!anexo||anexoEditado;
 const permitido=recuperando?podeRecuperar:podeAgendar===true&&estadoLeitura==="ok"&&(!editar||editar.podeAlterar)&&(!!texto.trim()||comAnexo)&&!subindo&&texto.length<=4000&&!validacao;
 function mudarTexto(t:string){if(!viva.current||somenteLeitura)return;setAgoraAtual(relogio());intencao.reiniciar();setTexto(t);setRevisaoTexto(r=>r+1);setErroLocal(null);}
 const sugestao=useSugestaoAgendamento({atendimentoId,texto,revisao:revisaoTexto,ocupado:bloqueado,versao:versaoInsights,ativo:insightsAplicaveis&&!modoEditar,aoTexto:mudarTexto});
 function mudarQuando(valor:string){if(!viva.current||bloqueado)return;setAgoraAtual(relogio());intencao.reiniciar();setQuando(valor);setErroLocal(null);}
 async function enviar(e:FormEvent){e.preventDefault();if(!viva.current)return;if(intencao.ler().ocupado)return;
  const atual=intencao.ler(),recuperar=atual.incerto&&atual.comando!==null;
  if(recuperar&&!podeRecuperar){setErroLocal("Você não pode acessar este atendimento.");return;}
  if(!recuperar){const instante=relogio();setAgoraAtual(instante);const erro=validarQuando(quando,fusoEfetivo,instante);
   if(podeAgendar!==true||estadoLeitura!=="ok"||editar&&!editar.podeAlterar){setErroLocal(motivoBloqueio??(modoEditar?"Assuma a conversa para alterar a mensagem agendada.":"Assuma a conversa para agendar a mensagem."));return;}
   if(subindo)return;
   if(erro||(!texto.trim()&&!comAnexo)||texto.length>4000){setErroLocal(erro??"Escreva uma mensagem de até 4000 caracteres.");return;}
  }
  const entrada:EntradaAgendamento=recuperar&&atual.comando?atual.comando:editar?{tipo:"EDITAR",atendimentoId,intencaoId:editar.id,texto,quandoLocal:quando,fuso:fusoEfetivo}:{tipo:"CRIAR",atendimentoId,texto,quandoLocal:quando,fuso:fusoEfetivo,perguntarSeResponder:perguntar,...(anexo?{anexo}:{}),...(vinculo?{vinculo}:{})};
  const resultado=await intencao.enviar(entrada,executar);
  if(viva.current&&resultado?.tipo==="ok")aoConcluir(modoEditar?"Agendamento atualizado.":"Mensagem agendada.");
 }
 function mudarAnexo(a:AnexoAgendamento|null){if(!viva.current||bloqueado)return;setAgoraAtual(relogio());intencao.reiniciar();setAnexo(a);setPainelProposta(false);setErroLocal(null);}
 async function escolherArquivo(arquivo:File|undefined){if(!arquivo||!subirArquivo||!viva.current||bloqueado||subindo)return;setSubindo(true);setErroLocal(null);
  const r=await subirArquivo(arquivo).catch(()=>({ok:false as const,erro:"Falha no upload."}));if(!viva.current)return;setSubindo(false);
  if(r.ok&&r.dado)mudarAnexo({tipo:"arquivo",url:r.dado.url,nome:r.dado.nome});else setErroLocal(r.ok?"Falha no upload.":r.erro);}
 const tarefasVinculo=[...(opcoes?.tarefas??[]),...(vinculo?.tipo==="tarefa"&&!opcoes?.tarefas.some(t=>t.id===vinculo.tarefaId)?[{id:vinculo.tarefaId,titulo:vinculo.titulo}]:[])];
 const oportunidadeVinculo=opcoes?.oportunidadeId??(vinculo?.tipo==="oportunidade"?vinculo.leadId:null);
 const valorVinculo=vinculo?.tipo==="oportunidade"?"oportunidade":vinculo?.tipo==="tarefa"?"tarefa:"+vinculo.tarefaId:"";
 function mudarVinculo(valor:string){if(!viva.current||bloqueado)return;intencao.reiniciar();setErroLocal(null);
  const tarefa=valor.startsWith("tarefa:")?tarefasVinculo.find(t=>"tarefa:"+t.id===valor):undefined;
  setVinculo(valor==="oportunidade"&&oportunidadeVinculo?{tipo:"oportunidade",leadId:oportunidadeVinculo}:tarefa?{tipo:"tarefa",tarefaId:tarefa.id,titulo:tarefa.titulo}:null);}
 const avisoPropostas=opcoes===undefined?"Carregando propostas…":opcoes?.erroPropostas?"Não foi possível carregar as propostas.":!opcoes?.oportunidadeId?"Esta conversa não tem oportunidade com propostas.":"Nenhuma proposta nesta oportunidade.";
 function salvar(){if(!viva.current||bloqueado||modoEditar||!podeRecuperar||!podeSalvarRascunho)return;const r=aoSalvarRascunho(texto);if(r.ok){intencao.reiniciar();aoFechar();}else setErroLocal(r.erro);}
 return <PopoverFluxo titulo={modoEditar?"Editar agendamento":"Agendar mensagem"} ancora={ancora} aoFechar={aoFechar} ocupado={estado.ocupado}>
  <form onSubmit={e=>void enviar(e)} className="space-y-3">
   {anexoEditado&&<p className="flex min-w-0 items-center gap-1 text-sm text-gray-600"><IconPaperclip size={14} aria-hidden className="shrink-0"/><span className="min-w-0 truncate">{editar?.anexoNome?.trim()||"Anexo"}</span></p>}
   <Campo rotulo={anexoEditado?"Legenda":"Mensagem"} obrigatorio={!comAnexo}>{c=><CampoTexto {...c} name="texto" rows={4} maxLength={4000} className="w-full rounded-lg border border-border-soft bg-brand-bg p-3 text-sm" value={texto} readOnly={somenteLeitura} onChange={e=>mudarTexto(e.target.value)}/>}</Campo>
   <div className="flex flex-wrap gap-1">{respostas.slice(0,5).map(r=><Botao key={r.id} variante="fantasma" tamanho="sm" disabled={somenteLeitura} onClick={()=>mudarTexto(aplicarVariaveisResposta(r.corpo,variaveisResposta))}><IconBolt size={14} aria-hidden/>{r.titulo}</Botao>)}</div>
   {insightsAplicaveis&&!modoEditar&&<><Botao variante="iaFantasma" tamanho="sm" disabled={!sugestao.disponivel||bloqueado} ocupado={sugestao.ocupado} onClick={sugestao.pedirUso}>Escrever com Aria</Botao><MensagemStatus texto={sugestao.aviso} progresso={sugestao.carregando?"Carregando sugestão…":null}/><FeedbackAcao erro={sugestao.erro} sucesso={sugestao.sucesso}/>{sugestao.confirmacao}</>}
   <fieldset className="space-y-2"><legend className="text-sm font-medium">Quando</legend><div className="flex flex-wrap gap-1">{atalhosDeAgendamento(agoraAtual,fusoEfetivo).map(a=><Botao key={a.id} aria-pressed={quando===a.valorLocal} variante={quando===a.valorLocal?"secundario":"fantasma"} tamanho="sm" disabled={bloqueado} onClick={()=>mudarQuando(a.valorLocal)}>{a.rotulo}</Botao>)}</div>
    <Campo rotulo="Data e hora" obrigatorio erro={quando?validacao:null}>{c=><CampoDataHoraLocal {...c} name="quandoLocal" fuso={fusoEfetivo} className="w-full rounded-lg border border-border-soft bg-surface p-2" value={quando} disabled={bloqueado} onChange={e=>mudarQuando(e.target.value)}/>}</Campo>
   </fieldset>
   {!modoEditar&&<label className="flex items-start gap-2 text-sm"><Checkbox name="perguntarSeResponder" checked={perguntar} disabled={bloqueado} onCheckedChange={valor=>{if(!viva.current||bloqueado)return;intencao.reiniciar();setPerguntar(valor===true);setErroLocal(null);}}/>Perguntar antes de enviar se o contato responder</label>}
   {!modoEditar&&<fieldset className="space-y-2"><legend className="text-sm font-medium">Anexar</legend>
    <div className="flex flex-wrap gap-1">
     <Botao variante={anexo?.tipo==="proposta"||painelProposta?"secundario":"fantasma"} tamanho="sm" aria-pressed={anexo?.tipo==="proposta"} aria-expanded={painelProposta} disabled={bloqueado||subindo} onClick={()=>setPainelProposta(v=>!v)}><IconFileCheck size={14} aria-hidden/>Proposta</Botao>
     <Botao variante={anexo?.tipo==="arquivo"?"secundario":"fantasma"} tamanho="sm" aria-pressed={anexo?.tipo==="arquivo"} ocupado={subindo} disabled={bloqueado||!subirArquivo} onClick={()=>arquivoRef.current?.click()}><IconPaperclip size={14} aria-hidden/>Arquivo</Botao>
    </div>
    <input ref={arquivoRef} type="file" name="arquivoAnexo" accept={ACEITA_ANEXO} hidden tabIndex={-1} aria-hidden onChange={e=>{const f=e.target.files?.[0];e.target.value="";void escolherArquivo(f);}}/>
    <MensagemStatus texto={null} progresso={subindo?"Enviando arquivo…":null}/>
    {painelProposta&&(opcoes?.propostas.length?<ul aria-label="Propostas da oportunidade" className="max-h-40 space-y-1 overflow-y-auto">{opcoes.propostas.map(p=><li key={p.id}><button type="button" aria-pressed={anexo?.tipo==="proposta"&&anexo.documentoId===p.id} disabled={bloqueado} onClick={()=>mudarAnexo({tipo:"proposta",documentoId:p.id,nome:p.nome})} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-gray-800 hover:bg-highlight disabled:opacity-50"><IconFileCheck size={16} aria-hidden className="shrink-0 text-green-700"/><span className="min-w-0 flex-1 truncate">{p.nome}</span></button></li>)}</ul>:<p role="status" className="text-sm text-gray-600">{avisoPropostas}</p>)}
    {anexo&&<p className="flex items-center gap-2 rounded-lg bg-brand-bg px-2 py-1 text-sm text-brand-800"><IconPaperclip size={14} aria-hidden className="shrink-0"/><span className="min-w-0 flex-1 truncate">{anexo.nome}</span><button type="button" aria-label="Remover anexo" disabled={bloqueado} onClick={()=>mudarAnexo(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight"><IconX size={14} aria-hidden/></button></p>}
   </fieldset>}
   {!modoEditar&&<div><Botao variante="fantasma" tamanho="sm" aria-expanded={maisOpcoes} disabled={bloqueado} onClick={()=>setMaisOpcoes(v=>!v)}>{maisOpcoes?<IconChevronUp size={14} aria-hidden/>:<IconChevronDown size={14} aria-hidden/>}Mais opções</Botao>
    {maisOpcoes&&<fieldset className="mt-2 space-y-1"><legend className="text-sm font-medium">Vincular a</legend>
     <RadioGroup name="vinculo" value={valorVinculo||"__nenhum__"} disabled={bloqueado} onValueChange={valor=>mudarVinculo(valor==="__nenhum__"?"":valor)}>{[{valor:"",rotulo:"Nenhum"},...(oportunidadeVinculo?[{valor:"oportunidade",rotulo:"Oportunidade"}]:[]),...tarefasVinculo.map(t=>({valor:"tarefa:"+t.id,rotulo:"Tarefa · "+t.titulo}))].map(o=><label key={o.valor||"nenhum"} className="flex min-h-8 items-center gap-2 text-sm"><RadioGroupItem value={o.valor||"__nenhum__"} disabled={bloqueado}/><span className="min-w-0 truncate">{o.rotulo}</span></label>)}</RadioGroup>
    </fieldset>}
   </div>}
   {conflito&&<p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">Já existe uma mensagem agendada para {nomeContato} {quandoAgendada(conflito.agendadaPara,fusoEfetivo,agoraAtual)}, perto desse horário.</p>}
   {!recuperando&&podeAgendar!==true&&<p role="status" className="text-sm text-gray-600">{motivoBloqueio??(modoEditar?"Assuma a conversa para alterar a mensagem agendada.":"Assuma a conversa para agendar a mensagem.")}</p>}
   <FeedbackAcao erro={erroLocal??estado.erro??erroLeitura}/>{estadoLeitura==="erro"&&aoTentarLeitura&&<Botao variante="neutro" onClick={aoTentarLeitura}>Tentar de novo</Botao>}
   <div className="flex flex-wrap justify-end gap-2 border-t border-border-soft pt-3">{!modoEditar&&podeSalvarRascunho&&<Botao variante="fantasma" disabled={bloqueado||!podeRecuperar} onClick={salvar}>Salvar rascunho</Botao>}<Botao variante="neutro" disabled={estado.ocupado} onClick={aoFechar}>{estado.incerto?"Fechar":"Cancelar"}</Botao><Botao type="submit" ocupado={estado.ocupado} disabled={!permitido}>{recuperando?"Recuperar resultado":modoEditar?"Salvar":"Agendar"}</Botao></div>
  </form>
 </PopoverFluxo>;
}