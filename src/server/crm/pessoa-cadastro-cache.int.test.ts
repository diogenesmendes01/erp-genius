import {afterAll,afterEach,beforeEach,expect,it,vi} from "vitest";
import {Papel,type Prisma} from "@prisma/client";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import type {UsuarioSessao} from "@/server/_shared/sessao";
type CapturaCatalogo={model:"tipoDocumento";operation:"findMany";consultaRealConcluida:true;quantidade:number};
type CanarioCatalogo={pid?:number;sqlCanarioConfirmado:boolean;capturaConfirmada:boolean;retornoConfirmado:boolean;capturas:CapturaCatalogo[]};
type ReactServidor={cache:unknown;__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{A:unknown}};
const m=vi.hoisted(()=>({react:null as ReactServidor|null,armada:false,chegou:null as (()=>void)|null,soltar:Promise.resolve(),capturas:[] as CapturaCatalogo[],canarios:[] as CanarioCatalogo[],revogacoes:[] as {rowCount:number;catalogoRealConcluido:boolean}[]}));
vi.mock("react",async original=>{const real=await original<typeof import("react")>(),{createRequire}=await import("node:module");m.react=createRequire(import.meta.url)("next/dist/compiled/react/cjs/react.react-server.development.js") as ReactServidor;return {...real,cache:m.react.cache};});
vi.mock("@/lib/prisma",async original=>{
 const real=await original<typeof import("@/lib/prisma")>();
 function observar(tx:Prisma.TransactionClient){return new Proxy(tx,{get(alvo,propriedade,receptor){
  const valor=Reflect.get(alvo,propriedade,receptor);
  if(propriedade==="tipoDocumento")return new Proxy(valor,{get(delegate,metodo,receiver){
   const fn=Reflect.get(delegate,metodo,receiver);
   if(metodo!=="findMany"||typeof fn!=="function")return typeof fn==="function"?fn.bind(delegate):fn;
   return async(...args:unknown[])=>{const r=await Reflect.apply(fn,delegate,args);if(!Array.isArray(r))throw Error("Catálogo real não retornou lista");m.capturas.push({model:"tipoDocumento",operation:"findMany",consultaRealConcluida:true,quantidade:r.length});if(m.armada){m.armada=false;m.chegou?.();await m.soltar;}return r;};
  }});
  return typeof valor==="function"?valor.bind(alvo):valor;
 }});}
 return {...real,prisma:new Proxy(real.prisma,{get(alvo,propriedade,receptor){
  const valor=Reflect.get(alvo,propriedade,receptor);
  if(propriedade==="$transaction"&&typeof valor==="function")return (...args:unknown[])=>{const [operacao,...opcoes]=args;if(typeof operacao!=="function")return Reflect.apply(valor,alvo,args);return Reflect.apply(valor,alvo,[(tx:Prisma.TransactionClient)=>Reflect.apply(operacao,undefined,[observar(tx)]),...opcoes]);};
  return typeof valor==="function"?valor.bind(alvo):valor;
 }})};
});
import {prisma} from "@/lib/prisma";
import {truncarBanco,criarUsuario} from "@/test/integracao";
import {cenarioCadastroPessoa,conectarCadastro,barreiraCadastro,type CenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {obterContato} from "./contatos";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
function request(ativo=true){const cache=new Map<unknown,unknown>();m.react!.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.A=ativo?{getCacheForType(criar:()=>unknown){if(!cache.has(criar))cache.set(criar,criar());return cache.get(criar);}}:null;}
beforeEach(async()=>{m.armada=false;m.chegou=null;m.capturas.length=0;await truncarBanco();request();});afterEach(()=>{m.armada=false;request(false);});afterAll(async()=>{await prisma.$disconnect();await mkdir("output",{recursive:true});await writeFile(resolve("output","inbox-340-cache-canarios-"+process.pid+"-private.json"),JSON.stringify({canarios:m.canarios,revogacoes:m.revogacoes,qualificacao:"SQL real e callthrough da TX protegida; React.cache real/dispatcher instrumental, não renderizaçãoRSC."},null,2)+"\n","utf8");});
async function preparar(){const c=await cenarioCadastroPessoa();await prisma.pessoa.update({where:{id:c.pessoa.id},data:{documento:"FICTICIO-CACHE340",tipoDocumentoId:c.tipo.id,nascimento:new Date("2000-02-29T00:00:00Z")}});return c;}
async function confirmarCanario(){
 const chegou=barreiraCadastro(),soltar=barreiraCadastro(),registro:CanarioCatalogo={sqlCanarioConfirmado:false,capturaConfirmada:false,retornoConfirmado:false,capturas:[]};m.canarios.push(registro);m.capturas.length=0;m.armada=true;m.chegou=chegou.liberar;m.soltar=soltar.promessa;
 expect(Reflect.get(prisma,Symbol.for("erp.transacoes-confirmadas"))).toBe(true);
 const pedido=prisma.$transaction(async tx=>{const linhas=await tx.$queryRaw<{canario:number;pid:number}[]>`SELECT 1::int canario,pg_backend_pid() pid`;expect(linhas[0]?.canario).toBe(1);expect(linhas[0]?.pid).toBeGreaterThan(0);registro.pid=linhas[0]?.pid;registro.sqlCanarioConfirmado=true;return tx.tipoDocumento.findMany({select:{id:true},take:1});},{isolationLevel:"ReadCommitted"});
 try{await Promise.race([chegou.promessa,pedido.then(()=>{throw Error("Canário terminou sem captura do catálogo real");})]);expect(m.capturas).toEqual([{model:"tipoDocumento",operation:"findMany",consultaRealConcluida:true,quantidade:1}]);registro.capturaConfirmada=true;}
 finally{registro.capturas=[...m.capturas];soltar.liberar();m.armada=false;m.chegou=null;await pedido.catch(()=>undefined);}
 expect(await pedido).toHaveLength(1);registro.retornoConfirmado=true;m.capturas.length=0;
}
async function lerComRevogacao(c:CenarioCadastroPessoa,ator:UsuarioSessao,mutar:(db:Awaited<ReturnType<typeof conectarCadastro>>)=>Promise<unknown>){
 await confirmarCanario();
 const chegou=barreiraCadastro(),soltar=barreiraCadastro(),db=await conectarCadastro();m.armada=true;m.chegou=chegou.liberar;m.soltar=soltar.promessa;let pedido:ReturnType<typeof obterContato>|undefined;
 try{pedido=obterContato(c.pessoa.id,ator);const cedo=pedido.then(()=>{throw Error("Getter terminou antes do catálogo real");});await Promise.race([chegou.promessa,cedo]);expect(m.capturas.some(c=>c.consultaRealConcluida)).toBe(true);const alterado=await mutar(db);expect(alterado).toMatchObject({rowCount:1});m.revogacoes.push({rowCount:1,catalogoRealConcluido:true});}
 finally{soltar.liberar();m.armada=false;m.chegou=null;if(pedido)await pedido.catch(()=>undefined);await db.end();}
 if(!pedido)throw Error("Fixture sem leitura");return pedido;
}it("RSCinstrumentado: coberturaCOMMIT em outra conexão retira2blocos apesar do memo aquecido",async()=>{const c=await preparar();await prisma.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:c.outro.id}});const cobertura=await prisma.coberturaCarteira.create({data:{titularId:c.outro.id,substitutoId:c.dono.id,concedenteId:c.admin.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+600000),motivo:"Cobertura fictícia340"}});const quente=await escopoComercialAtual(c.dono);const d=await lerComRevogacao(c,c.dono,db=>db.query('UPDATE "CoberturaCarteira" SET "revogadaEm"=now() WHERE id=$1',[cobertura.id]));expect(await escopoComercialAtual(c.dono)).toEqual(quente);expect(d?.nome).toBe(c.pessoa.nome);expect(d).toMatchObject({cadastroPessoa:null,informacoesCadastro:null});expect(JSON.stringify(d)).not.toMatch(/FICTICIO-CACHE|2000-02-29/);request();expect(await escopoComercialAtual(c.dono)).not.toEqual(quente);});
it("RSCinstrumentado: equipe muda com papelGC igual e getter cadastral recusa",async()=>{const c=await preparar(),gerente=await criarUsuario([Papel.GERENTE_COMERCIAL]);await prisma.usuario.update({where:{id:c.dono.id},data:{gerenteComercialId:gerente.id}});const quente=await escopoComercialAtual(gerente);const d=await lerComRevogacao(c,gerente,db=>db.query('UPDATE "Usuario" SET "gerenteComercialId"=NULL WHERE id=$1',[c.dono.id]));expect(await escopoComercialAtual(gerente)).toEqual(quente);expect(d).toMatchObject({cadastroPessoa:null,informacoesCadastro:null});});
it("controle API semdispatcher também recusa cobertura revogada duranteawait",async()=>{const c=await preparar();request(false);await prisma.oportunidade.update({where:{id:c.op.id},data:{vendedorDonoId:c.outro.id}});const cobertura=await prisma.coberturaCarteira.create({data:{titularId:c.outro.id,substitutoId:c.dono.id,concedenteId:c.admin.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+600000),motivo:"Cobertura fictícia340"}});expect(await lerComRevogacao(c,c.dono,db=>db.query('UPDATE "CoberturaCarteira" SET "revogadaEm"=now() WHERE id=$1',[cobertura.id]))).toMatchObject({cadastroPessoa:null,informacoesCadastro:null});});
it("controle requestnova e semrevogação publica somente novoDTOautorizado",async()=>{const c=await preparar();await escopoComercialAtual(c.dono);request();expect(await obterContato(c.pessoa.id,c.dono)).toMatchObject({cadastroPessoa:{documento:"FICTICIO-CACHE340",nascimento:"2000-02-29"},informacoesCadastro:{documento:{tipoNome:c.tipo.nome}}});});
