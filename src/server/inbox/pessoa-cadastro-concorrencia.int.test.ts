import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {PrismaClient} from "@prisma/client";
import {afterAll,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:m.auth}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa,entradaCadastro,bloquearPessoaCadastro,conectarCadastro,esperarPessoaBloqueada,barreiraCadastro,type CenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {editarContatoNoInbox} from "./acoes-painel";
import {editarPessoaNaTransacao} from "@/server/crm/contatos";
beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();});afterAll(()=>prisma.$disconnect());
async function esperarEMutar(c:CenarioCadastroPessoa,mutar:(observer:Awaited<ReturnType<typeof conectarCadastro>>)=>Promise<unknown>){const holder=await bloquearPessoaCadastro(c.pessoa.id),observer=await conectarCadastro();let pedido:ReturnType<typeof editarContatoNoInbox>|undefined;try{pedido=editarContatoNoInbox(c.atendimento.id,entradaCadastro(c));await esperarPessoaBloqueada(observer,holder.pid);await mutar(observer);}finally{await holder.sair();if(pedido)await pedido.catch(()=>undefined);await observer.end();}if(!pedido)throw Error("Fixture sem pedido");return pedido;}
it.each(["Portal","inativo"])("ator %s durante espera SQL real recusa semPessoa/Evento",async caso=>{const c=await cenarioCadastroPessoa();m.auth.mockResolvedValue({user:{id:c.dono.id}});const r=await esperarEMutar(c,observer=>caso==="Portal"?observer.query('UPDATE "Usuario" SET papeis=ARRAY[\'ALUNO\']::"Papel"[] WHERE id=$1',[c.dono.id]):observer.query('UPDATE "Usuario" SET ativo=false WHERE id=$1',[c.dono.id]));expect(r).toMatchObject({ok:false});expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).documento).toBeNull();expect(await prisma.evento.count()).toBe(0);});
it("cobertura revogada COMMIT durantePessoaLock mantém papéis mas recusa escopo",async()=>{const c=await cenarioCadastroPessoa();await prisma.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:c.outro.id}});const cobertura=await prisma.coberturaCarteira.create({data:{titularId:c.outro.id,substitutoId:c.dono.id,concedenteId:c.admin.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+600000),motivo:"Cobertura fictícia340"}});m.auth.mockResolvedValue({user:{id:c.dono.id}});const r=await esperarEMutar(c,observer=>observer.query('UPDATE "CoberturaCarteira" SET "revogadaEm"=now() WHERE id=$1',[cobertura.id]));expect(r).toMatchObject({ok:false});expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).documento).toBeNull();expect(await prisma.evento.count()).toBe(0);});
it("Pessoa da oportunidade trocada durante espera não retargeta escrita",async()=>{const c=await cenarioCadastroPessoa(),outra=await prisma.pessoa.create({data:{nome:"Outra fictícia340"}});m.auth.mockResolvedValue({user:{id:c.dono.id}});const r=await esperarEMutar(c,observer=>observer.query('UPDATE "Lead" SET "pessoaId"=$1 WHERE id=$2',[outra.id,c.op.id]));expect(r).toMatchObject({ok:false});expect(await prisma.pessoa.findMany({where:{id:{in:[c.pessoa.id,outra.id]}},select:{documento:true}})).toEqual([{documento:null},{documento:null}]);expect(await prisma.evento.count()).toBe(0);});
it("revogação real dentro callback pósEvento reverte Pessoa+Evento naTX",async()=>{const c=await cenarioCadastroPessoa(),chegou=barreiraCadastro(),soltar=barreiraCadastro(),observer=await conectarCadastro();let pedido:Promise<unknown>|undefined;try{pedido=prisma.$transaction(tx=>editarPessoaNaTransacao(tx,c.dono,c.pessoa.id,entradaCadastro(c).pessoa,async()=>{if(await tx.evento.count({where:{tipo:"PessoaEditada",agregadoId:c.pessoa.id}})){chegou.liberar();await soltar.promessa;}}));const falhaAntes=pedido.then(()=>{throw Error("Núcleo terminou antes da barreira pósEvento");},e=>e);await Promise.race([chegou.promessa,falhaAntes.then(()=>{throw Error("Núcleo recusou antes do Evento esperado");})]);const alterado=await observer.query('UPDATE "Usuario" SET papeis=ARRAY[\'ALUNO\']::"Papel"[] WHERE id=$1',[c.dono.id]);expect(alterado.rowCount).toBe(1);soltar.liberar();await expect(pedido).rejects.toThrow();}finally{soltar.liberar();if(pedido)await pedido.catch(()=>undefined);await observer.end();}expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).documento).toBeNull();expect(await prisma.evento.count()).toBe(0);});
it("DELETE Tipo não confirmado causa55P03 controlado foraTX e rollback total",async()=>{const c=await cenarioCadastroPessoa(),holder=await conectarCadastro();m.auth.mockResolvedValue({user:{id:c.dono.id}});await holder.query("BEGIN");try{await holder.query('DELETE FROM "TipoDocumento" WHERE id=$1',[c.tipo.id]);const r=await editarContatoNoInbox(c.atendimento.id,{...entradaCadastro(c),pessoa:{...entradaCadastro(c).pessoa,cidade:"NAO-GRAVAR"}});expect(r).toMatchObject({ok:false,erro:expect.stringMatching(/atualizado|Recarregue/)});}finally{await holder.query("ROLLBACK");await holder.end();}expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({cidade:"Cidade inicial",documento:null});expect(await prisma.evento.count()).toBe(0);});
it("DELETE real do autor retido recusa55P03 sem inversão bloqueante nova",async()=>{const c=await cenarioCadastroPessoa(),holder=await conectarCadastro();m.auth.mockResolvedValue({user:{id:c.dono.id}});await holder.query("BEGIN");try{await holder.query('DELETE FROM "Usuario" WHERE id=$1',[c.dono.id]);expect(await editarContatoNoInbox(c.atendimento.id,entradaCadastro(c))).toMatchObject({ok:false});}finally{await holder.query("ROLLBACK");await holder.end();}expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).documento).toBeNull();expect(await prisma.evento.count()).toBe(0);});
type IdentidadeWriter={pid:number;app:string};
type NoEspera={pid:number;application_name:string;query:string;wait_event_type:string|null;wait_event:string|null;bloqueadores:number[]};
function identidadeWriter(){let publicar!:(id:IdentidadeWriter)=>void;const promessa=new Promise<IdentidadeWriter>(r=>{publicar=r;});return {promessa,publicar};}
it("dois writers reais serializados preservam Doc quando o outro altera só nome",async()=>{
 const c=await cenarioCadastroPessoa(),holder=await bloquearPessoaCadastro(c.pessoa.id),observer=await conectarCadastro();
 const appA="inbox340-writerA-"+process.pid,appB="inbox340-writerB-"+process.pid;
 const urlA=new URL(process.env.DATABASE_URL!),urlB=new URL(process.env.DATABASE_URL!);
 urlA.searchParams.set("connection_limit","1");urlB.searchParams.set("connection_limit","1");urlA.searchParams.set("application_name",appA);urlB.searchParams.set("application_name",appB);
 const a=new PrismaClient({datasources:{db:{url:urlA.toString()}}}),b=new PrismaClient({datasources:{db:{url:urlB.toString()}}});
 const identidadeA=identidadeWriter(),identidadeB=identidadeWriter();
 let pa:Promise<unknown>|undefined,pb:Promise<unknown>|undefined,writerA:IdentidadeWriter|undefined,writerB:IdentidadeWriter|undefined;
 let grafo:NoEspera[]=[],caminhos:number[][]=[],validado=false,observadoEm:string|null=null;
 let resultadoA:unknown="nao_iniciado",resultadoB:unknown="nao_iniciado";
 const arquivo=resolve("output","inbox-340-two-writers-graph-"+process.pid+"-private.json");
 try{
  pa=a.$transaction(async tx=>{const rows=await tx.$queryRaw<IdentidadeWriter[]>`SELECT pg_backend_pid() pid,current_setting('application_name')::text app`;const id=rows[0];if(!id)throw Error("WriterA sem identidade");expect(id.app).toBe(appA);identidadeA.publicar(id);return editarPessoaNaTransacao(tx,c.dono,c.pessoa.id,{documento:"CONCORRENTE-FICTICIO340",nascimento:"2000-02-29"});});
  pb=b.$transaction(async tx=>{const rows=await tx.$queryRaw<IdentidadeWriter[]>`SELECT pg_backend_pid() pid,current_setting('application_name')::text app`;const id=rows[0];if(!id)throw Error("WriterB sem identidade");expect(id.app).toBe(appB);identidadeB.publicar(id);return editarPessoaNaTransacao(tx,c.dono,c.pessoa.id,{nome:"Nome concorrente340"});});
  [writerA,writerB]=await Promise.all([Promise.race([identidadeA.promessa,pa.then(()=>{throw Error("WriterA terminou antes da identidade");})]),Promise.race([identidadeB.promessa,pb.then(()=>{throw Error("WriterB terminou antes da identidade");})])]);
  const conhecidos=[holder.pid,writerA.pid,writerB.pid];expect(new Set(conhecidos).size).toBe(3);
  await vi.waitFor(async()=>{
   await observer.query("SELECT pg_stat_clear_snapshot()");
   const r=await observer.query<NoEspera>('SELECT pid,application_name,query,wait_event_type,wait_event,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE datname=current_database() AND pid=ANY($1::int[])',[conhecidos]);
   grafo=r.rows;observadoEm=new Date().toISOString();expect(grafo).toHaveLength(3);
   const porPid=new Map(grafo.map(n=>[n.pid,n]));
   const writers=[writerA!,writerB!].map(id=>{const n=porPid.get(id.pid);expect(n,JSON.stringify(grafo)).toBeDefined();if(!n)throw Error("Writer não encontrado");expect(n.application_name).toBe(id.app);expect(n.wait_event_type,JSON.stringify(grafo)).toBe("Lock");expect(n.query).toMatch(/SELECT id FROM "Pessoa" WHERE id = \$1 FOR UPDATE/);expect(n.bloqueadores.length).toBeGreaterThan(0);expect(n.bloqueadores.every(pid=>conhecidos.includes(pid))).toBe(true);return n;});
   expect(new Set(writers.map(n=>n.query.replace(/\s+/g," ").trim())).size).toBe(1);
   function caminho(pid:number,visitados:number[]=[]):number[]|null{if(pid===holder.pid)return [pid];if(visitados.includes(pid)||!conhecidos.includes(pid))return null;for(const bloqueador of porPid.get(pid)?.bloqueadores??[]){const trecho=caminho(bloqueador,[...visitados,pid]);if(trecho)return [pid,...trecho];}return null;}
   caminhos=writers.map(n=>{const c=caminho(n.pid);expect(c,JSON.stringify(grafo)).not.toBeNull();if(!c)throw Error("Writer sem caminho até holder");return c;});validado=true;
  },{timeout:4000,interval:20});
 }finally{
  await holder.sair();
  if(pa)await pa.then(v=>{resultadoA=typeof v==="boolean"?v:typeof v;},e=>{resultadoA={erro:e instanceof Error?e.name:"desconhecido"};});
  if(pb)await pb.then(v=>{resultadoB=typeof v==="boolean"?v:typeof v;},e=>{resultadoB={erro:e instanceof Error?e.name:"desconhecido"};});
  await a.$disconnect();await b.$disconnect();await observer.end();
  const writers=grafo.filter(n=>n.pid===writerA?.pid||n.pid===writerB?.pid);
  await mkdir("output",{recursive:true});await writeFile(arquivo,JSON.stringify({versao:1,fixturePessoaId:c.pessoa.id,holderPid:holder.pid,writerA,writerB,observadoEm,validado,grafo,caminhos,diretosAoHolder:writers.filter(n=>n.bloqueadores.includes(holder.pid)).length,resultados:{a:resultadoA,b:resultadoB},qualificacao:"SQL real; grafo só de PIDs conhecidos. Não inferir hard/soft nem deadlock geral além da observação."},null,2)+"\n","utf8");
  console.info("GRAFO_340",arquivo);
 }
 await expect(pa).resolves.toBe(true);await expect(pb).resolves.toBe(true);
 expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({nome:"Nome concorrente340",documento:"CONCORRENTE-FICTICIO340",nascimento:new Date("2000-02-29T00:00:00Z")});
 expect(await prisma.evento.count({where:{tipo:"PessoaEditada",agregadoId:c.pessoa.id}})).toBe(2);
});
