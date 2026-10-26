import{beforeEach,expect,it,vi}from"vitest";
import{Papel}from"@prisma/client";
import type{Db}from"./escopo";
const m=vi.hoisted(()=>({individual:vi.fn(),visivel:vi.fn()}));
vi.mock("./atendimentos",()=>({atendimentoVisivel:m.visivel}));
import{contextoAssumirAria}from"./assumir-aria";
const db={atendimentoWhatsApp:{findFirst:m.individual}};
const a={id:"at",responsavelId:"u",encerradoEm:null,numero:{ativo:true},contato:{optOutEm:null}};
beforeEach(()=>{vi.resetAllMocks();m.individual.mockResolvedValue({id:"at"});m.visivel.mockResolvedValue(a);});
it("357 portal exclusivo é recusado ANTES de banco e do atalho de responsável",async()=>{
 expect(await contextoAssumirAria(db as unknown as Db,{id:"u",nome:"Portal",papeis:[Papel.ALUNO]},"at")).toBeNull();
 expect(m.individual).not.toHaveBeenCalled();expect(m.visivel).not.toHaveBeenCalled();
});
const controles:{nome:string;papeis:Papel[]}[]=[{nome:"sem papéis",papeis:[]},{nome:"ALUNO+VENDEDOR",papeis:[Papel.ALUNO,Papel.VENDEDOR]},{nome:"VENDEDOR",papeis:[Papel.VENDEDOR]},{nome:"PROFESSOR convidado",papeis:[Papel.PROFESSOR]}];
it.each(controles)("357 preserva política canônica de apenasPortal: $nome",async({papeis})=>{
 expect(await contextoAssumirAria(db as unknown as Db,{id:"u",nome:"ERP",papeis},"at")).toBe(a);
 expect(m.individual).toHaveBeenCalledOnce();expect(m.visivel).toHaveBeenCalledExactlyOnceWith({id:"u",nome:"ERP",papeis},"at",true,db);
});
it("357 ERP não ganha contexto de outro responsável",async()=>{m.visivel.mockResolvedValue({...a,responsavelId:"outro"});expect(await contextoAssumirAria(db as unknown as Db,{id:"u",nome:"ERP",papeis:[Papel.VENDEDOR]},"at")).toBeNull();});
it("357 grupo/inexistente continua recusado para ERP",async()=>{m.individual.mockResolvedValue(null);expect(await contextoAssumirAria(db as unknown as Db,{id:"u",nome:"ERP",papeis:[Papel.VENDEDOR]},"at")).toBeNull();expect(m.visivel).not.toHaveBeenCalled();});
