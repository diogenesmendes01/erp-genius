vi.mock("./tarefa-recorrencia-materializacao",()=>({rodarRecorrenciasTarefas:vi.fn(async()=>({criadas:0}))}));
import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
const {tx,evento,memoria}=vi.hoisted(()=>({memoria:{claim:false,notifs:[] as string[]},tx:{$queryRaw:vi.fn(),tarefa:{findMany:vi.fn()},tarefaNotificado:{findMany:vi.fn()},usuario:{findMany:vi.fn()},notificacaoUsuario:{create:vi.fn()}},evento:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:vi.fn(async(f:(db:typeof tx)=>unknown)=>{const antes={claim:memoria.claim,notifs:[...memoria.notifs]};try{return await f(tx);}catch(e){memoria.claim=antes.claim;memoria.notifs=antes.notifs;throw e;}})}}));
vi.mock("@/server/_shared/evento",()=>({registrarEvento:evento}));
import {rodarLembretesTarefas} from "./lembretes";
const usuario={id:"u",nome:"Pessoa",ativo:true,papeis:[Papel.VENDEDOR],permissoes:[],gerenteComercialId:null};
const task={id:"t",responsavelId:"u",titulo:"Tarefa",setor:"COMERCIAL",status:"ABERTA",versao:1,lembrarEm:new Date("2026-01-01T00:00:00Z"),lembreteDisparadoEm:new Date("2026-01-01T00:01:00Z")};
beforeEach(()=>{vi.clearAllMocks();memoria.claim=false;memoria.notifs=[];tx.notificacaoUsuario.create.mockReset().mockImplementation(async()=>{memoria.notifs.push("n");return {id:"n"};});tx.$queryRaw.mockImplementation(async()=>{memoria.claim=true;return [task];});tx.tarefa.findMany.mockResolvedValue([task]);tx.tarefaNotificado.findMany.mockResolvedValue([]);tx.usuario.findMany.mockResolvedValue([usuario]);});
it("deduplica responsável/notificados e conta tarefas, não pessoas",async()=>{tx.tarefaNotificado.findMany.mockResolvedValue([{tarefaId:"t",usuarioId:"u"},{tarefaId:"t",usuarioId:"admin"}]);tx.usuario.findMany.mockResolvedValue([usuario,{...usuario,id:"admin",papeis:[Papel.ADMINISTRADOR]}]);expect(await rodarLembretesTarefas(new Date())).toEqual({notificadas:1});expect(tx.notificacaoUsuario.create).toHaveBeenCalledTimes(2);expect(memoria).toEqual({claim:true,notifs:["n","n"]});});
it("zero elegíveis consome ciclo e audita motivo fechado sem aviso",async()=>{tx.usuario.findMany.mockResolvedValue([{...usuario,ativo:false}]);expect(await rodarLembretesTarefas(new Date())).toEqual({notificadas:0});expect(tx.notificacaoUsuario.create).not.toHaveBeenCalled();expect(evento.mock.calls[0][1].payload).toMatchObject({motivo:"SEM_DESTINATARIO_AUTORIZADO"});});
it("fila sem responsável pode avisar colega autorizado e claim inclui relação",async()=>{tx.$queryRaw.mockResolvedValueOnce([{...task,responsavelId:null}]).mockResolvedValue([]);tx.tarefa.findMany.mockResolvedValue([{...task,responsavelId:null}]);tx.tarefaNotificado.findMany.mockResolvedValue([{tarefaId:"t",usuarioId:"u"}]);expect(await rodarLembretesTarefas(new Date())).toEqual({notificadas:1});expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain('"TarefaNotificado"');});
it("destinatário revogado na conferência final não recebe aviso",async()=>{tx.usuario.findMany.mockResolvedValueOnce([usuario]).mockResolvedValue([{...usuario,papeis:[Papel.ALUNO]}]);expect(await rodarLembretesTarefas(new Date())).toEqual({notificadas:0});expect(tx.notificacaoUsuario.create).not.toHaveBeenCalled();});it("contenção55P03 deixa TX falhar e traduz fora dela sem retry",async()=>{tx.$queryRaw.mockRejectedValueOnce({code:"55P03"});await expect(rodarLembretesTarefas(new Date())).rejects.toThrow("Um colega está sendo atualizado");expect(tx.$queryRaw).toHaveBeenCalledOnce();expect(tx.notificacaoUsuario.create).not.toHaveBeenCalled();});
it("revogação durante create invalida fanout antes do Evento em vez de confirmar delivered",async()=>{
 let revogado=false;
 tx.usuario.findMany.mockImplementation(async()=>[revogado?{...usuario,ativo:false}:usuario]);
 tx.notificacaoUsuario.create.mockImplementationOnce(async()=>{memoria.notifs.push("n");revogado=true;return {id:"n"};});
 await expect(rodarLembretesTarefas(new Date())).rejects.toThrow("O lembrete mudou durante a entrega. Aguarde o próximo ciclo.");
 expect(tx.notificacaoUsuario.create).toHaveBeenCalledOnce();expect(evento).not.toHaveBeenCalled();expect(memoria).toEqual({claim:false,notifs:[]});
});
it("lease/estado alterado durante create recusa o lote antes de auditar entrega",async()=>{
 tx.notificacaoUsuario.create.mockImplementationOnce(async()=>{tx.tarefa.findMany.mockResolvedValue([{...task,status:"CANCELADA",versao:2}]);return {id:"n"};});
 await expect(rodarLembretesTarefas(new Date())).rejects.toThrow("O lembrete mudou durante a entrega. Aguarde o próximo ciclo.");expect(evento).not.toHaveBeenCalled();
});