"use client";
import {useEffect,useRef,useState,type ChangeEvent,type FormEvent} from "react";
import type {TipoTarefa,PrioridadeTarefa} from "@prisma/client";
import {IconMessageCircle,IconPhone,IconMail,IconCalendar,IconCircleDot,IconClock} from "@tabler/icons-react";
import {OpcoesTarefaD10,CampoLembreteTarefaD10,type PropsOpcoesTarefaD10} from "./OpcoesTarefaD10";
import {usePreviaNotificadosTarefa} from "./usePreviaNotificadosTarefa";
import {Avatar,tomDoAvatar} from "@/components/Avatar";
import {Modal} from "@/components/Modal";
import {ConfirmarAcao} from "@/components/ConfirmarAcao";
import {Botao} from "@/components/Botao";
import {CampoTexto} from "@/components/CampoTexto";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {MensagemStatus} from "@/components/MensagemStatus";
import {useAcaoCliente} from "@/lib/acao-cliente";
import {useChaveIdempotencia} from "@/lib/chave-idempotencia";
import {rotular,TIPO_TAREFA_LABEL,PRIORIDADE_TAREFA_LABEL} from "@/lib/labels";
import {atalhosDeHorario,partesDoValorLocal} from "@/lib/atalhos-horario";
import type {DadosModalTarefa,EditarTarefaInboxInput} from "@/server/inbox/tarefas-edicao";
import {dadosModalTarefaNoInbox,criarTarefaNoInbox,editarTarefaNoInbox,cancelarTarefaNoInbox} from "@/server/inbox/acoes-painel";
import {camposAlterados,type CamposFormulario} from "../tarefas/edicao";
import {validarTarefaModal,mensagemNaDataAgendavel,validarMensagemNaData} from "./tarefa-modal-regras";
type Props={atendimentoId:string;modo:{tipo:"nova"}|{tipo:"editar";tarefa:{id:string;versao:number}};fuso:string|null;alvoDisponivel?:boolean;aoFechar():void;aoSalvo():void};
const ICONE_TIPO_TAREFA={WHATSAPP:IconMessageCircle,LIGACAO:IconPhone,EMAIL:IconMail,REUNIAO:IconCalendar,OUTRO:IconCircleDot} satisfies Record<TipoTarefa,typeof IconMessageCircle>;
const PRIORIDADES=Object.keys(PRIORIDADE_TAREFA_LABEL).map(p=>({valor:p as PrioridadeTarefa,rotulo:rotular(PRIORIDADE_TAREFA_LABEL,p)}));
const LEMBRETES=[{valor:null,rotulo:"Sem lembrete"},{valor:0,rotulo:"Na hora"},{valor:10,rotulo:"10 min antes"},{valor:15,rotulo:"15 min antes"},{valor:30,rotulo:"30 min antes"},{valor:60,rotulo:"1 h antes"},{valor:1440,rotulo:"1 dia antes"}] as const;
const inicial:CamposFormulario={titulo:"",tipo:"WHATSAPP",descricao:"",duracaoMin:30,prioridade:"NORMAL",recorrencia:"NAO_REPETE",dataCivil:null,hora:null,lembreteAntecedenciaMin:null};
export function ModalTarefa(props:Props){return <SessaoModalTarefa key={props.atendimentoId+":"+(props.modo.tipo==="editar"?props.modo.tarefa.id:"nova")} {...props}/>;}
function SessaoModalTarefa({atendimentoId,modo,alvoDisponivel=true,aoFechar,aoSalvo}:Props){
 const nova=modo.tipo==="nova",tid=modo.tipo==="editar"?modo.tarefa.id:undefined;
 const vivo=useRef(false),enviando=useRef(false),chave=useChaveIdempotencia();
 const exec=useAcaoCliente({idempotente:nova});
 const [dados,setDados]=useState<DadosModalTarefa|null>(null),[carregando,setCarregando]=useState(true),[erroCarga,setErroCarga]=useState<string|null>(null),[recarregar,setRecarregar]=useState(0);
 const [campos,setCampos]=useState<CamposFormulario>(inicial),antes=useRef<CamposFormulario>(inicial);
 const [responsavel,setResponsavel]=useState<string|null>(null),[vincular,setVincular]=useState(false),[jaFeita,setJaFeita]=useState(false),[mais,setMais]=useState(false),[erro,setErro]=useState<string|null>(null);
 const [notificados,setNotificados]=useState<string[]>([]),notificadosAntes=useRef<string[]>([]);
 const [cancelando,setCancelando]=useState(false),[motivo,setMotivo]=useState("");
 const [mensagem,setMensagem]=useState(false),[textoMensagem,setTextoMensagem]=useState(""),chaveMensagem=useChaveIdempotencia();
 const [obsoleta,setObsoleta]=useState(false);
 const versaoAtual=modo.tipo==="editar"?modo.tarefa.versao:null;
 const [versaoInicial]=useState(versaoAtual);
 const [envioEmCurso,setEnvioEmCurso]=useState(false);
 if((versaoAtual!==versaoInicial||!alvoDisponivel)&&!obsoleta&&!envioEmCurso)setObsoleta(true);
 const previa=usePreviaNotificadosTarefa({habilitado:!!dados&&!obsoleta,atendimentoId,modo,responsavelId:responsavel,contextoEsperado:(nova?dados?.contextoEsperado:dados?.contextoIdentidadeEsperada)??"",iniciais:dados?.notificadosPossiveis??[]});
 const patchOpcoes:PropsOpcoesTarefaD10["aoMudar"]=p=>{if(p.recorrencia!==undefined)mudar("recorrencia",p.recorrencia);if(p.prioridade!==undefined)mudar("prioridade",p.prioridade);if(p.lembreteAntecedenciaMin!==undefined)mudar("lembreteAntecedenciaMin",p.lembreteAntecedenciaMin);if(p.notificarUsuarioIds!==undefined)setNotificados(p.notificarUsuarioIds);};
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useEffect(()=>{
  let ativa=true;
  async function carregar(){try{const r=await dadosModalTarefaNoInbox(atendimentoId,tid);if(!ativa)return;if(!r.ok||!r.dado){setErroCarga(r.ok?"Dados indisponíveis.":r.erro);return;}const d=r.dado;setDados(d);const t=d.tarefa;
   const amanha=atalhosDeHorario(new Date(),d.fusoEscola).find(a=>a.id==="amanha9");
   const c:CamposFormulario=t?{titulo:t.titulo,tipo:t.tipo,descricao:t.descricao,duracaoMin:t.duracaoMin,prioridade:t.prioridade,recorrencia:t.recorrencia,dataCivil:t.dataCivil,hora:t.hora,lembreteAntecedenciaMin:t.lembreteAntecedenciaMin}:{...inicial,...(amanha?partesDoValorLocal(amanha.valorLocal):{})};
   notificadosAntes.current=[...(t?.notificarUsuarioIds??[])].sort();setNotificados(notificadosAntes.current);
   antes.current=c;setCampos(c);setResponsavel(t?t.responsavelId:d.usuarioId);setVincular(t?t.vinculadaAtual:!!d.oportunidade);
  }catch{if(ativa)setErroCarga("Não foi possível carregar o formulário. Tente novamente.");}finally{if(ativa)setCarregando(false);}}
  void carregar();return()=>{ativa=false;};
 },[atendimentoId,tid,recarregar]);
 function mudar<K extends keyof CamposFormulario>(nome:K,valor:CamposFormulario[K]){setCampos(c=>({...c,[nome]:valor}));setErro(null);}
 async function salvar(e:FormEvent){e.preventDefault();if(!dados||enviando.current||obsoleta)return;
  const agendaMudou=nova||campos.dataCivil!==antes.current.dataCivil||campos.hora!==antes.current.hora||campos.lembreteAntecedenciaMin!==antes.current.lembreteAntecedenciaMin;
  const validacao=validarTarefaModal({...campos,...(!agendaMudou?{dataCivil:null,hora:null,lembreteAntecedenciaMin:null}:{}),fusoEscola:dados.fusoEscola});if(validacao){setErro(validacao);return;}
  const vinculo:EditarTarefaInboxInput["vinculo"]=nova||vincular===dados.tarefa?.vinculadaAtual?"manter":vincular?"vincularAtual":"remover";
  const selecao=[...new Set(notificados)].sort(),notificadosMudou=JSON.stringify(selecao)!==JSON.stringify(notificadosAntes.current);
  if(selecao.length>200){setErro("Selecione no máximo 200 colegas.");return;}
  const comMensagem=nova&&mensagem&&dados.podeAgendarMensagem&&!jaFeita;
  if(comMensagem){const v=validarMensagemNaData(textoMensagem);if(v){setErro(v);return;}}
  if(notificadosMudou&&(previa.carregando||previa.erro)){setErro("Atualize os colegas disponíveis antes de salvar a seleção.");return;}
  const diff=camposAlterados(antes.current,{...campos,titulo:campos.titulo.trim(),descricao:campos.descricao.trim()});
  if(!nova&&!Object.keys(diff).length&&responsavel===dados.tarefa?.responsavelId&&vinculo==="manter"&&!notificadosMudou){aoFechar();return;}
  enviando.current=true;setEnvioEmCurso(true);
  const contexto={contextoEsperado:!nova&&vinculo==="manter"?dados.contextoIdentidadeEsperada:dados.contextoEsperado,fusoEscolaEsperado:dados.fusoEscola};
  const r=nova?await exec.executar(()=>criarTarefaNoInbox(atendimentoId,{...campos,titulo:campos.titulo.trim(),descricao:campos.descricao.trim(),...(selecao.length?{notificarUsuarioIds:selecao}:{}),responsavelId:responsavel,vincularOportunidade:vincular,jaFeita,chaveIdempotencia:chave.atual,...(comMensagem?{mensagem:{texto:textoMensagem.trim(),chaveIdempotencia:chaveMensagem.atual}}:{}),...contexto})):await exec.executar(()=>editarTarefaNoInbox(atendimentoId,dados.tarefa!.id,dados.tarefa!.versao,{...diff,...(notificadosMudou?{notificarUsuarioIds:selecao}:{}),...(responsavel!==dados.tarefa!.responsavelId?{responsavelId:responsavel}:{}),vinculo,...contexto}));
  enviando.current=false;if(!vivo.current)return;setEnvioEmCurso(false);
  if(r?.tipo==="ok"){if(nova){chave.depoisDo(r);chaveMensagem.depoisDo(r);}aoSalvo();}
  else if(r?.tipo==="erro"&&(r.mensagem.includes("Recarregue")||r.mensagem.includes("Reabra")||r.mensagem.includes("não encontrada")||r.mensagem.includes("permissão")))setObsoleta(true);
 }
 if(cancelando&&dados?.tarefa)return <ConfirmarAcao titulo={"Cancelar a tarefa “"+dados.tarefa.titulo+"”?"} confirmacao="cancelamento" folha idempotente={true} podeConfirmar={!obsoleta&&motivo.trim().length>0&&motivo.trim().length<=500} acao={async()=>{setEnvioEmCurso(true);try{return await cancelarTarefaNoInbox(atendimentoId,dados.tarefa!.id,dados.tarefa!.versao,motivo.trim());}finally{if(vivo.current)setEnvioEmCurso(false);}}} aoCancelar={()=>setCancelando(false)} aoConcluir={()=>{if(vivo.current)aoSalvo();}} aoFalhar={f=>{if(vivo.current&&f.tipo==="erro"&&(f.mensagem.includes("Recarregue")||f.mensagem.includes("permissão")||f.mensagem.includes("não encontrada")))setObsoleta(true);}}><p>A tarefa será cancelada e continuará no histórico.</p><label className="grid gap-1 text-sm">Motivo<CampoTexto value={motivo} required minLength={1} maxLength={500} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>setMotivo(e.target.value)} className="rounded-md border border-border-soft bg-surface p-2"/></label>{obsoleta&&<FeedbackAcao erro="A tarefa mudou. Feche e reabra o formulário."/>}</ConfirmarAcao>;
 return <Modal titulo={nova?"Nova tarefa":"Editar tarefa"} aoFechar={aoFechar} bloquearFechamento={exec.ocupado} folha>
  <MensagemStatus texto={carregando?"Carregando formulário…":previa.carregando?"Atualizando colegas disponíveis…":null}/>
  {carregando?null:erroCarga?<div className="space-y-3"><FeedbackAcao erro={erroCarga}/><Botao variante="secundario" onClick={()=>{setCarregando(true);setErroCarga(null);setRecarregar(v=>v+1);}}>Tentar novamente</Botao><Botao variante="fantasma" onClick={aoFechar}>Fechar</Botao></div>:dados&&<form onSubmit={salvar} noValidate className="space-y-4">
   <header className="flex items-center gap-3 border-b border-border-soft pb-3"><Avatar nome={dados.contatoNome} tamanho={32} tom={tomDoAvatar(atendimentoId)}/><div><p className="text-sm font-medium">{dados.contatoNome}</p><p className="text-xs text-gray-600">Conversa vinculada</p></div></header>
   <label className="grid gap-1 text-sm">Título<input aria-label="Título da tarefa" placeholder="O que precisa ser feito?" maxLength={200} value={campos.titulo} onChange={e=>mudar("titulo",e.target.value)} aria-invalid={!!erro} className="w-full border-b border-border-soft bg-surface py-2 text-[17px]"/><span className="text-xs text-gray-600">{campos.titulo.length}/200</span></label>
   <fieldset className="flex flex-wrap gap-1"><legend className="text-sm">Tipo</legend>{(Object.keys(TIPO_TAREFA_LABEL) as TipoTarefa[]).map(tipo=>{const Icone=ICONE_TIPO_TAREFA[tipo];return <Botao key={tipo} variante="secundario" tamanho="sm" aria-pressed={campos.tipo===tipo} onClick={()=>mudar("tipo",tipo)}><Icone size={14} aria-hidden/>{rotular(TIPO_TAREFA_LABEL,tipo)}</Botao>;})}</fieldset>
   <fieldset className="space-y-2"><legend className="text-sm">Quando</legend>{!nova&&campos.dataCivil&&<span className="inline-block rounded-full border border-border-soft px-3 py-1 text-xs">{campos.dataCivil.split("-").reverse().slice(0,2).join("/")}{campos.hora?" · "+campos.hora:""}</span>}<div className="flex flex-wrap gap-1">{atalhosDeHorario(new Date(),dados.fusoEscola).map(a=><Botao key={a.id} variante="fantasma" tamanho="sm" onClick={()=>{const atual=atalhosDeHorario(new Date(),dados.fusoEscola).find(x=>x.id===a.id);if(atual)setCampos(c=>({...c,...partesDoValorLocal(atual.valorLocal)}));}}>{a.rotulo}</Botao>)}<Botao variante="fantasma" tamanho="sm" onClick={()=>setCampos(c=>({...c,dataCivil:null,hora:null,lembreteAntecedenciaMin:null}))}>Sem prazo</Botao></div><div className="flex flex-wrap gap-2"><label className="grid gap-1 text-sm">Data<input type="date" aria-label="Data da tarefa" value={campos.dataCivil??""} onChange={e=>mudar("dataCivil",e.target.value||null)} className="rounded-md border border-border-soft bg-surface p-2"/></label><label className="grid gap-1 text-sm">Horário<input type="time" aria-label="Horário da tarefa" value={campos.hora??""} onChange={e=>mudar("hora",e.target.value||null)} className="rounded-md border border-border-soft bg-surface p-2"/></label></div><p className="text-xs text-gray-600">Horário da escola · {dados.fusoEscola}</p>{!nova&&dados.tarefa?.recorrencia&&dados.tarefa.recorrencia!=="NAO_REPETE"&&campos.recorrencia===dados.tarefa.recorrencia&&<p className="text-xs text-gray-600">Alterar a data ou o horário muda apenas esta ocorrência. As próximas seguem o calendário original.</p>}</fieldset>
   {dados.podeAtribuirResponsavel&&<label className="grid gap-1 text-sm">Responsável<select aria-label="Responsável" value={responsavel??""} onChange={e=>setResponsavel(e.target.value||null)} className="rounded-md border border-border-soft bg-surface p-2"><option value={dados.usuarioId}>Você</option><option value="">Sem responsável</option>{dados.responsaveis.filter(u=>u.id!==dados.usuarioId).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>}
   <CampoLembreteTarefaD10 lembrete={campos.lembreteAntecedenciaMin} lembretes={LEMBRETES} ocupado={exec.ocupado||obsoleta} aoMudar={patchOpcoes}/>
   <label className="grid gap-1 text-sm">Descrição<CampoTexto aria-label="Descrição da tarefa" value={campos.descricao} maxLength={2000} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>mudar("descricao",e.target.value)} className="rounded-md border border-border-soft bg-surface p-2"/></label>
   {dados.oportunidade&&(nova||dados.tarefa?.podeAlterarVinculo)?<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={vincular} onChange={e=>setVincular(e.target.checked)}/>Vincular à oportunidade · {dados.oportunidade.titulo}</label>:dados.tarefa?.leadId&&<p className="text-xs text-gray-600">Vínculo original preservado. A oportunidade desse vínculo não está disponível neste contexto.</p>}
   {nova&&<div className="space-y-2 rounded-md border border-border-soft p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mensagem&&dados.podeAgendarMensagem&&!jaFeita} disabled={!dados.podeAgendarMensagem||jaFeita||exec.ocupado||obsoleta} onChange={e=>{setMensagem(e.target.checked);setErro(null);}}/><span className="flex-1">Enviar mensagem nesta data</span><IconClock size={14} aria-hidden className="text-gray-600"/></label>
    {!dados.podeAgendarMensagem?<p className="text-xs text-gray-600">Assuma a conversa para agendar a mensagem.</p>:jaFeita?<p className="text-xs text-gray-600">Tarefa já feita não agenda mensagem.</p>:mensagem&&<><CampoTexto aria-label="Mensagem ao contato" placeholder="Mensagem que será enviada ao contato" rows={2} maxLength={4096} value={textoMensagem} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>{setTextoMensagem(e.target.value);setErro(null);}} className="rounded-md border border-border-soft bg-surface p-2"/>{!mensagemNaDataAgendavel({dataCivil:campos.dataCivil??null,hora:campos.hora??null,fusoEscola:dados.fusoEscola})&&<p className="text-xs text-gray-600">A mensagem só é agendada quando a tarefa tem data e horário no futuro.</p>}</>}</div>}
   <OpcoesTarefaD10 recorrencia={campos.recorrencia??"NAO_REPETE"} mostrarLembrete={false} abertas={mais} aoAlternar={()=>setMais(v=>!v)} prioridade={campos.prioridade} prioridades={PRIORIDADES} lembrete={campos.lembreteAntecedenciaMin} lembretes={LEMBRETES} colegas={previa.candidatos} notificados={notificados} podeNotificar={!previa.carregando&&!previa.erro} ocupado={exec.ocupado||obsoleta} aoMudar={patchOpcoes}/>
   {notificados.length>0&&campos.lembreteAntecedenciaMin===null&&<p className="text-sm text-gray-600">As seleções ficam salvas. Os colegas só recebem aviso quando houver lembrete.</p>}
   <FeedbackAcao erro={previa.erro}/>{previa.erro&&<Botao variante="fantasma" tamanho="sm" onClick={previa.atualizar}>Atualizar colegas</Botao>}
   <FeedbackAcao erro={erro??exec.erro}/>{obsoleta&&<FeedbackAcao erro="O formulário ficou desatualizado. Feche e reabra antes de salvar."/>}
   <footer className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">{nova?<label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={jaFeita} onChange={e=>setJaFeita(e.target.checked)}/>Já foi feita</label>:<Botao variante="perigo" tamanho="sm" disabled={exec.ocupado||obsoleta} onClick={()=>setCancelando(true)}>Cancelar tarefa</Botao>}<Botao variante="fantasma" disabled={exec.ocupado} onClick={aoFechar}>Cancelar</Botao><Botao type="submit" variante={campos.titulo.trim()?"primario":"neutro"} ocupado={exec.ocupado} disabled={obsoleta}>{nova?"Criar tarefa":"Salvar"}</Botao></footer>
  </form>}
 </Modal>;
}
