import {afterAll,beforeEach,expect,it} from "vitest";
import {Client} from "pg";
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {definirPrevisaoNoInboxTx} from "./previsao-oportunidade";
import {CANAL_INBOX} from "./barramento";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
const entrada=(id:string)=>({oportunidadeIdEsperada:id,esperado:{probabilidadePct:null,previsaoFechamento:null},alteracoes:{probabilidadePct:50}});
async function escutar(id:string){const l=new Client({connectionString:process.env.DATABASE_URL}),avisos:unknown[]=[];await l.connect();l.on('notification',n=>{if(!n.payload)return;const p=JSON.parse(n.payload);if(p.atendimentoId===id)avisos.push(p);});await l.query(`LISTEN ${CANAL_INBOX}`);return{l,avisos,async receber(){await new Promise<void>(r=>setTimeout(r,150));await l.query('SELECT 1');return avisos;}};}
it("commit produz um Evento e um NOTIFY real somente de IDs",async()=>{const c=await cenarioPerda328(),s=await escutar(c.a.id);try{await prisma.$transaction(tx=>definirPrevisaoNoInboxTx(tx,c.dono.id,c.a.id,entrada(c.op.id)));expect(await s.receber()).toEqual([{tipo:'atendimento.atualizado',atendimentoId:c.a.id,mensagemId:null,conversaId:c.conversa.id}]);expect(await prisma.evento.count()).toBe(1);}finally{await s.l.end();}});
it("no-op repetido não duplica Evento nem NOTIFY",async()=>{const c=await cenarioPerda328();await prisma.$transaction(tx=>definirPrevisaoNoInboxTx(tx,c.dono.id,c.a.id,entrada(c.op.id)));const s=await escutar(c.a.id);try{await prisma.$transaction(tx=>definirPrevisaoNoInboxTx(tx,c.dono.id,c.a.id,entrada(c.op.id)));expect(await s.receber()).toEqual([]);expect(await prisma.evento.count()).toBe(1);}finally{await s.l.end();}});
it("falha SQL após mutação+Evento+NOTIFY faz rollback dos três efeitos",async()=>{const c=await cenarioPerda328(),s=await escutar(c.a.id);try{await expect(prisma.$transaction(async tx=>{await definirPrevisaoNoInboxTx(tx,c.dono.id,c.a.id,entrada(c.op.id));await tx.$queryRaw`SELECT 1 / 0`;})).rejects.toThrow();expect(await s.receber()).toEqual([]);expect(await prisma.evento.count()).toBe(0);expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).probabilidadePct).toBeNull();}finally{await s.l.end();}});