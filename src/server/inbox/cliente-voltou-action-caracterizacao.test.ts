import {beforeEach,expect,it,vi} from "vitest";
import type {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({alcance:vi.fn(),contato:vi.fn(),lead:vi.fn(),transaction:vi.fn(),lock:vi.fn(),revalidar:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{contatoWhatsApp:{findUnique:m.contato},oportunidade:{findFirst:m.lead},pessoa:{findFirst:async()=>({id:"p329"})},$transaction:m.transaction}}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidar}));
vi.mock("@/server/_shared",async original=>({...await original<typeof import("@/server/_shared")>(),exigirSessao:async()=>({id:"admin329",nome:"Admin fictício",papeis:["ADMINISTRADOR"]})}));
vi.mock("@/server/whatsapp/consultas",()=>({conversaVisivel:m.alcance,buscarPessoasVinculo:vi.fn(),contatoSoNoAlcance:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",async original=>({...await original<typeof import("@/server/whatsapp/atendimentos")>(),atendimentoVisivel:m.alcance}));
import {vincularLeadRetornoNoInbox} from "@/server/inbox/acoes-cliente-voltou";
const input={contatoId:"ct329",atendimentoId:"a329",alvo:{tipo:"lead" as const,id:"ganha329"}};
let numeroFinalidade:string,selecionado:{id:string;leadId:string|null;contextoChave:string;encerradoEm:null},contato:{id:string;telefoneE164:string;leadId:string|null;alunoId:null;responsavelId:null},eventos:Prisma.EventoCreateInput[],criadas:unknown[],tx:Prisma.TransactionClient;
beforeEach(()=>{
 vi.clearAllMocks();numeroFinalidade="AGENDA";selecionado={id:"a329",leadId:null,contextoChave:"COMERCIAL:::",encerradoEm:null};contato={id:"ct329",telefoneE164:"+5500000329",leadId:null,alunoId:null,responsavelId:null};eventos=[];criadas=[];
 m.alcance.mockResolvedValue({id:"a329",numeroId:"n329",contatoId:"ct329",finalidade:"COMERCIAL",get leadId(){return selecionado.leadId;},alunoId:null,turmaId:null,matriculaId:null,encerradoEm:null,responsavelId:null,conversaId:"conversa329",conversa:{grupoId:null},get numero(){return{finalidade:numeroFinalidade,ativo:true};},get contato(){return{...contato,pessoaId:"p329"};}});m.contato.mockImplementation(async()=>({...contato}));m.lead.mockResolvedValue({id:"ganha329",pessoaId:"p329"});
 tx={
  $queryRaw:m.lock,usuario:{findUnique:async()=>({nome:"Admin fictício",papeis:["ADMINISTRADOR"],permissoes:[],ativo:true})},oportunidade:{findFirst:m.lead},pessoa:{findFirst:async()=>({id:"p329"})},
  contatoWhatsApp:{findUnique:async()=>({...contato,pessoaId:"p329"}),updateMany:async({where,data}:{where:{leadId:string|null};data:{leadId:string}})=>{if(contato.leadId!==where.leadId)return{count:0};Object.assign(contato,data);return{count:1};},update:async({data}:{data:{leadId?:string}})=>{Object.assign(contato,data);return{...contato};}},
  conversaWhatsApp:{upsert:async()=>({id:"conversa329"}),findUnique:async()=>({grupoId:null,numero:{finalidade:numeroFinalidade,donoId:"admin329"}})},
  atendimentoWhatsApp:{findMany:async()=>[selecionado],updateMany:async({data}:{data:{leadId:string}})=>{selecionado.leadId=data.leadId;return{count:1};},findUnique:async()=>selecionado,findUniqueOrThrow:async()=>selecionado,upsert:async(args:{create:object})=>{criadas.push(args);return{id:"outro329",...args.create};}},
  evento:{create:async({data}:{data:Prisma.EventoCreateInput})=>{eventos.push(data);return data;}},
 } as unknown as Prisma.TransactionClient;
 m.transaction.mockImplementation(async(callback:(db:Prisma.TransactionClient)=>Promise<unknown>)=>callback(tx));
});
it("ACTION institucional recusa sem alterar contato, criar contexto ou Evento",async()=>{const r=await vincularLeadRetornoNoInbox(input);expect(r.ok).toBe(false);expect(contato.leadId).toBeNull();expect(selecionado.leadId).toBeNull();expect(criadas).toHaveLength(0);expect(eventos).toHaveLength(0);});it("controle ACTION VENDAS devolve ok com o selecionado preenchido",async()=>{numeroFinalidade="VENDAS";expect((await vincularLeadRetornoNoInbox(input)).ok).toBe(true);expect(selecionado.leadId).toBe("ganha329");expect(criadas).toHaveLength(0);expect(eventos).toHaveLength(1);});
it("caracterização ACTION repetida pode registrar dois Eventos; não é idempotente",async()=>{numeroFinalidade="VENDAS";await vincularLeadRetornoNoInbox(input);await vincularLeadRetornoNoInbox(input);expect(eventos).toHaveLength(2);expect(selecionado.leadId).toBe("ganha329");});
it("ACTION recusa deriva do contato antes da TX sem sobrescrever outro vínculo",async()=>{numeroFinalidade="VENDAS";m.transaction.mockImplementation(async(callback:(db:Prisma.TransactionClient)=>Promise<unknown>)=>{contato.leadId="outro-concorrente";return callback(tx);});expect((await vincularLeadRetornoNoInbox(input)).ok).toBe(false);expect(contato.leadId).toBe("outro-concorrente");expect(eventos).toHaveLength(0);});