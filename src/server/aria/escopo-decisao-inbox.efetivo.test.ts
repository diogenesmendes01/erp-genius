import { beforeEach,expect,it,vi } from "vitest";
import { Papel } from "@prisma/client";
import type { Db } from "../whatsapp/escopo";
const globais=vi.hoisted(()=>vi.fn());
vi.mock("./escopo-decisao",()=>({leadsDecidiveis:globais}));
import { acoesDecidiveisNoInbox } from "./escopo-decisao-inbox";
const u={id:"gc",nome:"Gerente",papeis:[Papel.GERENTE_COMERCIAL]};
const contexto={id:"thread",finalidade:"COMERCIAL",responsavelId:"gc",leadId:"atual"};
const alvo=(acao="RESPONDER")=>({id:"s",atendimentoId:"thread",oportunidadeId:"antigo",acao,payload:{texto:"Olá"}});
const db={oportunidade:{findMany:vi.fn().mockResolvedValue([{id:"antigo",pessoaId:"p1"},{id:"atual",pessoaId:"p2"}])}} as unknown as Db;
beforeEach(()=>{globais.mockReset();globais.mockResolvedValue(new Set(["antigo"]));});
it.each(["RESPONDER","ENVIAR_DOCUMENTO"])("%s não usa escopo só do alvo antigo para executar no alvo atual",async acao=>{
 expect(await acoesDecidiveisNoInbox(db,u,contexto,[alvo(acao)])).toEqual(new Set());
 expect(globais).toHaveBeenCalledWith(db,u,expect.arrayContaining(["antigo","atual"]));
});
it("ambos os alvos autorizados permitem a resposta sem N+1",async()=>{
 globais.mockResolvedValue(new Set(["antigo","atual"]));expect(await acoesDecidiveisNoInbox(db,u,contexto,[alvo()])).toEqual(new Set(["s"]));expect(globais).toHaveBeenCalledTimes(1);
});
it("Admin também precisa da autorização efetiva retornada pelo lote",async()=>{
 expect(await acoesDecidiveisNoInbox(db,{...u,papeis:[Papel.ADMINISTRADOR]},contexto,[alvo()])).toEqual(new Set());
});
it("vendedor não ganha exceção pelo alvo divergente mesmo com acesso aos dois",async()=>{
 globais.mockResolvedValue(new Set(["antigo","atual"]));expect(await acoesDecidiveisNoInbox(db,{...u,papeis:[Papel.VENDEDOR]},contexto,[alvo()])).toEqual(new Set());
});
