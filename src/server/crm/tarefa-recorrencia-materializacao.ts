import { Prisma, type PrismaClient, type Tarefa, type Usuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared/sessao";
import { registrarEvento } from "@/server/_shared/evento";
import { SnapshotRecorrenciaTarefaSchema, type SnapshotRecorrenciaTarefa } from "./tarefa-recorrencia-intencao";
import { proximaOcorrenciaTarefa } from "./tarefa-recorrencia-regras";
import { candidatoPodeLerTarefaD10 } from "./tarefa-notificados-regras";
export type ResultadoMaterializacaoTarefa = {tipo:"CRIADA"|"REPLAY";tarefaId:string}|{tipo:"IGNORADA"|"IMPEDIDA"};
type Opcoes={db?:PrismaClient;agora?:()=>Date};
type CodigoImpedimento="VINCULO_INDISPONIVEL"|"VINCULO_ALTERADO"|"RESPONSAVEL_INDISPONIVEL"|"VERSAO_ALTERADA";
type EstadoFinal="MATERIALIZADA"|"CANCELADA_REABERTURA"|"IMPEDIDA_CONTEXTO";
async function bloquear(tx:Prisma.TransactionClient,tabela:"Usuario"|"Lead"|"Pessoa"|"Aluno"|"Matricula"|"AtendimentoWhatsApp",ids:string[],usuario=false){
 if(!ids.length)return true;
 const modo=Prisma.raw(usuario?"FOR KEY SHARE NOWAIT":"FOR SHARE NOWAIT");
 const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM ${Prisma.raw('"'+tabela+'"')} WHERE id IN (${Prisma.join(ids)}) ORDER BY id ${modo}`;
 const presentes=new Set(rows.map(r=>r.id));return ids.every(id=>presentes.has(id));
}
function vinculosIguais(t:Tarefa,s:SnapshotRecorrenciaTarefa){
 const campos=["responsavelId","criadorId","leadId","pessoaId","alunoId","matriculaId","atendimentoId"] as const;
 return campos.every(c=>t[c]===s.dados[c])&&t.recorrencia===s.recorrencia&&t.recorrenciaIndice===s.indiceAtual&&t.recorrenciaAncoraDataCivil===s.ancora.dataCivil&&t.recorrenciaAncoraHora===s.ancora.hora&&t.recorrenciaAncoraFuso===s.ancora.fusoOrigem&&t.recorrenciaPoliticaVersao===1;
}
function conferirUsuarios(usuarios:Usuario[],s:SnapshotRecorrenciaTarefa):{codigo:CodigoImpedimento|null;elegiveis:string[]}{
 const porId=new Map(usuarios.map(u=>[u.id,u])),dono=s.dados.responsavelId?porId.get(s.dados.responsavelId):null;
 const alvo={responsavelId:s.dados.responsavelId,setor:s.dados.setor,gerenteDoResponsavelId:dono?.gerenteComercialId??null};
 if(s.dados.responsavelId&&(!dono||!candidatoPodeLerTarefaD10(dono,alvo)))return {codigo:"RESPONSAVEL_INDISPONIVEL",elegiveis:[]};
 if(s.dados.criadorId&&!porId.has(s.dados.criadorId))return {codigo:"VINCULO_INDISPONIVEL",elegiveis:[]};
 return {codigo:null,elegiveis:s.notificarUsuarioIds.filter(id=>{const u=porId.get(id);return !!u&&candidatoPodeLerTarefaD10(u,alvo);})};
}
export async function materializarRecorrenciaTarefa(id:string,opcoes:Opcoes={}):Promise<ResultadoMaterializacaoTarefa>{
 const db=opcoes.db??prisma;
 return db.$transaction(async tx=>{
  const inicial=await tx.intencaoRecorrenciaTarefa.findUnique({where:{id}});
  if(!inicial)return {tipo:"IGNORADA"};
  const tarefaId=inicial.tarefaId;
  const confirmado=await tx.tarefa.findUnique({where:{recorrenciaAnteriorId:tarefaId}});
  if(confirmado)return {tipo:"REPLAY",tarefaId:confirmado.id};
  const originalSnapshot=JSON.stringify(inicial.snapshot);
  const identidadeInicial=JSON.stringify([inicial.id,inicial.tarefaId,inicial.conclusaoVersao,inicial.versao,inicial.corteEm]);
  const parsed=SnapshotRecorrenciaTarefaSchema.safeParse(inicial.snapshot);
  if(!parsed.success){
   if(typeof inicial.snapshot!=="object"||inicial.snapshot===null||Array.isArray(inicial.snapshot)||inicial.snapshot.versao!==1)throw new ErroRegra("Snapshot de recorrência inválido.");
   await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${tarefaId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "IntencaoRecorrenciaTarefa" WHERE id=${id} FOR UPDATE`;
   const tarefa=await tx.tarefa.findUnique({where:{id:tarefaId}}),atual=await tx.intencaoRecorrenciaTarefa.findUnique({where:{id}});
   if(!tarefa||!atual)return {tipo:"IGNORADA"};
   if(JSON.stringify([atual.id,atual.tarefaId,atual.conclusaoVersao,atual.versao,atual.corteEm])!==identidadeInicial||JSON.stringify(atual.snapshot)!==originalSnapshot)throw new ErroRegra("A intenção de recorrência mudou.");
   const filhoConfirmado=await tx.tarefa.findUnique({where:{recorrenciaAnteriorId:tarefaId}});
   if(filhoConfirmado)return {tipo:"REPLAY",tarefaId:filhoConfirmado.id};
   if(atual.estado!=="PENDENTE")return {tipo:"IGNORADA"};
   const r=await tx.intencaoRecorrenciaTarefa.updateMany({where:{id:atual.id,versao:atual.versao,estado:"PENDENTE"},data:{estado:"IMPEDIDA_CONTEXTO",versao:{increment:1}}});
   if(r.count!==1)throw new ErroRegra("A intenção de recorrência foi alterada.");
   await registrarEvento(tx,{tipo:"RecorrenciaTarefaImpedida",agregadoTipo:"Tarefa",agregadoId:tarefa.id,autorId:null,payload:{intencaoId:atual.id,codigo:"SNAPSHOT_INVALIDO"}});
   return {tipo:"IMPEDIDA"};
  }
  const s=parsed.data;
  const usuariosIds=[...new Set([s.dados.responsavelId,s.dados.criadorId,...s.notificarUsuarioIds].filter((v):v is string=>v!==null))].sort();
  await bloquear(tx,"Usuario",usuariosIds,true);
  let referencias=true;
  for(const [tabela,ref] of [["Lead",s.dados.leadId],["Pessoa",s.dados.pessoaId],["Aluno",s.dados.alunoId],["Matricula",s.dados.matriculaId],["AtendimentoWhatsApp",s.dados.atendimentoId]] as const){
   if(ref&&!await bloquear(tx,tabela,[ref]))referencias=false;
  }
  await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${tarefaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "IntencaoRecorrenciaTarefa" WHERE id=${id} FOR UPDATE`;
  const t=await tx.tarefa.findUnique({where:{id:tarefaId}}),i=await tx.intencaoRecorrenciaTarefa.findUnique({where:{id}});
  if(!t||!i)return {tipo:"IGNORADA"};
  if(i.tarefaId!==tarefaId||JSON.stringify(i.snapshot)!==originalSnapshot)throw new ErroRegra("A intenção de recorrência mudou.");
  const filho=await tx.tarefa.findUnique({where:{recorrenciaAnteriorId:tarefaId}});
  if(filho)return {tipo:"REPLAY",tarefaId:filho.id};
  if(i.estado!=="PENDENTE")return {tipo:"IGNORADA"};
  const marcar=async(estado:EstadoFinal)=>{
   const r=await tx.intencaoRecorrenciaTarefa.updateMany({where:{id:i.id,versao:i.versao,estado:"PENDENTE"},data:{estado,versao:{increment:1}}});
   if(r.count!==1)throw new ErroRegra("A intenção de recorrência foi alterada.");
  };
  const impedir=async(codigo:CodigoImpedimento):Promise<ResultadoMaterializacaoTarefa>=>{
   await marcar("IMPEDIDA_CONTEXTO");
   await registrarEvento(tx,{tipo:"RecorrenciaTarefaImpedida",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:null,payload:{intencaoId:i.id,codigo}});
   return {tipo:"IMPEDIDA"};
  };
  if(t.status==="ABERTA"){await marcar("CANCELADA_REABERTURA");return {tipo:"IGNORADA"};}
  if(t.status!=="CONCLUIDA"||t.versao!==i.conclusaoVersao)return impedir("VERSAO_ALTERADA");
  if(!vinculosIguais(t,s))return impedir("VINCULO_ALTERADO");
  if(!referencias)return impedir("VINCULO_INDISPONIVEL");
  const usuarios=await tx.usuario.findMany({where:{id:{in:usuariosIds}}});
  const permissao=conferirUsuarios(usuarios,s);
  if(permissao.codigo)return impedir(permissao.codigo);
  const agoraTentativa=(opcoes.agora??(()=>new Date()))();
  if(!Number.isFinite(agoraTentativa.getTime()))throw new ErroRegra("Relógio da recorrência inválido.");
  const corteEfetivo=new Date(Math.max(i.corteEm.getTime(),agoraTentativa.getTime()));
  const proxima=proximaOcorrenciaTarefa({recorrencia:s.recorrencia,ancora:s.ancora,indiceAtual:s.indiceAtual,corteEm:corteEfetivo});
  if(!proxima)throw new ErroRegra("Configuração de recorrência inválida.");
  const novo=await tx.tarefa.create({data:{...s.dados,origem:"AUTOMACAO",status:"ABERTA",dataCivil:proxima.dataCivil,inicioEm:proxima.inicioEm,fusoOrigem:s.ancora.fusoOrigem,lembrarEm:proxima.inicioEm&&s.dados.lembreteAntecedenciaMin!==null?new Date(proxima.inicioEm.getTime()-s.dados.lembreteAntecedenciaMin*60_000):null,lembreteDisparadoEm:null,recorrencia:s.recorrencia,recorrenciaAncoraDataCivil:s.ancora.dataCivil,recorrenciaAncoraHora:s.ancora.hora,recorrenciaAncoraFuso:s.ancora.fusoOrigem,recorrenciaPoliticaVersao:1,recorrenciaIndice:proxima.indice,recorrenciaAnteriorId:t.id}});
  if(permissao.elegiveis.length)await tx.tarefaNotificado.createMany({data:permissao.elegiveis.map(usuarioId=>({tarefaId:novo.id,usuarioId}))});
  await registrarEvento(tx,{tipo:"RecorrenciaTarefaMaterializada",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:null,payload:{intencaoId:i.id,filhoId:novo.id,indice:proxima.indice,corteOriginal:i.corteEm.toISOString(),agoraTentativa:agoraTentativa.toISOString(),corteEfetivo:corteEfetivo.toISOString(),ajuste:proxima.ajuste,solicitado:proxima.solicitado,resolvido:proxima.resolvido,fuso:s.ancora.fusoOrigem,politicaVersao:1}});
  await marcar("MATERIALIZADA");
  const finais=conferirUsuarios(await tx.usuario.findMany({where:{id:{in:usuariosIds}}}),s);
  if(finais.codigo||JSON.stringify(finais.elegiveis)!==JSON.stringify(permissao.elegiveis))throw new ErroRegra("A autorização da recorrência mudou durante a gravação.");
  return {tipo:"CRIADA",tarefaId:novo.id};
 });
}
export async function rodarRecorrenciasTarefas(opcoes:Opcoes={}):Promise<{criadas:number}>{
 const db=opcoes.db??prisma;
 const pendentes=await db.intencaoRecorrenciaTarefa.findMany({where:{estado:"PENDENTE"},orderBy:[{criadaEm:"asc"},{id:"asc"}],take:50,select:{id:true}});
 let criadas=0;
 const erros:unknown[]=[];
 for(const i of pendentes)try{if((await materializarRecorrenciaTarefa(i.id,{...opcoes,db})).tipo==="CRIADA")criadas++;}catch(erro){erros.push(erro);}
 if(erros.length===1)throw erros[0];
 if(erros.length>1)throw new AggregateError(erros,"Falhas independentes ao materializar recorrências de tarefas.");
 return {criadas};
}