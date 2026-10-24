import {afterAll,beforeEach,expect,it,vi} from "vitest";
vi.hoisted(()=>{const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","3");process.env.DATABASE_URL=url.toString();(globalThis as{prisma?:unknown}).prisma=undefined;});
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:()=>authMock()}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {marcarPerdidoNoInbox} from "./acoes-painel";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
it("pool1: contexto/CAS/ator fresco/núcleo/Evento/aviso ficam na mesma tx e repetir não grava",async()=>{const c=await cenarioPerda328();authMock.mockResolvedValue({user:{id:c.dono.id}});expect(await marcarPerdidoNoInbox(c.a.id,{motivoPerda:"PRECO"},c.op.id)).toEqual({ok:true});expect(await marcarPerdidoNoInbox(c.a.id,{motivoPerda:"PRECO"},c.op.id)).toEqual({ok:true});expect(await prisma.evento.count()).toBe(1);expect(await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).toMatchObject({etapa:"PERDIDO",motivoPerda:"PRECO"});});