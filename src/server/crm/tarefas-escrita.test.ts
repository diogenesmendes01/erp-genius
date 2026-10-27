import { expect, it, vi } from "vitest";
import { Papel, type Prisma, type Tarefa } from "@prisma/client";
import { criarTarefaTx, editarTarefaTx } from "./tarefas-escrita";
import type { UsuarioSessao } from "@/server/_shared/sessao";
vi.mock("@/server/_shared/evento",()=>({registrarEvento:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:vi.fn(async()=>({id:"at"}))}));
vi.mock("@/server/_shared/escopo-comercial",()=>({escopoComercialAtual:vi.fn(async()=>({}))}));
const autor={id:"u",nome:"Pessoa",papeis:[Papel.VENDEDOR],permissoes:[]} satisfies UsuarioSessao;
it("núcleo de criação conserva defaults e todos os vínculos recebidos pelo CRM",async()=>{
 const create=vi.fn(async({data}:{data:Prisma.TarefaUncheckedCreateInput})=>({id:"t",...data}));
 const tx={tarefa:{create},oportunidade:{findFirst:vi.fn(async()=>({id:"l"}))},pessoa:{findUnique:vi.fn(async()=>({id:"p"}))},aluno:{findUnique:vi.fn(async()=>({id:"a"}))},matricula:{findUnique:vi.fn(async()=>({id:"m"}))}} as unknown as Prisma.TransactionClient;
 const t=await criarTarefaTx(tx,autor,{titulo:"Título",tipo:"WHATSAPP",leadId:"l",pessoaId:"p",alunoId:"a",matriculaId:"m",atendimentoId:"at"},"America/Sao_Paulo",null);
 expect(t).toMatchObject({id:"t",titulo:"Título",duracaoMin:30,prioridade:"NORMAL",responsavelId:"u",setor:"COMERCIAL",fusoOrigem:"America/Sao_Paulo",leadId:"l",pessoaId:"p",alunoId:"a",matriculaId:"m",atendimentoId:"at"});
});
it("edição só de título não reinterpreta dobra DST nem duração/vínculos",async()=>{
 const updateMany=vi.fn(async()=>({count:1}));
 const tx={tarefa:{updateMany}} as unknown as Prisma.TransactionClient;
 const t={id:"t",titulo:"Antes",status:"ABERTA",versao:4,inicioEm:new Date("2026-11-01T05:30:00Z"),fusoOrigem:"America/New_York",duracaoMin:60,leadId:"l",pessoaId:"p"} as unknown as Tarefa;
 await editarTarefaTx(tx,autor,t,4,{titulo:"Depois"});
 expect(updateMany).toHaveBeenCalledWith({where:{id:"t",versao:4,status:"ABERTA"},data:{titulo:"Depois",versao:{increment:1}}});
});

it("edição interna aplica vínculo nullable e interseção CAS sem alterar entrada pública",async()=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany},pessoa:{findUnique:vi.fn(async()=>({id:"p"}))}} as unknown as Prisma.TransactionClient;
 const t={id:"t",status:"ABERTA",versao:1,leadId:"l",pessoaId:"p"} as unknown as Tarefa;
 await editarTarefaTx(tx,autor,t,1,{}, {filtro:{atendimentoId:"at"},vinculo:{leadId:null,pessoaId:"p"}});
 expect(updateMany).toHaveBeenCalledWith({where:{AND:[{id:"t",versao:1,status:"ABERTA"},{atendimentoId:"at"}]},data:{leadId:null,pessoaId:"p",versao:{increment:1}}});
});
it("agenda resolvida mantém instante autoridade e só rearma lembrete realmente novo",async()=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany}} as unknown as Prisma.TransactionClient;
 const inicioEm=new Date("2026-11-01T05:30:00Z"),lembrarEm=new Date("2026-11-01T05:00:00Z");
 const t={id:"t",status:"ABERTA",versao:1,dataCivil:"2026-11-01",inicioEm,lembrarEm,lembreteAntecedenciaMin:30,fusoOrigem:"America/New_York"} as unknown as Tarefa;
 await editarTarefaTx(tx,autor,t,1,{}, {agendamento:{dataCivil:t.dataCivil,inicioEm,lembrarEm,lembreteAntecedenciaMin:30}});
 expect(updateMany).toHaveBeenCalledWith({where:{id:"t",versao:1,status:"ABERTA"},data:{versao:{increment:1}}});
});
it("vínculo interno ainda exige validação comercial real do núcleo",async()=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany},oportunidade:{findFirst:vi.fn(async()=>null)}} as unknown as Prisma.TransactionClient;
 const t={id:"t",status:"ABERTA",versao:1,leadId:null,pessoaId:null} as unknown as Tarefa;
 await expect(editarTarefaTx(tx,autor,t,1,{}, {vinculo:{leadId:"fora",pessoaId:null}})).rejects.toThrow("fora da sua carteira");expect(updateMany).not.toHaveBeenCalled();
});

it.each([null,"2026-11-01"])("TESTER agenda resolvida adiciona horário/lembrete a tarefa sem horário anterior data=%s",async dataCivil=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany}} as unknown as Prisma.TransactionClient;
 const t={id:"t",status:"ABERTA",versao:1,dataCivil,inicioEm:null,lembrarEm:null,lembreteAntecedenciaMin:null,fusoOrigem:"America/New_York"} as unknown as Tarefa;
 const inicioEm=new Date("2026-11-01T15:00:00Z"),lembrarEm=new Date("2026-11-01T14:30:00Z");
 await editarTarefaTx(tx,autor,t,1,{}, {agendamento:{dataCivil:"2026-11-01",inicioEm,lembrarEm,lembreteAntecedenciaMin:30}});
 expect(updateMany).toHaveBeenCalledWith({where:{id:"t",versao:1,status:"ABERTA"},data:{...(dataCivil?{}:{dataCivil:"2026-11-01"}),inicioEm,lembrarEm,lembreteAntecedenciaMin:30,lembreteDisparadoEm:null,versao:{increment:1}}});
});

it.each([null,"2026-11-01"])("agenda efetiva sem horário não aceita lembrete apesar do horário antigo: %s",async dataCivil=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany}} as unknown as Prisma.TransactionClient;
 const t={id:"t",status:"ABERTA",versao:1,dataCivil:"2026-10-31",inicioEm:new Date("2026-10-31T15:00:00Z"),fusoOrigem:"America/New_York"} as unknown as Tarefa;
 await expect(editarTarefaTx(tx,autor,t,1,{}, {agendamento:{dataCivil,inicioEm:null,lembrarEm:null,lembreteAntecedenciaMin:30}})).rejects.toThrow("O lembrete exige data e horário.");expect(updateMany).not.toHaveBeenCalled();
});
it("sem opção interna conserva validação legada de lembrete sem horário",async()=>{
 const updateMany=vi.fn(async()=>({count:1}));const tx={tarefa:{updateMany}} as unknown as Prisma.TransactionClient;
 const t={id:"t",status:"ABERTA",versao:1,dataCivil:"2026-10-31",inicioEm:new Date("2026-10-31T15:00:00Z"),fusoOrigem:"America/New_York"} as unknown as Tarefa;
 await expect(editarTarefaTx(tx,autor,t,1,{dataCivil:null,hora:null,lembreteAntecedenciaMin:30})).rejects.toThrow("O lembrete exige data e horário.");expect(updateMany).not.toHaveBeenCalled();
});
