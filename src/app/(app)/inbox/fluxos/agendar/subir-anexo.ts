import type {Resultado} from "@/server/_shared/resultado";
export const MAX_BYTES_ANEXO=10*1024*1024;
export const ACEITA_ANEXO="image/jpeg,image/png,image/webp,audio/ogg,audio/mpeg,audio/mp4,video/mp4,application/pdf";
export async function subirAnexoAgendamento(atendimentoId:string,arquivo:File):Promise<Resultado<{url:string;nome:string}>>{
 if(arquivo.size===0||arquivo.size>MAX_BYTES_ANEXO)return {ok:false,erro:"Arquivo vazio ou acima de 10MB."};
 const form=new FormData();form.append("file",arquivo);form.append("atendimentoId",atendimentoId);
 try{
  const r=await fetch("/api/whatsapp/upload",{method:"POST",body:form,credentials:"same-origin"});
  const j=(await r.json().catch(()=>({}))) as {url?:string;nome?:string;erro?:string};
  if(!r.ok||!j.url)return {ok:false,erro:j.erro??"Falha no upload."};
  return {ok:true,dado:{url:j.url,nome:j.nome?.trim()||arquivo.name}};
 }catch{return {ok:false,erro:"Falha no upload. Confira a conexão e tente de novo."};}
}
