import { beforeEach,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({atendimento:vi.fn(),veLead:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:m.atendimento}));
vi.mock("@/server/whatsapp/visibilidade-lead",()=>({podeVerLeadNaThread:m.veLead}));
const autor=()=>({id:"u",nome:"Usuário fresco",papeis:["VENDEDOR"],permissoes:[],ativo:true});
const atendimento=()=>({id:"a",conversaId:"c",finalidade:"COMERCIAL",leadId:"l",alunoId:null,matriculaId:null,turmaId:null,conversa:{numeroId:"n",contatoId:"ct",grupoId:null},contato:{leadId:"l",pessoaId:null}});
const op=()=>({id:"l",pessoaId:null,etapa:"NOVO",interesse:null,objetivo:"Conversação",urgencia:null,orcamento:null,objecao:null,proximaAcao:null});
const db={usuario:{findUnique:vi.fn()},oportunidade:{findUnique:vi.fn()}};
async function contexto(){const p=await import("./contexto-autorizado").catch(()=>({}));expect(p).toHaveProperty("contextoInsightAutorizado");return(p as {contextoInsightAutorizado:(db:unknown,ator:string,id:string)=>Promise<unknown>}).contextoInsightAutorizado(db,"u","a");}
beforeEach(()=>{vi.clearAllMocks();db.usuario.findUnique.mockResolvedValue(autor());db.oportunidade.findUnique.mockResolvedValue(op());m.atendimento.mockResolvedValue(atendimento());m.veLead.mockResolvedValue(true);});
it("recarrega ator no DB recebido e passa a mesma conexão aos dois escopos",async()=>{expect(await contexto()).toMatchObject({autor:autor(),campos:{objetivo:"Conversação"}});expect(m.atendimento).toHaveBeenCalledWith(autor(),"a",false,db);expect(m.veLead).toHaveBeenCalledWith(autor(),"a","l",expect.any(Number),db);expect(db.usuario.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{id:"u"}}));});
it("ator revogado não consulta atendimento nem dados do lead",async()=>{db.usuario.findUnique.mockResolvedValue({...autor(),ativo:false});expect(await contexto()).toBeNull();expect(m.atendimento).not.toHaveBeenCalled();expect(db.oportunidade.findUnique).not.toHaveBeenCalled();});
it.each([null,{...atendimento(),finalidade:"FINANCEIRO"},{...atendimento(),leadId:null}])("fora da audiência comercial retorna null %j",async(a)=>{m.atendimento.mockResolvedValue(a);expect(await contexto()).toBeNull();expect(m.veLead).not.toHaveBeenCalled();});
it("lead oculto não é consultado para completar resumo",async()=>{m.veLead.mockResolvedValue(false);expect(await contexto()).toBeNull();expect(db.oportunidade.findUnique).not.toHaveBeenCalled();});
it("somente pessoas explícitas diferentes recusam; null não é preenchido",async()=>{m.atendimento.mockResolvedValue({...atendimento(),contato:{leadId:"l",pessoaId:"p"}});expect(await contexto()).toMatchObject({vinculo:{pessoaContatoId:"p",pessoaLeadId:null}});db.oportunidade.findUnique.mockResolvedValue({...op(),pessoaId:"outra"});expect(await contexto()).toBeNull();});
it("operação de status usa audiência atual mesmo com Pessoa incompatível, sem liberar geração",async()=>{m.atendimento.mockResolvedValue({...atendimento(),contato:{leadId:"l",pessoaId:"p"}});db.oportunidade.findUnique.mockResolvedValue({...op(),pessoaId:"outra"});const p=await import("./contexto-autorizado");expect(p).toHaveProperty("contextoOperacionalInsight");const c=await(p as unknown as {contextoOperacionalInsight:(db:unknown,u:string,a:string)=>Promise<unknown>}).contextoOperacionalInsight(db,"u","a");expect(c).toMatchObject({pessoasCompativeis:false,vinculo:{pessoaContatoId:"p",pessoaLeadId:"outra"}});expect(await contexto()).toBeNull();});

it("rowfresh exclusivamenteALUNO não atravessa convite/veLead e não lê dados",async()=>{
  db.usuario.findUnique.mockResolvedValue({...autor(),papeis:["ALUNO"]});
  expect(await contexto()).toBeNull();const p=await import("./contexto-autorizado");expect(await(p as unknown as {contextoOperacionalInsight:(db:unknown,u:string,a:string)=>Promise<unknown>}).contextoOperacionalInsight(db,"u","a")).toBeNull();expect(m.atendimento).not.toHaveBeenCalled();expect(m.veLead).not.toHaveBeenCalled();expect(db.oportunidade.findUnique).not.toHaveBeenCalled();
});
it.each([{papeis:[]},{papeis:["ALUNO","VENDEDOR"]}])("apenasPortal não inventa rejeição genérica de papéis%j",async({papeis})=>{
  db.usuario.findUnique.mockResolvedValue({...autor(),papeis});expect(await contexto()).toMatchObject({autor:{papeis}});expect(m.veLead).toHaveBeenCalled();
});
