import {afterAll,beforeEach,expect,it,vi} from "vitest";
const {authMock}=vi.hoisted(()=>({authMock:vi.fn()}));
vi.mock("@/server/_shared/sessao",async original=>{const real=await original<typeof import("@/server/_shared/sessao")>();return {...real,exigirSessao:async()=>{const s=await authMock(),u=await real.carregarUsuarioFresco(s.user.id);if(!u)throw new real.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioPerda328} from "@/test/inbox-perda";
import {dadosModalTarefaNoInbox,editarTarefaNoInbox} from "./acoes-painel";
beforeEach(()=>truncarBanco());afterAll(()=>prisma.$disconnect());
async function cenario(dataCivil:string|null){const c=await cenarioPerda328();authMock.mockResolvedValue({user:{id:c.dono.id}});await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"America/Sao_Paulo"},update:{fusoInstitucional:"America/Sao_Paulo"}});const t=await prisma.tarefa.create({data:{titulo:"Nova agenda331",tipo:"WHATSAPP",setor:"COMERCIAL",responsavelId:c.dono.id,criadorId:c.dono.id,atendimentoId:c.a.id,fusoOrigem:"America/New_York",dataCivil,duracaoMin:60}});const d=await dadosModalTarefaNoInbox(c.a.id,t.id);if(!d.ok||!d.dado)throw new Error(JSON.stringify(d));return {...c,t,contexto:{vinculo:"manter" as const,contextoEsperado:d.dado.contextoIdentidadeEsperada,fusoEscolaEsperado:d.dado.fusoEscola}};}
it.each([{dataCivil:null,lembrete:30 as const},{dataCivil:"2026-10-31",lembrete:30 as const},{dataCivil:null,lembrete:null},{dataCivil:"2026-10-31",lembrete:null}])("wrapper real atribui data/hora/lembrete novo a $dataCivil, lembrete=$lembrete",async caso=>{
 const c=await cenario(caso.dataCivil),pedido={...c.contexto,dataCivil:"2026-11-01",hora:"09:00",lembreteAntecedenciaMin:caso.lembrete};
 expect(await editarTarefaNoInbox(c.a.id,c.t.id,1,pedido)).toEqual({ok:true});
 expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({dataCivil:"2026-11-01",inicioEm:new Date("2026-11-01T12:00:00Z"),lembrarEm:caso.lembrete===null?null:new Date("2026-11-01T11:30:00Z"),lembreteAntecedenciaMin:caso.lembrete,fusoOrigem:"America/New_York",duracaoMin:60,versao:2});
 expect(await prisma.evento.count({where:{tipo:"TarefaEditada",agregadoId:c.t.id}})).toBe(1);
});
it("wrapper recusa lembrete sem horário e preserva tarefa sem Evento",async()=>{const c=await cenario(null);expect((await editarTarefaNoInbox(c.a.id,c.t.id,1,{...c.contexto,dataCivil:"2026-11-01",hora:null,lembreteAntecedenciaMin:30})).ok).toBe(false);expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({dataCivil:null,inicioEm:null,lembrarEm:null,versao:1});expect(await prisma.evento.count()).toBe(0);});
it("agenda efetiva mantém dobra DST e lembrete disparado quando não muda",async()=>{const c=await cenario("2026-11-01"),inicioEm=new Date("2026-11-01T05:30:00Z"),lembrarEm=new Date("2026-11-01T05:00:00Z"),disparado=new Date("2026-11-01T05:01:00Z");await prisma.tarefa.update({where:{id:c.t.id},data:{inicioEm,lembrarEm,lembreteAntecedenciaMin:30,lembreteDisparadoEm:disparado}});expect(await editarTarefaNoInbox(c.a.id,c.t.id,1,{...c.contexto,dataCivil:"2026-11-01",hora:"02:30",lembreteAntecedenciaMin:30})).toEqual({ok:true});expect(await prisma.tarefa.findUniqueOrThrow({where:{id:c.t.id}})).toMatchObject({inicioEm,lembrarEm,lembreteDisparadoEm:disparado,fusoOrigem:"America/New_York",duracaoMin:60,versao:2});});
