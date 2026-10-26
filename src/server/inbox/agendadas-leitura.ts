import type {TipoMensagem} from "@prisma/client";
import type {Db} from "@/server/whatsapp/escopo";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {lerContextoAtualInbox} from "@/server/whatsapp/enfileirar-inbox";
import {apenasPortal} from "@/server/_shared/sessao";
import {derivarEstadoAria,linhaEstadoDe} from "./estado-aria";
import {podeAlterarAgendadaNoInbox} from "./agendadas-policy";
export interface AgendadaNoFio{id:string;texto:string;agendadaPara:string;status:"PENDENTE"|"ADIADA";tipo:TipoMensagem;temAnexo:boolean;autor:"voce"|"aria"|"equipe";autorNome:string|null;podeAlterar:boolean}
type Atendimento=NonNullable<Awaited<ReturnType<typeof atendimentoVisivel>>>;
/** Identidade bruta. O responsável do atendimento é capacidade, não troca de alvo da leitura. */
function binding(a:Atendimento){const c=a.conversa.contato;return JSON.stringify([
 a.id,a.finalidade,a.numeroId,a.conversaId,a.contatoId,a.leadId??null,a.alunoId??null,a.matriculaId??null,a.turmaId??null,a.autorizacaoComunicacaoAcademicaId??null,
 a.conversa.id,a.conversa.grupoId,c?.id??null,c?.pessoaId??null,c?.leadId??null,c?.alunoId??null,c?.responsavelId??null,c?.telefoneE164??null,
]);}
async function atorAtual(db:Db,id:string){const u=await db.usuario.findUnique({where:{id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});return u?.ativo&&!apenasPortal(u)?u:null;}
function perfil(u:NonNullable<Awaited<ReturnType<typeof atorAtual>>>){return JSON.stringify([u.id,[...u.papeis].sort(),[...u.permissoes].sort()]);}
/** ReadCommitted do Db recebido; não abre TX, não materializa configuração e não usa client global. */
export async function lerAgendadasDoAtendimento(db:Db,autorId:string,atendimentoId:string):Promise<AgendadaNoFio[]>{
 if(!autorId||!atendimentoId)return [];
 const inicial=await atorAtual(db,autorId);if(!inicial)return [];
 const a=await atendimentoVisivel(inicial,atendimentoId,false,db);if(!a||a.encerradoEm)return [];
 const alvo=binding(a);
 const linhas=await db.intencaoMensagem.findMany({where:{atendimentoId,agendadaPara:{not:null},passo:null,passoComercial:null,status:{in:["PENDENTE","ADIADA"]},origem:{in:["HUMANO","IA"]}},
  orderBy:[{agendadaPara:"asc"},{id:"asc"}],take:50,
  select:{id:true,atendimentoId:true,corpoRenderizado:true,agendadaPara:true,status:true,tipo:true,midiaPath:true,conteudo:true,origem:true,autorId:true,passo:true,passoComercial:true,autor:{select:{nome:true,gerenteComercialId:true}}}});
 const u=await atorAtual(db,autorId);if(!u)return [];
 const atual=await atendimentoVisivel(u,atendimentoId,false,db);if(!atual||atual.encerradoEm||binding(atual)!==alvo)return [];
 const envio=await atendimentoVisivel(u,atendimentoId,true,db);
 const {ctx,sugestao}=await lerContextoAtualInbox(db,atendimentoId);
 // Todas as leituras acima podem esperar. Revalidar ator e ACL/binding antes de publicar.
 const publicador=await atorAtual(db,autorId);if(!publicador)return [];
 const final=await atendimentoVisivel(publicador,atendimentoId,false,db);if(!final||final.encerradoEm||binding(final)!==alvo)return [];
 // Último snapshot único: ator e relações de equipe dos autores, após os demais awaits.
 const usuarios=await db.usuario.findMany({where:{id:{in:[...new Set([autorId,...linhas.flatMap(m=>m.autorId?[m.autorId]:[])])]}},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true,gerenteComercialId:true}});
 const porId=new Map(usuarios.map(u=>[u.id,u]));
 const ultimo=porId.get(autorId);if(!ultimo?.ativo||apenasPortal(ultimo)||perfil(ultimo)!==perfil(publicador))return [];
 const estadoAria=derivarEstadoAria(linhaEstadoDe(final),ctx,sugestao);
 const autorizadoEnviar=!!envio&&binding(envio)===alvo&&envio.responsavelId===final.responsavelId;
 // Nenhum await após a última conferência. Não promete linearizabilidade após ela.
 return linhas.flatMap(m=>{
  if(!m.agendadaPara||(m.status!=="PENDENTE"&&m.status!=="ADIADA"))return [];
  const dto:AgendadaNoFio={id:m.id,texto:m.corpoRenderizado,agendadaPara:m.agendadaPara.toISOString(),status:m.status,tipo:m.tipo,
   temAnexo:m.midiaPath!==null||m.conteudo!==null,autor:m.origem==="IA"?"aria":m.autorId===ultimo.id?"voce":"equipe",autorNome:m.autor?.nome??null,
   podeAlterar:podeAlterarAgendadaNoInbox(ultimo,{...m,autorGerenteComercialId:(m.autorId?porId.get(m.autorId)?.gerenteComercialId:null)??null},{id:final.id,responsavelId:final.responsavelId,encerradoEm:final.encerradoEm,autorizadoEnviar,estadoAria,numeroAtivo:final.conversa.numero.ativo,optOut:final.conversa.contato?.optOutEm!=null})};
  return [dto];
 });
}
