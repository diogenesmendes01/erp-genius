import {afterAll,beforeEach,expect,it,vi} from "vitest";
vi.hoisted(()=>{const u=new URL(process.env.DATABASE_URL!);u.searchParams.set("connection_limit","1");u.searchParams.set("pool_timeout","3");process.env.DATABASE_URL=u.toString();(globalThis as {prisma?:unknown}).prisma=undefined;});
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const r=await original<typeof import("@/server/_shared/sessao")>();return{...r,exigirSessao:async()=>{const u=await r.carregarUsuarioFresco(await authMock());if(!u)throw new r.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {definirPrevisaoNoInbox} from "./acoes-previsao";
import {editarLead} from "@/server/comercial/acoes";
import {carregarOportunidadesPainel} from "./painel-oportunidades";
beforeEach(truncarBanco);afterAll(()=>prisma.$disconnect());
it("writer Inbox, edição CRM e leitor usam pool1 sem cliente global dentro da TX",async()=>{
 expect(process.env.DATABASE_URL).toContain('connection_limit=1');const c=await cenarioPerda328();authMock.mockResolvedValue(c.dono.id);
 expect((await definirPrevisaoNoInbox(c.a.id,{oportunidadeIdEsperada:c.op.id,esperado:{probabilidadePct:null,previsaoFechamento:null},alteracoes:{probabilidadePct:0}})).ok).toBe(true);
 expect((await editarLead(c.op.id,{nome:c.op.nome,previsaoFechamento:'2026-09-06'})).ok).toBe(true);
 expect((await carregarOportunidadesPainel(c.dono,c.a.id))?.atual).toMatchObject({probabilidadePct:0,previsaoFechamento:'2026-09-06',podeEditarPrevisao:true});
});