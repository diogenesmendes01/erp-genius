import type {Prisma} from "@prisma/client";
import {ErroRegra,registrarEvento,temPapel,type UsuarioSessao} from "@/server/_shared";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
import {atendimentoVisivel} from "./atendimentos";
import {CHAVE_LINHA} from "./linha-comercial";

/** Caminho de AcoesContato: conserva o roteamento legado sem impor identidade de Pessoa/selected do cartão329. */
export async function vincularLeadLegadoTx(tx:Prisma.TransactionClient,sessao:UsuarioSessao,entrada:{contatoId:string;atendimentoId?:string;leadId:string}){
 const {contatoId,atendimentoId,leadId}=entrada;
 if(!atendimentoId)throw new ErroRegra("Atendimento fora do seu escopo para vinculação.");
 const autor={...sessao};
 async function resolver(idsEsperados?:string[],conversaEsperada?:string){
  const fresco=await tx.usuario.findUnique({where:{id:autor.id},select:{nome:true,papeis:true,permissoes:true,ativo:true}});
  if(!fresco?.ativo)throw new ErroRegra("Sua sessão não está mais ativa.");Object.assign(autor,{nome:fresco.nome,papeis:fresco.papeis,permissoes:fresco.permissoes});
  const a=await atendimentoVisivel(autor,atendimentoId!,true,tx);
  if(!a||a.contatoId!==contatoId||a.finalidade==="PEDAGOGICO")throw new ErroRegra("Atendimento fora do seu escopo para vinculação.");
  if(a.finalidade!=="COMERCIAL"||!temPapel(autor,"VENDEDOR","GERENTE_COMERCIAL"))throw new ErroRegra("Vínculo de lead exige atendimento comercial.");
  if(conversaEsperada&&a.conversaId!==conversaEsperada)throw new ErroRegra("O atendimento mudou. Recarregue a conversa.");
  const contato=await tx.contatoWhatsApp.findUnique({where:{id:contatoId}});if(!contato)throw new ErroRegra("Contato não encontrado.");
  const lead=await tx.oportunidade.findFirst({where:{AND:[{id:leadId,telefoneE164:contato.telefoneE164},await escopoComercialAtual(autor,tx)]},select:{id:true}});
  if(!lead)throw new ErroRegra("Lead não encontrado ou fora do seu escopo.");
  if(contato.leadId&&contato.leadId!==leadId)throw new ErroRegra("Contato já vinculado a outro lead. Preserve o contexto histórico.");
  const atendimentos=await tx.atendimentoWhatsApp.findMany({where:{conversaId:a.conversaId,finalidade:"COMERCIAL"},orderBy:[{ultimaMensagemEm:{sort:"desc",nulls:"last"}},{criadoEm:"desc"}]});
  const ids=[...new Set([...atendimentos.map(t=>t.id),atendimentoId!])].sort();
  if(idsEsperados&&JSON.stringify(ids)!==JSON.stringify(idsEsperados))throw new ErroRegra("Os atendimentos mudaram. Recarregue a conversa antes de vincular.");
  const abertos=atendimentos.filter(t=>!t.encerradoEm);
  const candidato=abertos.find(t=>t.leadId===leadId)??abertos.find(t=>t.contextoChave.startsWith(CHAVE_LINHA))??abertos[0];
  if(a.numero.finalidade==="VENDAS"&&!a.conversa.grupoId){
   if(candidato&&(!candidato.leadId||candidato.leadId===leadId))return{a,contato,ids,destino:{id:candidato.id,contextoChave:candidato.contextoChave,marcar:!candidato.leadId,responsavelId:undefined as string|null|undefined}};
   if(!candidato){
    const anteriores=await tx.atendimentoWhatsApp.count({where:{conversaId:a.conversaId,contextoChave:{startsWith:CHAVE_LINHA}}});
    return{a,contato,ids,destino:{id:null,contextoChave:anteriores?`${CHAVE_LINHA}:${anteriores+1}`:CHAVE_LINHA,marcar:false,responsavelId:a.numero.donoId}};
   }
  }
  const contextoChave=["COMERCIAL",leadId,"",""].join(":"),existente=atendimentos.find(t=>t.contextoChave===contextoChave);
  return{a,contato,ids,destino:{id:existente?.id??null,contextoChave,marcar:false,responsavelId:undefined as string|null|undefined}};
 }
 // Todos os atendimentos que podem ser escolhidos são travados antes do contato e em ordem comum.
 // Uma inserção concorrente fora desse conjunto exige rollback, nunca lock tardio de outra identidade.
 const inicial=await resolver();
 for(const id of inicial.ids)await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR UPDATE`;
 await resolver(inicial.ids,inicial.a.conversaId);
 await tx.$queryRaw`SELECT id FROM "ContatoWhatsApp" WHERE id=${contatoId} FOR UPDATE`;
 await resolver(inicial.ids,inicial.a.conversaId);
 await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${leadId} FOR UPDATE`;
 const antes=await resolver(inicial.ids,inicial.a.conversaId),destino=antes.destino;
 const contato=await tx.contatoWhatsApp.updateMany({where:{id:contatoId,leadId:antes.contato.leadId,telefoneE164:antes.contato.telefoneE164,pessoaId:antes.contato.pessoaId},data:{leadId}});
 if(contato.count!==1)throw new ErroRegra("O contato mudou. Recarregue a conversa.");
 let destinoId=destino.id;
 if(destinoId&&destino.marcar){const r=await tx.atendimentoWhatsApp.updateMany({where:{id:destinoId,leadId:null,encerradoEm:null},data:{leadId}});if(r.count!==1)throw new ErroRegra("O atendimento mudou. Recarregue a conversa.");}
 if(!destinoId){
  // Registro novo desta TX; create não reutiliza silenciosamente contexto que apareceu depois dos locks.
  const novo=await tx.atendimentoWhatsApp.create({data:{conversaId:antes.a.conversaId,contextoChave:destino.contextoChave,finalidade:"COMERCIAL",leadId,...(destino.responsavelId?{responsavelId:destino.responsavelId,status:"EM_ATENDIMENTO" as const}:{})}});destinoId=novo.id;
 }
 const idsFinais=[...new Set([...inicial.ids,destinoId])].sort();const depois=await resolver(idsFinais,inicial.a.conversaId);
 if(depois.contato.leadId!==leadId||depois.destino.id!==destinoId)throw new ErroRegra("Não foi possível confirmar o vínculo da oportunidade.");
 const selecionado=await tx.atendimentoWhatsApp.findUniqueOrThrow({where:{id:atendimentoId}});
 if(selecionado.leadId!==(destinoId===atendimentoId&&destino.marcar?leadId:antes.a.leadId))throw new ErroRegra("O contexto selecionado mudou. Recarregue a conversa.");
 await registrarEvento(tx,{tipo:"ContatoVinculado",agregadoTipo:"ContatoWhatsApp",agregadoId:contatoId,autorId:autor.id,payload:{alvo:{tipo:"lead",id:leadId},antes:{alunoId:antes.contato.alunoId,responsavelId:antes.contato.responsavelId,leadId:antes.contato.leadId}}});
}