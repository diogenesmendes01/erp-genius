import {assinarEventosCompartilhados} from "./eventos-inbox";
import {restanteFotoPresenca} from "./presenca-inbox-foto";
import type {FotoPresenca} from "@/server/inbox/presenca-leitura";
type Binding={id:string;geracao:string};
type Ciclo={usuarioId:string;abaId:string;binding:Binding|null;aberturaId:string;seq:bigint;assinantes:Set<symbol>;vivo:boolean;revogada:boolean;conectado:boolean;pendente:boolean;fechado:boolean;possuiAbertura:boolean;intervalo:ReturnType<typeof setInterval>|null;sairEventos:(()=>void)|null;ultimaAtividade:number;atividadePendente:boolean};
type Observador={id:string;token:string;receber:(f:FotoPresenca|null)=>void;lendo:boolean;vivo:boolean;timer:ReturnType<typeof setTimeout>|null};
let ciclo:Ciclo|null=null,observador:Observador|null=null;
const objeto=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
function bindingValido(v:unknown):Binding|null{const b=objeto(v);return b&&typeof b.id==="string"&&b.id.length>0&&b.id.length<=128&&typeof b.geracao==="string"&&/^[1-9][0-9]{0,18}$/.test(b.geracao)&&BigInt(b.geracao)<=9223372036854775807n?{id:b.id,geracao:b.geracao}:null;}
class Falha extends Error{constructor(public status:number,public escopo?:"modal"){super("Presença indisponível.");}}
async function enviar(payload:unknown){const inicio=performance.now();const r=await fetch("/api/inbox/presenca",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Inbox-Presenca":"1"},body:JSON.stringify(payload)});if(!r.ok){let erro:Record<string,unknown>|null=null;try{erro=objeto(await r.json());}catch{}throw new Falha(r.status,erro?.escopo==="modal"?"modal":undefined);}return{dados:objeto(await r.json()),inicio};}
function armazenar(u:string,abaId:string,b:Binding){try{sessionStorage.setItem(`erp.inbox.presenca.${JSON.stringify([u,abaId])}`,JSON.stringify(b));}catch{ }}
function recuperar(u:string,abaId:string):Binding|null{try{return bindingValido(JSON.parse(sessionStorage.getItem(`erp.inbox.presenca.${JSON.stringify([u,abaId])}`)??"null"));}catch{return null;}}
function aba(){try{const antiga=sessionStorage.getItem("erp.inbox.presenca.aba");if(antiga&&/^[0-9a-f-]{36}$/i.test(antiga))return antiga;const nova=crypto.randomUUID();sessionStorage.setItem("erp.inbox.presenca.aba",nova);return nova;}catch{return crypto.randomUUID();}}
function cancelarFoto(o:Observador){if(o.timer!==null)clearTimeout(o.timer);o.timer=null;}
function invalidarObservador(o:Observador|null){if(!o||observador!==o)return;cancelarFoto(o);o.receber(null);o.vivo=false;o.lendo=false;observador=null;}
function encerrarCiclo(c:Ciclo){c.revogada=true;c.vivo=false;c.conectado=false;c.atividadePendente=false;c.pendente=false;c.binding=null;c.possuiAbertura=false;c.seq=0n;c.assinantes.clear();pararPulso(c);c.sairEventos?.();c.sairEventos=null;if(ciclo===c){ciclo=null;invalidarObservador(observador);}}
function tratarFalha(e:unknown,c:Ciclo|null,o:Observador|null){
 if(!(e instanceof Falha)||![401,403,404].includes(e.status))return;
 if(c&&ciclo!==c)return;if(!c&&o&&observador!==o)return;
 if(e.status===404&&e.escopo==="modal"){invalidarObservador(o);return;}
 const atual=ciclo;if(atual)encerrarCiclo(atual);
 invalidarObservador(observador);
}
function fotoValida(v:unknown,token:string):FotoPresenca|null{const f=objeto(v);if(!f||f.tokenModal!==token||!Array.isArray(f.pessoas)||f.pessoas.length>200||typeof f.validadeMs!=="number")return null;const vistos=new Set<string>();for(const p of f.pessoas){const item=objeto(p);if(!item||typeof item.usuarioId!=="string"||vistos.has(item.usuarioId)||!["online","ausente","offline"].includes(String(item.status)))return null;vistos.add(item.usuarioId);}return f as unknown as FotoPresenca;}
function publicar(o:Observador,v:unknown,inicio:number){if(!o.vivo||observador!==o)return;cancelarFoto(o);const foto=fotoValida(v,o.token);const restante=foto?restanteFotoPresenca(foto.validadeMs,inicio,performance.now()):null;if(!foto||restante===null){o.receber(null);return;}o.receber(foto);const expirar=()=>{o.timer=null;if(!o.vivo||observador!==o)return;o.receber(null);void lerFoto(o);};o.timer=setTimeout(expirar,restante);}
async function lerFoto(o:Observador){if(!o.vivo||o.lendo||observador!==o)return;o.lendo=true;try{const r=await enviar({modo:"ler",consulta:{atendimentoId:o.id,tokenModal:o.token}});publicar(o,r.dados?.foto,r.inicio);}catch(e){tratarFalha(e,null,o);if(o.vivo&&observador===o){cancelarFoto(o);o.receber(null);}}finally{o.lendo=false;}}
export function observarPresencas(atendimentoId:string,tokenModal:string,receber:(foto:FotoPresenca|null)=>void):()=>void{if(observador){observador.vivo=false;cancelarFoto(observador);}const o:Observador={id:atendimentoId,token:tokenModal,receber,lendo:false,vivo:true,timer:null};observador=o;receber(null);void lerFoto(o);return()=>{o.vivo=false;cancelarFoto(o);if(observador===o)observador=null;};}
async function abrirNoServidor(c:Ciclo,causa:"entrada"|"reconexao"){
 c.possuiAbertura=false;
 const tentar=async(esperada:Binding|null)=>enviar({modo:"abrir",abaId:c.abaId,aberturaId:c.aberturaId,inscricaoEsperada:esperada?.id??null,geracaoEsperada:esperada?.geracao??null,causa});
  let r;try{r=await tentar(c.binding);}catch(e){
  if(causa!=="entrada"||!(e instanceof Falha)||e.status!==409)throw e;
  const resolvida=await enviar({modo:"resolver",abaId:c.abaId});if(!c.vivo||c.revogada)return;
  if(!resolvida.dados||!Object.hasOwn(resolvida.dados,"checkpoint"))throw new Error("Checkpoint inválido.");
  const checkpoint=resolvida.dados.checkpoint===null?null:bindingValido(resolvida.dados.checkpoint);
  if(resolvida.dados.checkpoint!==null&&!checkpoint)throw new Error("Checkpoint inválido.");
  r=await tentar(checkpoint);
 }
 if(c.revogada)return;const b=bindingValido(r.dados?.inscricao);if(!b)throw new Error("Inscrição inválida.");c.binding=b;c.possuiAbertura=true;c.seq=0n;armazenar(c.usuarioId,c.abaId,b);
}
const aberturasPendentes=new Map<string,Promise<Binding|null>>();
function abrir(c:Ciclo,causa:"entrada"|"reconexao"):Promise<void>{
 const chave=JSON.stringify([c.usuarioId,c.abaId]);const anterior=aberturasPendentes.get(chave);
 const tarefa=Promise.resolve().then(async()=>{
    if(anterior){let checkpoint:Binding|null;try{checkpoint=await anterior;}catch(e){encerrarCiclo(c);throw e;}if(c.revogada)throw new Error("Abertura cancelada.");if(!c.vivo)return checkpoint;c.binding=checkpoint;}
  if(c.revogada)throw new Error("Abertura cancelada.");if(!c.vivo)return c.binding;
  await abrirNoServidor(c,causa);if(c.revogada)throw new Error("Abertura cancelada.");return c.binding;
 });
 aberturasPendentes.set(chave,tarefa);
 return tarefa.finally(()=>{if(aberturasPendentes.get(chave)===tarefa)aberturasPendentes.delete(chave);}).then(()=>{});
}
async function fechar(c:Ciclo){if(c.revogada||c.fechado||!c.possuiAbertura||!c.binding||c.pendente)return;c.fechado=true;try{await enviar({modo:"fechar",...c.binding,seq:String(++c.seq)});}catch{ }}
async function pulsar(c:Ciclo){if(!c.vivo||!c.conectado||c.pendente||!c.possuiAbertura||!c.binding)return;c.pendente=true;let o:Observador|null=null;try{
 if(!c.vivo)return;
 o=observador?.vivo&&!observador.lendo?observador:null;if(o)o.lendo=true;
 const payload={modo:"pulso",...c.binding,seq:String(++c.seq),...(o?{consulta:{atendimentoId:o.id,tokenModal:o.token}}:{})};
 let r;try{r=await enviar(payload);}catch(e){if(!(e instanceof Falha)||e.status!==409)throw e;c.aberturaId=crypto.randomUUID();await abrir(c,"reconexao");if(!c.vivo)return;r=await enviar({...payload,...c.binding,seq:String(++c.seq)});}
 if(o){const erro=objeto(r.dados?.erroFoto);if(erro?.status===404&&erro.escopo==="modal")invalidarObservador(o);else publicar(o,r.dados?.foto,r.inicio);}
 }catch(e){tratarFalha(e,c,o);if(o&&o.vivo&&observador===o){cancelarFoto(o);o.receber(null);}if(e instanceof Falha&&(e.status===401||e.status===403)){c.conectado=false;pararPulso(c);}}finally{if(o)o.lendo=false;c.pendente=false;if(!c.vivo)void fechar(c);else if(c.atividadePendente){c.atividadePendente=false;interagirPresencaInbox();}}}
function pararPulso(c:Ciclo){if(c.intervalo!==null)clearInterval(c.intervalo);c.intervalo=null;}
function iniciarPulso(c:Ciclo){if(c.intervalo!==null)return;const pulso=()=>void pulsar(c);c.intervalo=setInterval(pulso,25_000);void pulsar(c);}
export function montarPresencaInbox(usuarioId:string):()=>void{
 if(ciclo&&ciclo.usuarioId!==usuarioId){ciclo.vivo=false;pararPulso(ciclo);ciclo.sairEventos?.();void fechar(ciclo);ciclo=null;}
 if(!ciclo){const abaId=aba();const c:Ciclo={usuarioId,abaId,binding:recuperar(usuarioId,abaId),aberturaId:crypto.randomUUID(),seq:0n,assinantes:new Set(),vivo:true,revogada:false,conectado:false,pendente:false,fechado:false,possuiAbertura:false,intervalo:null,sairEventos:null,ultimaAtividade:-Infinity,atividadePendente:false};ciclo=c;
 c.pendente=true;void abrir(c,"entrada").catch(e=>{tratarFalha(e,c,null);if(c.vivo)encerrarCiclo(c);}).finally(()=>{c.pendente=false;if(!c.vivo)void fechar(c);else if(c.conectado)void pulsar(c);});
 c.sairEventos=assinarEventosCompartilhados(()=>{},conectado=>{if(!c.vivo)return;c.conectado=conectado;if(conectado)iniciarPulso(c);else pararPulso(c);});}
 const c=ciclo,token=Symbol("Inbox");c.assinantes.add(token);
 return()=>{c.assinantes.delete(token);queueMicrotask(()=>{if(c.assinantes.size||!c.vivo)return;c.vivo=false;pararPulso(c);c.sairEventos?.();if(ciclo===c)ciclo=null;void fechar(c);});};
}
export function interagirPresencaInbox():void{const c=ciclo;if(!c?.vivo||!c.conectado||!c.possuiAbertura||!c.binding)return;if(c.pendente){c.atividadePendente=true;return;}const agora=performance.now();if(agora-c.ultimaAtividade<1000)return;c.ultimaAtividade=agora;c.pendente=true;void enviar({modo:"interacao",...c.binding,seq:String(++c.seq)}).catch(e=>tratarFalha(e,c,null)).finally(()=>{c.pendente=false;if(!c.vivo)void fechar(c);else if(c.atividadePendente){c.atividadePendente=false;interagirPresencaInbox();}});}
