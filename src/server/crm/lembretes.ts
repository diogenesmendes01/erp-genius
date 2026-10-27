import {erroContencaoNotificadosTarefaD10} from "./tarefa-notificados";
import {Prisma,type FinalidadeAtendimentoWhatsApp} from "@prisma/client";
import {candidatoPodeLerTarefaD10} from "./tarefa-notificados-regras";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { escopoTarefas } from "./tarefas";

type TarefaReclamada = { id: string; responsavelId: string|null; titulo: string; setor:FinalidadeAtendimentoWhatsApp; status:string; versao:number; lembrarEm:Date|null; lembreteDisparadoEm:Date|null };

async function dispararLembreteTarefa(tarefaId:string,agora:Date):Promise<{notificadas:number}>{
  return prisma.$transaction(async (tx) => {
    const reclamadas = await tx.$queryRaw<TarefaReclamada[]>`
      UPDATE "Tarefa" t SET "lembreteDisparadoEm" = now()
      WHERE t.id = ${tarefaId} AND t.status = 'ABERTA'
        AND (t."responsavelId" IS NOT NULL OR EXISTS (SELECT 1 FROM "TarefaNotificado" n WHERE n."tarefaId"=t.id))
        AND t."lembrarEm" <= ${agora} AND t."lembreteDisparadoEm" IS NULL
      RETURNING t.id, t."responsavelId", t.titulo, t.setor, t.status, t.versao, t."lembrarEm", t."lembreteDisparadoEm"`;
    if(!reclamadas.length)return {notificadas:0};
    const relacoes=await tx.tarefaNotificado.findMany({where:{tarefaId:{in:reclamadas.map(t=>t.id)}},select:{tarefaId:true,usuarioId:true}});
    const ids=[...new Set([...reclamadas.flatMap(t=>t.responsavelId?[t.responsavelId]:[]),...relacoes.map(n=>n.usuarioId)])].sort();
    if(ids.length)await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR KEY SHARE NOWAIT`;
    await tx.usuario.findMany({where:{id:{in:ids}}});
    const usuarios=await tx.usuario.findMany({where:{id:{in:ids}}});
    const conjunto=(t:TarefaReclamada,us:typeof usuarios,rs:typeof relacoes)=>{
      const porId=new Map(us.map(u=>[u.id,u])),dono=t.responsavelId?porId.get(t.responsavelId):null;
      const alvo={responsavelId:t.responsavelId,setor:t.setor,gerenteDoResponsavelId:dono?.gerenteComercialId??null};
      const candidatos=[...new Set([...(t.responsavelId?[t.responsavelId]:[]),...rs.filter(n=>n.tarefaId===t.id).map(n=>n.usuarioId)])].sort();
      return candidatos.filter(id=>{const u=porId.get(id);return !!u&&candidatoPodeLerTarefaD10(u,alvo);});
    };
    const entregas=reclamadas.map(t=>({t,elegiveis:conjunto(t,usuarios,relacoes)}));
    for(const {t,elegiveis} of entregas)for(const usuarioId of elegiveis)await tx.notificacaoUsuario.create({data:{usuarioId,tipo:"LEMBRETE_TAREFA",refTipo:"Tarefa",refId:t.id,titulo:t.titulo}});
    const conferirEntrega=async()=>{
    const tarefasFinais=await tx.tarefa.findMany({where:{id:{in:reclamadas.map(t=>t.id)}},select:{id:true,responsavelId:true,titulo:true,setor:true,status:true,versao:true,lembrarEm:true,lembreteDisparadoEm:true}});
    const relacoesFinais=await tx.tarefaNotificado.findMany({where:{tarefaId:{in:reclamadas.map(t=>t.id)}},select:{tarefaId:true,usuarioId:true}});
    const idsFinais=[...new Set([...ids,...relacoesFinais.map(n=>n.usuarioId)])].sort();
    const usuariosFinais=await tx.usuario.findMany({where:{id:{in:idsFinais}}});
    const lease=(t:TarefaReclamada)=>JSON.stringify([t.id,t.status,t.versao,t.responsavelId,t.setor,t.titulo,t.lembrarEm,t.lembreteDisparadoEm]);
    for(const {t,elegiveis} of entregas){
      const final=tarefasFinais.find(a=>a.id===t.id);
      if(!final||final.status!=="ABERTA"||lease(final)!==lease(t)||JSON.stringify(conjunto(final,usuariosFinais,relacoesFinais))!==JSON.stringify(elegiveis))throw new ErroRegra("O lembrete mudou durante a entrega. Aguarde o próximo ciclo.");
    }
    };
    await conferirEntrega();
    let notificadas=0;
    for(const {t,elegiveis} of entregas){
      await registrarEvento(tx,{tipo:"LembreteDisparado",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:null,payload:elegiveis.length===1?{usuarioId:elegiveis[0]}:elegiveis.length?{usuarioIds:elegiveis}:{motivo:"SEM_DESTINATARIO_AUTORIZADO"}});
      if(elegiveis.length)notificadas++;
    }
    await conferirEntrega();
    return {notificadas};
  }).catch(erroContencaoNotificadosTarefaD10);
}

export async function rodarLembretesTarefas(agora:Date):Promise<{notificadas:number}>{
 const candidatas=await prisma.tarefa.findMany({where:{status:"ABERTA",OR:[{responsavelId:{not:null}},{notificados:{some:{}}}],lembrarEm:{lte:agora},lembreteDisparadoEm:null},select:{id:true},orderBy:[{lembrarEm:"asc"},{id:"asc"}]});
 let notificadas=0;const erros:unknown[]=[];
 for(const t of candidatas)try{notificadas+=(await dispararLembreteTarefa(t.id,agora)).notificadas;}catch(erro){erros.push(erro);}
 if(erros.length===1)throw erros[0];
 if(erros.length>1)throw new AggregateError(erros,"Falhas independentes ao entregar lembretes de tarefas.");
 return {notificadas};
}
export async function adiarLembrete(tarefaId: string, minutos: 10 | 60): Promise<Resultado> {
  return executarAcao(async () => {
    if (minutos !== 10 && minutos !== 60) throw new ErroRegra("Escolha 10 minutos ou 1 hora.");
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "tarefas.ver");
    await prisma.$transaction(async (tx) => {
      const t = await tx.tarefa.findFirst({
        where: { AND: [{ id: tarefaId }, await escopoTarefas(autor, false)] },
        select: { id: true, status: true, lembrarEm: true },
      });
      if (!t) throw new ErroRegra("Tarefa não encontrada.");
      if (t.status !== "ABERTA") throw new ErroRegra("Só tarefas abertas podem ter o lembrete adiado.");
      const lembrarEm = new Date(Date.now() + minutos * 60000);
      await tx.tarefa.update({ where: { id: t.id }, data: { lembrarEm, lembreteDisparadoEm: null, versao: { increment: 1 } } });
      await registrarEvento(tx, {
        tipo: "LembreteAdiado", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: autor.id,
        payload: { minutos, de: t.lembrarEm?.toISOString() ?? null, para: lembrarEm.toISOString() },
      });
    });
    revalidatePath("/tarefas");
    revalidatePath("/inicio");
  });
}
