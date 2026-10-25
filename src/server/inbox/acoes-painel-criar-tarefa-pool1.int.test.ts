import {afterAll,beforeEach,expect,it,vi} from "vitest";
vi.hoisted(()=>{const u=new URL(process.env.DATABASE_URL!);u.searchParams.set("connection_limit","1");u.searchParams.set("pool_timeout","3");process.env.DATABASE_URL=u.toString();(globalThis as {prisma?:unknown}).prisma=undefined;});
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return{...real,exigirSessao:async()=>{const s=await authMock(),u=await real.carregarUsuarioFresco(s.user.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {dadosModalTarefaNoInbox,criarTarefaNoInbox,editarTarefaNoInbox} from "./acoes-painel";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
it("metadata, criar/concluir/replay e editar reais com pool1 não abrem cliente global dentro da TX",async()=>{
 expect(process.env.DATABASE_URL).toContain("connection_limit=1");const c=await cenarioPerda328();authMock.mockResolvedValue({user:{id:c.dono.id}});await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"America/Sao_Paulo"},update:{fusoInstitucional:"America/Sao_Paulo"}});
 const d=await dadosModalTarefaNoInbox(c.a.id);if(!d.ok||!d.dado)throw new Error(JSON.stringify(d));
 const contexto={contextoEsperado:d.dado.contextoEsperado,fusoEscolaEsperado:d.dado.fusoEscola},i={...contexto,titulo:"Pool1 real331",tipo:"WHATSAPP" as const,dataCivil:null,hora:null,vincularOportunidade:true,jaFeita:true,chaveIdempotencia:"331-pool1-real-tentativa-0001"};
 const r=await criarTarefaNoInbox(c.a.id,i);expect(r.ok).toBe(true);expect(await criarTarefaNoInbox(c.a.id,i)).toEqual(r);
 const aberta=await criarTarefaNoInbox(c.a.id,{...i,jaFeita:false,chaveIdempotencia:"331-pool1-real-tentativa-0002"});if(!aberta.ok||!aberta.dado)throw new Error(JSON.stringify(aberta));
 expect((await dadosModalTarefaNoInbox(c.a.id,aberta.dado.id)).ok).toBe(true);expect(await editarTarefaNoInbox(c.a.id,aberta.dado.id,1,{...contexto,titulo:"Editada",vinculo:"manter",contextoEsperado:d.dado.contextoIdentidadeEsperada})).toEqual({ok:true});expect(await prisma.tarefa.count()).toBe(2);
});
