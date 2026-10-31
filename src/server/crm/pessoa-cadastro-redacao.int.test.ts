import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {mkdir,writeFile} from "node:fs/promises";
const m=vi.hoisted(()=>{const nomeApp="inbox340-redacao-"+process.pid,url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("application_name",nomeApp);process.env.DATABASE_URL=url.toString();(globalThis as {prisma?:unknown}).prisma=undefined;return {auth:vi.fn(),nomeApp};});
vi.mock("@/lib/auth",()=>({auth:m.auth}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa,conectarCadastro,type CenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {editarPessoa} from "./contatos";
const canaisCanario:string[][]=[];
function coletarLogger(){const capturas:{canal:string;texto:string}[]=[];const spies=(["log","error","warn","info"] as const).map(canal=>{const original=console[canal].bind(console);return vi.spyOn(console,canal).mockImplementation((...args:unknown[])=>{capturas.push({canal,texto:args.map(String).join(" ")});original(...args);});});return {capturas,restaurar(){for(const spy of spies)spy.mockRestore();}};}
async function canarioLogger(log:ReturnType<typeof coletarLogger>){await expect(prisma.$executeRaw`SELECT 1/0`).rejects.toThrow();await vi.waitFor(()=>expect(log.capturas.some(x=>x.texto.includes("prisma:error"))).toBe(true));const canais=[...new Set(log.capturas.filter(x=>x.texto.includes("prisma:error")).map(x=>x.canal))];expect(canais.length).toBeGreaterThan(0);canaisCanario.push(canais);}
beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();});afterAll(async()=>{await prisma.$disconnect();await mkdir("output",{recursive:true});await writeFile("output/inbox-340-redacao-canais-"+process.pid+"-private.json",JSON.stringify({canaisCanario,emissaoRealPreservada:true},null,2)+"\n","utf8");});
async function comFKRetida(c:CenarioCadastroPessoa,durante:(observer:Awaited<ReturnType<typeof conectarCadastro>>,pid:number,banco:string)=>Promise<void>){
 const empresa=await prisma.empresa.create({data:{nome:"Empresa fictícia340"}});
 await prisma.oportunidade.create({data:{nome:"Empresa visível340",empresaId:empresa.id,vendedorDonoId:c.dono.id,b2b:true}});
 const identificacao=await prisma.$queryRaw<{pid:number;banco:string;app:string}[]>`SELECT pg_backend_pid() pid,current_database()::text banco,current_setting('application_name')::text app`;
 const propria=identificacao[0];if(!propria)throw Error("Conexão própria não identificada");
 expect(propria.app).toBe(m.nomeApp);expect(propria.banco).toBe(new URL(process.env.DATABASE_URL!).pathname.slice(1));
 const holder=await conectarCadastro(),observer=await conectarCadastro();let pedido:ReturnType<typeof editarPessoa>|undefined;
 await holder.query("BEGIN");try{
  await holder.query('SELECT id FROM "Empresa" WHERE id=$1 FOR UPDATE',[empresa.id]);
  const h=await holder.query<{pid:number}>("SELECT pg_backend_pid() pid"),holderPid=h.rows[0]!.pid;
  m.auth.mockResolvedValue({user:{id:c.dono.id}});
  pedido=editarPessoa(c.pessoa.id,{empresaId:empresa.id,documento:"DOC-REDACAO340",nascimento:"2000-02-29"});
  await vi.waitFor(async()=>{await observer.query("SELECT pg_stat_clear_snapshot()");const r=await observer.query<{pid:number;datname:string;application_name:string;query:string;bloqueadores:number[]}>('SELECT pid,datname,application_name,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE pid=$1 AND datname=$2',[propria.pid,propria.banco]);const row=r.rows[0];expect(row?.pid).toBe(propria.pid);expect(row?.application_name).toBe(m.nomeApp);expect(row?.query).toMatch(/UPDATE[\s\S]*"Pessoa"/);expect(row?.bloqueadores).toContain(holderPid);},{timeout:4000,interval:20});
  await durante(observer,propria.pid,propria.banco);
 }finally{await holder.query("ROLLBACK");await holder.end();if(pedido)await pedido.catch(()=>undefined);await observer.end();}
 if(!pedido)throw Error("Fixture sem pedido");return pedido;
}
it("controle positivo coleta loggerPrisma real antes de testar redigência",async()=>{const log=coletarLogger();try{await canarioLogger(log);}finally{log.restaurar();}});
it("esperaFK real permite revogaçãoPortalCOMMIT e depois rollback cadastral",async()=>{const c=await cenarioCadastroPessoa();expect(await comFKRetida(c,async(observer)=>{const r=await observer.query('UPDATE "Usuario" SET papeis=ARRAY[\'ALUNO\']::"Papel"[] WHERE id=$1',[c.dono.id]);expect(r.rowCount).toBe(1);})).toMatchObject({ok:false});expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({documento:null,nascimento:null,empresaId:null});expect(await prisma.evento.count()).toBe(0);});
it("cancelar somente query própria bloqueada não expõe Doc/DOB no loggerORM",async()=>{const c=await cenarioCadastroPessoa(),log=coletarLogger();try{await canarioLogger(log);log.capturas.length=0;const r=await comFKRetida(c,async(observer,pid,banco)=>{const own=await observer.query<{pid:number;datname:string;application_name:string}>('SELECT pid,datname,application_name FROM pg_stat_activity WHERE pid=$1 AND datname=$2',[pid,banco]);expect(own.rows[0]).toMatchObject({pid,datname:banco,application_name:m.nomeApp});const cancel=await observer.query<{cancelou:boolean}>('SELECT pg_cancel_backend($1) cancelou',[pid]);expect(cancel.rows[0]?.cancelou).toBe(true);});expect(r).toMatchObject({ok:false});const mensagens=log.capturas.map(x=>x.texto).join("\n");expect(mensagens).toContain("prisma:error");expect(mensagens).not.toMatch(/DOC-REDACAO340|2000-02-29/);expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({documento:null,nascimento:null,empresaId:null});expect(await prisma.evento.count()).toBe(0);}finally{log.restaurar();}});
