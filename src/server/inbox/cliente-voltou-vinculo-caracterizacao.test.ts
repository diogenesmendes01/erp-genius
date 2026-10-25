import {expect,it,vi} from "vitest";
import type {Prisma} from "@prisma/client";
import {garantirAtendimento} from "@/server/whatsapp/atendimentos";
function banco(finalidadeNumero:string){
  const original={id:"at-sem-lead",conversaId:"conversa",contextoChave:"COMERCIAL:::",finalidade:"COMERCIAL",leadId:null,encerradoEm:null};
  const escritos:unknown[]=[];
  const tx={
    conversaWhatsApp:{upsert:vi.fn(async()=>({id:"conversa"})),findUnique:vi.fn(async()=>({grupoId:null,numero:{finalidade:finalidadeNumero,donoId:"dono"}}))},
    atendimentoWhatsApp:{
      findMany:vi.fn(async()=>[original]),
      updateMany:vi.fn(async({data}:{data:{leadId:string}})=>{original.leadId=data.leadId as never;return{count:1};}),
      findUniqueOrThrow:vi.fn(async()=>original),
      upsert:vi.fn(async(args:{create:object})=>{escritos.push(args);return{id:"at-da-oportunidade",...args.create};}),
    },
  };
  return {tx:tx as unknown as Prisma.TransactionClient,original,escritos};
}
it("caracterização: VENDAS preenche o atendimento aberto existente de forma condicional",async()=>{const c=banco("VENDAS");const r=await garantirAtendimento(c.tx,{numeroId:"numero",contatoId:"contato",finalidade:"COMERCIAL",leadId:"ganha"});expect(r.id).toBe("at-sem-lead");expect(c.original.leadId).toBe("ganha");expect(c.escritos).toHaveLength(0);});
it("caracterização: institucional cria contexto da oportunidade e mantém o selecionado sem lead",async()=>{const c=banco("AGENDA");const r=await garantirAtendimento(c.tx,{numeroId:"numero",contatoId:"contato",finalidade:"COMERCIAL",leadId:"ganha"});expect(r.id).toBe("at-da-oportunidade");expect(c.original.leadId).toBeNull();expect(c.escritos).toEqual([{where:{conversaId_contextoChave:{conversaId:"conversa",contextoChave:"COMERCIAL:ganha::"}},create:{conversaId:"conversa",contextoChave:"COMERCIAL:ganha::",finalidade:"COMERCIAL",leadId:"ganha",alunoId:undefined,matriculaId:undefined,turmaId:undefined,responsavelId:undefined,autorizacaoComunicacaoAcademicaId:undefined},update:{}}]);});