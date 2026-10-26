import {afterAll,beforeEach,expect,it,vi} from "vitest";
vi.hoisted(()=>{const u=new URL(process.env.DATABASE_URL!);u.searchParams.set('connection_limit','1');u.searchParams.set('pool_timeout','3');process.env.DATABASE_URL=u.toString();(globalThis as {prisma?:unknown}).prisma=undefined;});
import {Papel} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {criarUsuario,truncarBanco} from "@/test/integracao";
import {listarNotificacoes} from "./notificacoes";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
it('Db fornecida em ReadCommitted/pool1 não consulta singleton nem abre TX interna',async()=>{expect(process.env.DATABASE_URL).toContain('connection_limit=1');const u=await criarUsuario([Papel.VENDEDOR]),t=await prisma.tarefa.create({data:{titulo:'Pool1 fictício338',tipo:'OUTRO',setor:'COMERCIAL',responsavelId:u.id,fusoOrigem:'UTC'}});await prisma.notificacaoUsuario.create({data:{usuarioId:u.id,tipo:'LEMBRETE_TAREFA',refTipo:'Tarefa',refId:t.id,titulo:'Aviso pool1'}});const r=await prisma.$transaction(tx=>listarNotificacoes(u,tx),{isolationLevel:'ReadCommitted'});expect(r.map(n=>n.refId)).toEqual([t.id]);expect(await listarNotificacoes(u)).toHaveLength(1);});