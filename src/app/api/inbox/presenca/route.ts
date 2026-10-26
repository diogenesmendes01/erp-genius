import {prisma} from "@/lib/prisma";
import {exigirSessaoComPrazo,ErroAutenticacao,ErroPermissao} from "@/server/_shared/sessao";
import {EntradaPresencaSchema,origemPresencaValida,type EntradaPresenca} from "@/server/inbox/presenca-schema";
import {escreverPresenca,ErroPresenca} from "@/server/inbox/presenca-escrita";
import {lerPresencasTransferiveis,ErroFotoPresenca,type FotoPresenca} from "@/server/inbox/presenca-leitura";
import {resolverCheckpointPresenca} from "@/server/inbox/presenca-checkpoint";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const resposta=(status:number,escopo?:"modal"|"sessao"|"inscricao")=>Response.json({erro:"Presença indisponível.",...(escopo?{escopo}:{})},{status,headers});
// Defesa de volume por processo, não estado de presença/ACL. Limite8 é serializado no banco.
const janelas=new Map<string,{inicio:number;n:number}>();
function volume(id:string){const agora=Date.now();if(janelas.size>=1000){for(const[k,v]of janelas)if(agora-v.inicio>=60000)janelas.delete(k);if(janelas.size>=1000&&!janelas.has(id))return false;}const j=janelas.get(id);if(!j||agora-j.inicio>=60000){janelas.set(id,{inicio:agora,n:1});return true;}return ++j.n<=240;}
const GRANDE=Symbol("corpo grande");
async function corpo(req:Request){
 const reader=req.body?.getReader();if(!reader)throw new Error("body");const decoder=new TextDecoder();let tamanho=0,txt="";
 try{for(;;){const {value,done}=await reader.read();if(done)break;tamanho+=value.byteLength;if(tamanho>4096){await reader.cancel();return GRANDE;}txt+=decoder.decode(value,{stream:true});}txt+=decoder.decode();return JSON.parse(txt) as unknown;}finally{reader.releaseLock();}
}
export async function POST(req:Request){
 const origem=process.env.NEXTAUTH_URL;
 try{const url=origem?new URL(origem):null;if(!url||!["https:","http:"].includes(url.protocol)||url.username||url.password)return resposta(503);}catch{return resposta(503);}
 if(!origemPresencaValida(req,origem))return resposta(403);
 let entrada:EntradaPresenca;
 try{const raw=await corpo(req);if(raw===GRANDE)return resposta(413);entrada=EntradaPresencaSchema.parse(raw);}catch{return resposta(400);}
 try{
  const {usuario,expiraEm}=await exigirSessaoComPrazo();
  if(expiraEm!==null&&expiraEm<=Date.now())return resposta(401,"sessao");
  if(!volume(usuario.id))return resposta(429);
  if(entrada.modo==="resolver"){
   const checkpoint=await prisma.$transaction(tx=>resolverCheckpointPresenca(tx,usuario.id,entrada.abaId));
   return Response.json({checkpoint},{headers});
  }
  if(entrada.modo==="ler"){
   const foto=await prisma.$transaction(tx=>lerPresencasTransferiveis(tx,usuario.id,entrada.consulta));
   return Response.json({foto},{headers});
  }
  const inscricao=await prisma.$transaction(tx=>escreverPresenca(tx,usuario.id,entrada,expiraEm));
  if(entrada.modo==="pulso"&&entrada.consulta){
   let foto:FotoPresenca|null=null;let erroFoto:{status:404;escopo:"modal"}|undefined;try{const consulta=entrada.consulta;foto=await prisma.$transaction(tx=>lerPresencasTransferiveis(tx,usuario.id,consulta));}catch(e){if(e instanceof ErroAutenticacao||e instanceof ErroPermissao)throw e;if(e instanceof ErroFotoPresenca)erroFoto={status:404,escopo:"modal"};/* Falha técnica da foto não desfaz batimento próprio. */}
   return Response.json({inscricao,foto,...(erroFoto?{erroFoto}:{})},{headers});
  }
  return Response.json({inscricao},{headers});
 }catch(e){if(e instanceof ErroAutenticacao)return resposta(401,"sessao");if(e instanceof ErroPermissao)return resposta(403,"sessao");if(e instanceof ErroFotoPresenca)return resposta(404,"modal");if(e instanceof ErroPresenca)return resposta(e.status,"inscricao");return resposta(503);}
}
