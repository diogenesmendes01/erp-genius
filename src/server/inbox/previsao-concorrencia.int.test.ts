import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Client} from "pg";
import {Papel,type Prisma} from "@prisma/client";
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const r=await original<typeof import("@/server/_shared/sessao")>();const sessao=async()=>{const u=await r.carregarUsuarioFresco(await authMock());if(!u)throw new r.ErroAutenticacao();return u;};return{...r,exigirSessao:sessao,exigirSessaoComPapel:async(...p:Papel[])=>{const u=await sessao();r.exigirPapel(u,...p);return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco,criarUsuario} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {definirPrevisaoNoInbox} from "./acoes-previsao";
import {definirPrevisaoNoInboxTx,leadOcupadoParaPrevisao} from "./previsao-oportunidade";
import {atribuirDono,editarLead} from "@/server/comercial/acoes";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
const entrada=(id:string)=>({oportunidadeIdEsperada:id,esperado:{probabilidadePct:null,previsaoFechamento:null},alteracoes:{probabilidadePct:50}});
async function conexao(){const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();return c;}
async function espera(o:Client,pid:number,fragmento:string){const fim=Date.now()+2200;while(Date.now()<fim){await o.query('SELECT pg_stat_clear_snapshot()');const r=await o.query<{pid:number;query:string;blockers:number[]}>(`SELECT pid,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))`,[pid]);const row=r.rows.find(r=>r.query.includes(fragmento));if(row)return row;await new Promise<void>(r=>setTimeout(r,10));}throw Error("Espera SQL real não observada: "+fragmento);}
it("atribuirDono REAL espera Atendimento retido pelo setter; NOWAIT recusa e libera rollback sem ciclo alegado",async()=>{
 const c=await cenarioPerda328(),admin=await criarUsuario([Papel.ADMINISTRADOR]),destino=await criarUsuario([Papel.VENDEDOR]),o=await conexao();authMock.mockResolvedValue(admin.id);
 let liberar!:()=>void,chegou!:()=>void,pid=0;const barreira=new Promise<void>(r=>liberar=r),pronto=new Promise<void>(r=>chegou=r);
 const setter=prisma.$transaction(async tx=>{pid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
  const porta=new Proxy(tx,{get(alvo,chave){if(chave==='$queryRaw')return async(...args:unknown[])=>{const valor=await Reflect.apply(alvo.$queryRaw,alvo,args);if(Array.isArray(args[0])&&args[0].join('').includes('FOR NO KEY UPDATE')){chegou();await barreira;}return valor;};const v=Reflect.get(alvo,chave);return typeof v==='function'?v.bind(alvo):v;}}) as Prisma.TransactionClient;
  await definirPrevisaoNoInboxTx(porta,c.dono.id,c.a.id,entrada(c.op.id));
 },{timeout:15000}).then(()=>({ok:true as const}),erro=>({erro}));
 let transferir:Promise<Awaited<ReturnType<typeof atribuirDono>>>|undefined;
 try{await pronto;transferir=atribuirDono(c.op.id,destino.id);const bloqueada=await espera(o,pid,'AtendimentoWhatsApp');expect(bloqueada.blockers).toContain(pid);liberar();const resultado=await setter;expect('erro'in resultado&&leadOcupadoParaPrevisao(resultado.erro)).toBe(true);expect((await transferir).ok).toBe(true);expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).probabilidadePct).toBeNull();expect(await prisma.evento.count({where:{tipo:'LeadEditado'}})).toBe(0);
 }finally{liberar();await setter;await transferir;await o.end();}
});
it("public action converte55P03 fora da TX e não altera previsão/Evento",async()=>{
 const c=await cenarioPerda328(),h=await conexao();authMock.mockResolvedValue(c.dono.id);await h.query('BEGIN');await h.query('SELECT id FROM "Lead" WHERE id=$1 FOR UPDATE',[c.op.id]);try{const r=await definirPrevisaoNoInbox(c.a.id,entrada(c.op.id));expect(r).toMatchObject({ok:false,erro:expect.stringContaining('sendo atualizada')});expect(await prisma.evento.count()).toBe(0);expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).probabilidadePct).toBeNull();}finally{await h.query('ROLLBACK');await h.end();}
});
it("editarLead revalida papel após espera FK do País real",async()=>{
 const c=await cenarioPerda328(),h=await conexao(),o=await conexao();authMock.mockResolvedValue(c.dono.id);const pais=await prisma.pais.create({data:{nome:'País fictício341',codigoISO:'ZZ',ddi:'341',moedaLocal:'BRL'}});await h.query('BEGIN');const pid=(await h.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;await h.query('SELECT id FROM "Pais" WHERE id=$1 FOR UPDATE',[pais.id]);const tentativa=editarLead(c.op.id,{nome:c.op.nome,paisId:pais.id,probabilidadePct:50});try{await espera(o,pid,'Pais');await h.query(`UPDATE "Usuario" SET papeis=ARRAY['ALUNO']::"Papel"[] WHERE id=$1`,[c.dono.id]);await h.query('COMMIT');expect((await tentativa).ok).toBe(false);expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).probabilidadePct).toBeNull();expect(await prisma.evento.count()).toBe(0);}finally{await h.query('ROLLBACK').catch(()=>{});await tentativa;await Promise.all([h.end(),o.end()]);}
});it.each(['Portal','carteira'])('setter revalida %s após espera real no atendimento',async caso=>{
 const c=await cenarioPerda328(),h=await conexao(),o=await conexao(),outro=await criarUsuario([Papel.VENDEDOR]);authMock.mockResolvedValue(c.dono.id);await h.query('BEGIN');const pid=(await h.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;await h.query('SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE',[c.a.id]);const tentativa=definirPrevisaoNoInbox(c.a.id,entrada(c.op.id));
 try{await espera(o,pid,'AtendimentoWhatsApp');if(caso==='Portal')await h.query(`UPDATE "Usuario" SET papeis=ARRAY['ALUNO']::"Papel"[] WHERE id=$1`,[c.dono.id]);else await h.query('UPDATE "Lead" SET "vendedorDonoId"=$1 WHERE id=$2',[outro.id,c.op.id]);await h.query('COMMIT');expect((await tentativa).ok).toBe(false);expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).probabilidadePct).toBeNull();expect(await prisma.evento.count()).toBe(0);
 }finally{await h.query('ROLLBACK').catch(()=>{});await tentativa;await Promise.all([h.end(),o.end()]);}
});