"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Papel } from "@prisma/client";
import { listarLinhasNovaConversa, consultarTelefoneNovaConversa } from "@/server/whatsapp/nova-conversa-consultas";
import { listarVendedoresNovaConversa } from "@/server/whatsapp/nova-conversa-vendedores";
import { iniciarConversaPorNumero } from "@/server/whatsapp/nova-conversa-acoes";
import { Botao } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import type { EntradaTelefone, IntencaoNovaConversa } from "./intencao-nova-conversa";
export type PropsPorNumero={usuario:{id:string;papeis:Papel[]};intencao:IntencaoNovaConversa;aoSelecionar(id:string):void;aoFechar():void};
type Preview={tipo:"NOVO"|"EXISTENTE"|"RECUSAR";telefoneE164:string};
const classe="w-full rounded-md border border-gray-300 px-3 py-2";
export function NovaConversaPorNumero({usuario,intencao,aoSelecionar,aoFechar}:PropsPorNumero){
 const estado=useSyncExternalStore(intencao.assinar,intencao.ler,intencao.ler),id=useId();
 const [,renderizar]=useState(0);
 const [telefone,setTelefone]=useState(""),[numero,setNumero]=useState(""),[owner,setOwner]=useState(""),[nome,setNome]=useState("");
 const [linhas,setLinhas]=useState<{id:string;rotulo:string}[]>([]),[vendedores,setVendedores]=useState<{id:string;nome:string}[]>([]);
 const [preview,setPreview]=useState<Preview|null>(null),[erro,setErro]=useState<string|null>(null),[carregando,setCarregando]=useState(true),[consultando,setConsultando]=useState(false);
 const geracao=useRef(0),ativo=useRef(false),consultaEmCurso=useRef(false);
 const vendedor=usuario.papeis.includes(Papel.VENDEDOR),perfil=JSON.stringify(usuario),geracaoRender=geracao.current;
 useLayoutEffect(()=>{ativo.current=true;geracao.current++;return()=>{ativo.current=false;};},[perfil]);
 useEffect(()=>{
  let vigente=true;
  Promise.all([listarLinhasNovaConversa(),vendedor?Promise.resolve(null):listarVendedoresNovaConversa()]).then(([ls,vs])=>{
   if(!vigente)return;
   if(!ls.ok){setErro(ls.erro);setLinhas([]);}else setLinhas(ls.dado?.linhas??[]);
   if(vs){if(!vs.ok){setErro(vs.erro);setVendedores([]);}else setVendedores(vs.dado?.vendedores??[]);}
   setCarregando(false);
  }).catch(()=>{if(vigente){setErro("Não foi possível carregar as opções. Feche e abra novamente.");setCarregando(false);}});
  return()=>{vigente=false;};
 },[perfil,vendedor]);
 function alterar(fn:()=>void){if(estado.comando||estado.ocupado)return;geracao.current++;consultaEmCurso.current=false;setConsultando(false);setPreview(null);setErro(null);setOwner("");fn();renderizar(v=>v+1);}
 async function conferir(){
  if(!ativo.current||geracaoRender!==geracao.current||consultaEmCurso.current||intencao.ler().comando||!telefone.trim()||!linhas.some(n=>n.id===numero))return;
  const versao=++geracao.current;consultaEmCurso.current=true;setConsultando(true);setPreview(null);setErro(null);
  try{const r=await consultarTelefoneNovaConversa({telefone,numeroId:numero});if(!ativo.current||versao!==geracao.current)return;if(r.ok)setPreview(r.dado??null);else setErro(r.erro);}
  catch{if(ativo.current&&versao===geracao.current)setErro("Não foi possível conferir o número. Tente novamente.");}
  finally{if(ativo.current&&versao===geracao.current){consultaEmCurso.current=false;setConsultando(false);}}
 }
 async function iniciar(){
  if(!ativo.current||geracaoRender!==geracao.current||intencao.ler().ocupado)return;
  const pendente=intencao.ler().comando;
  let entrada:EntradaTelefone;
  if(pendente)entrada=pendente;
  else{
   if(!preview||preview.tipo==="RECUSAR"||!linhas.some(n=>n.id===numero))return;
   if(preview.tipo==="EXISTENTE")entrada={modo:"EXISTENTE",telefone:preview.telefoneE164,numeroId:numero};
   else{const ownerId=vendedor?usuario.id:owner;if(!ownerId||(!vendedor&&!vendedores.some(v=>v.id===ownerId)))return;entrada={modo:"NOVO",telefone:preview.telefoneE164,numeroId:numero,ownerId,...(nome.trim()?{nome:nome.trim()}:{})};}
  }
  const versao=geracao.current,r=await intencao.enviar(entrada,iniciarConversaPorNumero);
  if(!ativo.current||versao!==geracao.current)return;
  if(r?.tipo==="ok"&&r.dado){geracao.current++;setPreview(null);aoSelecionar(r.dado.atendimentoId);aoFechar();}
 }
 const travado=!!estado.comando||estado.ocupado;
 return <section aria-labelledby={`${id}-titulo`} className="space-y-3 border-t pt-3">
  <h3 id={`${id}-titulo`} className="font-medium">Conversar por telefone</h3>
  <p className="text-sm text-gray-600">Saudação: escreva e envie pelo campo da conversa após abrir o atendimento. Nenhuma mensagem é enviada automaticamente.</p>
  {estado.comando?<div className="space-y-2"><p className="text-sm">Tentativa {estado.comando.modo==="NOVO"?"de novo cadastro":"de abertura"} para {estado.comando.telefone}. Reenvie os mesmos dados para confirmar o resultado.</p><Botao disabled={estado.ocupado} onClick={iniciar}>{estado.ocupado?"Confirmando…":"Reenviar mesma tentativa"}</Botao>{!estado.incerto&&!estado.ocupado&&<Botao variante="fantasma" onClick={()=>{intencao.reiniciar();setPreview(null);}}>Conferir outros dados</Botao>}</div>:<>
   <label className="grid gap-1 text-sm" htmlFor={`${id}-telefone`}>Telefone internacional<input id={`${id}-telefone`} name="telefone" type="tel" inputMode="tel" autoComplete="off" maxLength={100} value={telefone} disabled={travado} onChange={e=>alterar(()=>setTelefone(e.target.value))} className={classe}/></label>
   <label className="grid gap-1 text-sm" htmlFor={`${id}-linha`}>Canal da escola<select id={`${id}-linha`} name="numeroId" value={numero} disabled={travado||carregando} onChange={e=>alterar(()=>setNumero(e.target.value))} className={classe}><option value="">Selecione o canal</option>{linhas.map(n=><option key={n.id} value={n.id}>{n.rotulo}</option>)}</select></label>
   {!carregando&&!linhas.length&&<EstadoVazio>Nenhuma linha comercial ativa autorizada. Peça à administração para conferir seu canal.</EstadoVazio>}
   <Botao disabled={carregando||consultando||!telefone.trim()||!numero} onClick={conferir}>{consultando?"Conferindo…":"Conferir número"}</Botao>
   {preview?.tipo==="RECUSAR"?<p role="status" className="text-sm">Não é possível iniciar por este número e canal. Confira os dados ou procure a administração.</p>:preview&&<div className="space-y-3">
    <p role="status" className="text-sm">{preview.tipo==="NOVO"?"Será criado um novo cadastro.":"Será aberto o atendimento autorizado existente."}</p>
    {preview.tipo==="NOVO"&&<>
     <label className="grid gap-1 text-sm">Nome (opcional)<input name="nome" maxLength={200} value={nome} onChange={e=>setNome(e.target.value)} className={classe}/></label>
     {!vendedor&&<label className="grid gap-1 text-sm">Vendedor responsável<select name="ownerId" required value={owner} onChange={e=>setOwner(e.target.value)} className={classe}><option value="">Selecione um vendedor</option>{vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
     {!vendedor&&!vendedores.length&&<EstadoVazio>Nenhum vendedor ativo autorizado. Confira sua equipe com a administração.</EstadoVazio>}
    </>}
    <Botao disabled={preview.tipo==="NOVO"&&!vendedor&&!vendedores.some(v=>v.id===owner)} onClick={iniciar}>Iniciar conversa</Botao>
   </div>}
  </>}
  <FeedbackAcao erro={estado.erro??erro} progresso={carregando?"Carregando canais…":consultando?"Conferindo número…":estado.ocupado?"Confirmando abertura…":null}/>
 </section>;
}