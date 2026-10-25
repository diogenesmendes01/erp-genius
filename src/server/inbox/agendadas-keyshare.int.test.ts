// Adaptado do oráculo T333: SHA051a47ec9ea2253794f4b7e2403036050f850f8650527ea2fc03788ac2243dd4.
// Original privado preservado no A. Além do bloqueio, exige conclusão e commit ANTES de soltar o holder.
import {afterAll,beforeEach,expect,it,vi} from "vitest";
import {Client} from "pg";
import fs from "node:fs/promises";
import {createHash} from "node:crypto";
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const s=await authMock();const u=await real.carregarUsuarioFresco(s.user.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {cancelarAgendadaNoInbox} from "./acoes-painel";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
it("333 cancela e commita enquanto KEY SHARE externo continua retido, sem upgrade de PK no aviso",async()=>{
 const c=await cenarioPerda328();authMock.mockResolvedValue({user:{id:c.dono.id}});const m=await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.a.id,autorId:c.dono.id,origem:"HUMANO",corpoRenderizado:"Agendada fictícia FK333",agendadaPara:new Date("2026-10-27T12:00Z")}});
 const observer=new Client({connectionString:process.env.DATABASE_URL});await observer.connect();
 let sinal!:(pid:number)=>void,liberar!:()=>void;const pronto=new Promise<number>(r=>sinal=r),libera=new Promise<void>(r=>liberar=r);
 const holder=prisma.$transaction(async tx=>{const [{pid}]=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.a.id} FOR KEY SHARE`;sinal(pid);await libera;},{timeout:20000});
 const holderPid=await pronto;let terminou=false,resultado:Awaited<ReturnType<typeof cancelarAgendadaNoInbox>>|undefined;
 const cancel=cancelarAgendadaNoInbox(c.a.id,m.id).then(r=>{terminou=true;resultado=r;return r;});
 const evidencia:{origem:string;holderPid:number;holderLock:string;concluiuComHolder:boolean;statusComHolder:string|null;eventosComHolder:number|null;observado:unknown;resultadoDepoisLiberar:unknown;helperSha256:string}={origem:"oraculoT333-adaptado-conclusao-antes-da-liberacao",holderPid,holderLock:"FOR KEY SHARE AtendimentoWhatsApp",concluiuComHolder:false,statusComHolder:null,eventosComHolder:null,observado:null,resultadoDepoisLiberar:null,helperSha256:createHash("sha256").update(await fs.readFile("src/server/inbox/agendadas-cancelamento.ts")).digest("hex")};
 try{
  const limite=Date.now()+2500;while(!terminou&&Date.now()<limite){const r=await observer.query('SELECT pid,query,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))',[holderPid]);if(r.rows.length){evidencia.observado=r.rows;break;}await new Promise(r=>setTimeout(r,25));}
  evidencia.concluiuComHolder=terminou;
  if(terminou){evidencia.statusComHolder=(await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:m.id}})).status;evidencia.eventosComHolder=await prisma.evento.count({where:{tipo:"MensagemAgendadaCancelada"}});}
  expect(evidencia.observado,"não deve tentar upgrade de PK sob KEY SHARE alheio").toBeNull();
  expect(evidencia.concluiuComHolder,"resultado deve chegar ANTES de liberar o holder").toBe(true);expect(resultado?.ok).toBe(true);expect(evidencia.statusComHolder).toBe("CANCELADA");expect(evidencia.eventosComHolder).toBe(1);
 }finally{liberar();await Promise.allSettled([holder,cancel]);evidencia.resultadoDepoisLiberar=resultado;await observer.end();await fs.writeFile("output/inbox-333-keyshare-dev-a-"+evidencia.helperSha256.slice(0,12)+"-private.json",JSON.stringify(evidencia,null,2));}
});