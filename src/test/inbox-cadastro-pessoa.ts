import {Papel} from "@prisma/client";
import {Client} from "pg";
import {expect,vi} from "vitest";
import {prisma} from "@/lib/prisma";
import {configurarFusoDaEscola,criarUsuario} from "./integracao";
import {CANAL_INBOX} from "@/server/inbox/barramento";
let seq=0;
/** Fixtures fictícias #340; só executar sob lease/perfil original de integração. */
export async function cenarioCadastroPessoa(){
 const dono=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício340");
 const outro=await criarUsuario([Papel.VENDEDOR],"Outro fictício340");
 const admin=await criarUsuario([Papel.ADMINISTRADOR],"Admin fictício340");
 const guest=await criarUsuario([Papel.PROFESSOR],"Professor fictício340");
 const pais=await prisma.pais.create({data:{nome:"Costa Rica fictícia340",codigoISO:"CR",moedaLocal:"CRC",ddi:"+506",tiposDocumento:{create:{nome:"Cédula fictícia340",validador:"cedula_cr"}}},include:{tiposDocumento:true}});
 const tipo=pais.tiposDocumento[0];if(!tipo)throw Error("Fixture sem tipo");
 const pessoa=await prisma.pessoa.create({data:{nome:"Pessoa fictícia340",cidade:"Cidade inicial"}});
 const op=await prisma.oportunidade.create({data:{nome:"Curso fictício340",vendedorDonoId:dono.id,pessoaId:pessoa.id}});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+55000340"+String(++seq).padStart(5,"0"),pessoaId:pessoa.id,leadId:op.id}});
 const numero=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+55001340"+String(seq).padStart(5,"0"),rotulo:"Linha fictícia340",driver:"MOTOR",finalidade:"VENDAS",donoId:dono.id}});
 const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numero.id,contatoId:contato.id}});
 const atendimento=await prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"COMERCIAL::340:"+seq,finalidade:"COMERCIAL",leadId:op.id}});
 await configurarFusoDaEscola("America/Costa_Rica");
 return {dono,outro,admin,guest,pais,tipo,pessoa,op,contato,numero,conversa,atendimento};
}
export type CenarioCadastroPessoa=Awaited<ReturnType<typeof cenarioCadastroPessoa>>;
export const entradaCadastro=(c:CenarioCadastroPessoa)=>({pessoaIdEsperada:c.pessoa.id,pessoa:{documento:"FICTICIO-LATAM340",tipoDocumentoId:c.tipo.id,documentoPaisEmissor:"CR",nascimento:"2000-02-29"}});
export function barreiraCadastro(){let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return {promessa,liberar};}
export async function conectarCadastro(){const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();return c;}
export async function bloquearPessoaCadastro(pessoaId:string){const c=await conectarCadastro();await c.query("BEGIN");await c.query('SELECT id FROM "Pessoa" WHERE id=$1 FOR UPDATE',[pessoaId]);const r=await c.query<{pid:number}>("SELECT pg_backend_pid() pid");return {client:c,pid:r.rows[0]!.pid,async sair(){await c.query("ROLLBACK");await c.end();}};}
/** Observa espera SQL real; a barreira é instrumental, não substitui ACL/SQL. */
export async function esperarPessoaBloqueada(observer:Client,holder:number){let pid:number|undefined;await vi.waitFor(async()=>{await observer.query("SELECT pg_stat_clear_snapshot()");const r=await observer.query<{pid:number;query:string;bloqueadores:number[]}>('SELECT pid,query,pg_blocking_pids(pid) bloqueadores FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()');const w=r.rows.find(x=>x.bloqueadores.includes(holder)&&x.query.includes('FROM "Pessoa"'));expect(w).toBeDefined();pid=w?.pid;},{timeout:5000,interval:20});return pid;}
export async function escutarCadastro(){const c=await conectarCadastro(),quadros:Record<string,unknown>[]=[];c.on("notification",n=>{if(n.channel===CANAL_INBOX&&n.payload)quadros.push(JSON.parse(n.payload));});await c.query("LISTEN "+CANAL_INBOX);return {client:c,quadros,sair:()=>c.end()};}
