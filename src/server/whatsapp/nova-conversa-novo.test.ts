import { Papel, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroAutenticacao, ErroRegra } from "@/server/_shared/sessao";
const m = vi.hoisted(() => ({ leitura: vi.fn(), pessoa: vi.fn(), codigo: vi.fn(), lead: vi.fn(), evento: vi.fn(), repeticao: vi.fn(), visivel: vi.fn(), trilha: [] as string[], ator: { ativo: true, nome: "Ator fictício", papeis: ["VENDEDOR"] as string[], permissoes: [] as string[] } }));
vi.mock("./nova-conversa-leitura", () => ({ lerCadastroNovaConversaTx: m.leitura }));
vi.mock("./nova-conversa-pessoa", () => ({ criarPessoaDoContatoNovoTx: m.pessoa }));
vi.mock("@/lib/codigo", () => ({ gerarCodigo: m.codigo }));
vi.mock("@/server/comercial/criar-registro-lead-tx", () => ({ criarRegistroLeadTx: m.lead }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: m.evento }));
vi.mock("@/server/_shared/idempotencia", async original => ({ ...await original<typeof import("@/server/_shared/idempotencia")>(), repeticaoIdempotente: m.repeticao }));
vi.mock("./atendimentos", () => ({ atendimentoVisivel: m.visivel }));
import { criarRamoNovoConversaTx } from "./nova-conversa-novo";
const entrada = { autorId: "ator", ownerId: "ator", numeroId: "numero", telefoneE164: "+50688889999", chaveIdempotencia: "tentativa-ficticia-372" };
const cadastro = () => ({ oportunidadesAutorizadas: [], pessoaIdentificada: false, alunoIdentificado: false, responsavelIdentificado: false, contatoIdentificado: false, oportunidadeOcultaIdentificada: false });
const db = { usuario: { findUnique: vi.fn(), findFirst: vi.fn() }, numeroWhatsApp: { findUnique: vi.fn() }, contatoWhatsApp: { create: vi.fn(), updateMany: vi.fn() }, conversaWhatsApp: { create: vi.fn(), upsert: vi.fn() }, oportunidade: { findUnique: vi.fn(), findFirst: vi.fn() }, atendimentoWhatsApp: { create: vi.fn(), update: vi.fn(), upsert: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn() };
const tx = db as unknown as Prisma.TransactionClient;
beforeEach(() => {
 for(const f of [m.leitura,m.pessoa,m.codigo,m.lead,m.evento,m.repeticao,m.visivel,db.oportunidade.findUnique,db.oportunidade.findFirst,db.usuario.findUnique,db.usuario.findFirst,db.numeroWhatsApp.findUnique,db.contatoWhatsApp.create,db.contatoWhatsApp.updateMany,db.conversaWhatsApp.create,db.conversaWhatsApp.upsert,db.atendimentoWhatsApp.create,db.atendimentoWhatsApp.update,db.atendimentoWhatsApp.upsert,db.$queryRaw,db.$executeRaw]) f.mockReset();
 m.trilha.length=0; m.ator={ativo:true,nome:"Ator fictício",papeis:[Papel.VENDEDOR],permissoes:[]};
 db.usuario.findUnique.mockImplementation(async()=>({...m.ator})); db.usuario.findFirst.mockResolvedValue({id:"ator",gerenteComercialId:null}); db.numeroWhatsApp.findUnique.mockResolvedValue({id:"numero",ativo:true,finalidade:"VENDAS",donoId:"ator"});
 db.oportunidade.findUnique.mockResolvedValue({id:"lead",telefoneE164:entrada.telefoneE164,pessoaId:"pessoa",vendedorDonoId:"ator"});db.oportunidade.findFirst.mockResolvedValue({id:"lead",telefoneE164:entrada.telefoneE164,pessoaId:"pessoa",vendedorDonoId:"ator"});
 m.visivel.mockResolvedValue({id:"atendimento",finalidade:"COMERCIAL",leadId:"lead",responsavelId:"ator",encerradoEm:null,conversaId:"conversa",numeroId:"numero",contatoId:"contato",numero:{id:"numero",ativo:true,finalidade:"VENDAS",donoId:"ator"},contato:{id:"contato",telefoneE164:entrada.telefoneE164,pessoaId:"pessoa",leadId:"lead",alunoId:null,responsavelId:null},conversa:{id:"conversa",numeroId:"numero",contatoId:"contato",grupoId:null}});
 m.repeticao.mockImplementation(async()=>{m.trilha.push("idem");return null;}); m.leitura.mockResolvedValue(cadastro());
 db.contatoWhatsApp.create.mockImplementation(async()=>{m.trilha.push("contato");return{id:"contato",telefoneE164:entrada.telefoneE164,pessoaId:null,leadId:null,alunoId:null,responsavelId:null};});
 db.$queryRaw.mockImplementation(async()=>{m.trilha.push("tryPhone");return[{adquirido:true}];});
 m.pessoa.mockImplementation(async()=>{m.trilha.push("pessoa");return{pessoaId:"pessoa"};}); m.codigo.mockImplementation(async()=>{m.trilha.push("codigo");return"L-000001";}); m.lead.mockImplementation(async()=>{m.trilha.push("lead");return"lead";});
 db.contatoWhatsApp.updateMany.mockImplementation(async()=>{m.trilha.push("vinculoLead");return{count:1};}); db.conversaWhatsApp.create.mockImplementation(async()=>{m.trilha.push("conversa");return{id:"conversa",numeroId:"numero",contatoId:"contato",grupoId:null};});
 db.atendimentoWhatsApp.create.mockImplementation(async()=>{m.trilha.push("atendimento");return{id:"atendimento",finalidade:"COMERCIAL",leadId:"lead",alunoId:null,turmaId:null,matriculaId:null,responsavelId:"ator",contextoChave:"COMERCIAL:LINHA",status:"EM_ATENDIMENTO",encerradoEm:null};});
 m.evento.mockImplementation(async(_tx:unknown,e:{tipo:string})=>{m.trilha.push(`evento:${e.tipo}`);return{id:"evento"};}); db.$executeRaw.mockImplementation(async()=>{m.trilha.push("constraints");return 0;});
});
describe("ramo NOVO interno372, contrato antes de produção",()=>{
 it("ordem INSERT→tryPhone→Pessoa→codigoTX/Lead→contextos próprios→eventos→constraints",async()=>{
  expect(await criarRamoNovoConversaTx(tx,entrada)).toEqual({atendimentoId:"atendimento",leadId:"lead",criado:true});
  expect(m.trilha).toEqual(["idem","contato","tryPhone","pessoa","codigo","lead","vinculoLead","conversa","atendimento","evento:AtendimentoInstitucionalAberto","evento:ConversaIniciadaPorNumero","constraints"]);
  expect(m.codigo).toHaveBeenCalledExactlyOnceWith("lead",tx); expect(db.conversaWhatsApp.create).toHaveBeenCalledWith({data:{numeroId:"numero",contatoId:"contato"}});
  expect(db.atendimentoWhatsApp.create).toHaveBeenCalledWith({data:expect.objectContaining({conversaId:"conversa",contextoChave:"COMERCIAL:LINHA",finalidade:"COMERCIAL",leadId:"lead",responsavelId:"ator",status:"EM_ATENDIMENTO"})});
  expect(db.conversaWhatsApp.upsert).not.toHaveBeenCalled();expect(db.atendimentoWhatsApp.update).not.toHaveBeenCalled();expect(db.atendimentoWhatsApp.upsert).not.toHaveBeenCalled();
 });
 it("Phone ocupado tenta uma vez e recusa para rollback antes de Pessoa/código",async()=>{
  db.$queryRaw.mockResolvedValue([{adquirido:false}]);await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);
  expect(db.$queryRaw).toHaveBeenCalledTimes(1);expect(m.pessoa).not.toHaveBeenCalled();expect(m.codigo).not.toHaveBeenCalled();
 });
 it("UNIQUEtelefone esperado recusa sem adotar ID vencedor ou continuar SQL",async()=>{
  db.contatoWhatsApp.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Conflito fictício",{code:"P2002",clientVersion:"teste",meta:{modelName:"ContatoWhatsApp",target:["telefoneE164"]}}));
  await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);expect(db.contatoWhatsApp.create).toHaveBeenCalledTimes(1);expect(db.$queryRaw).not.toHaveBeenCalled();expect(m.pessoa).not.toHaveBeenCalled();
 });
 it("cadastro acadêmico identificado impede NOVO sem tocar row externa",async()=>{
  m.leitura.mockResolvedValue({...cadastro(),alunoIdentificado:true});await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);expect(db.contatoWhatsApp.create).not.toHaveBeenCalled();
 });
 it("oportunidade existente não é implementada por este ramo nem retargetada",async()=>{
  m.leitura.mockResolvedValue({...cadastro(),oportunidadesAutorizadas:[{id:"existente",telefoneE164:entrada.telefoneE164}]});await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);expect(db.contatoWhatsApp.create).not.toHaveBeenCalled();expect(m.lead).not.toHaveBeenCalled();
 });
 it("cadastro que aparece após esperaPhone recusa sem novaPessoa/Lead",async()=>{
  m.leitura.mockResolvedValueOnce(cadastro()).mockResolvedValue({...cadastro(),responsavelIdentificado:true});await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);expect(m.pessoa).not.toHaveBeenCalled();expect(m.lead).not.toHaveBeenCalled();
 });
 it("revogação enquanto SETCONSTRAINTS espera é relida antes do retorno",async()=>{
  db.$executeRaw.mockImplementation(async()=>{m.ator.ativo=false;return 0;});await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroAutenticacao);expect(db.$executeRaw).toHaveBeenCalledTimes(1);
 });
 it("owner tem que satisfazer VENDEDORespecífico mesmo com atorAdmin",async()=>{
  m.ator.papeis=[Papel.ADMINISTRADOR];db.usuario.findFirst.mockResolvedValue(null);await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);
  expect(db.usuario.findFirst).toHaveBeenCalledWith({where:{id:"ator",ativo:true,papeis:{has:Papel.VENDEDOR}},select:{id:true,gerenteComercialId:true}});expect(db.contatoWhatsApp.create).not.toHaveBeenCalled();
 });
 it("CAS próprio perdido depoisLead propaga erro e não cria conversa",async()=>{
  db.contatoWhatsApp.updateMany.mockResolvedValue({count:0});await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);expect(db.conversaWhatsApp.create).not.toHaveBeenCalled();
 });
 it("infra e UNIQUE não esperado não viram retry ou sucesso",async()=>{
  for(const erro of [new Prisma.PrismaClientKnownRequestError("Deadlock fictício",{code:"P2010",clientVersion:"teste",meta:{code:"40P01"}}),new Prisma.PrismaClientKnownRequestError("Outraunique",{code:"P2002",clientVersion:"teste",meta:{modelName:"ContatoWhatsApp",target:["waId"]}})]){
   db.contatoWhatsApp.create.mockRejectedValueOnce(erro);await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBe(erro);
  }
  expect(db.contatoWhatsApp.create).toHaveBeenCalledTimes(2);expect(m.pessoa).not.toHaveBeenCalled();
 });
});

it("replay próprio só retorna resultado fresco sem criar ou registrar de novo",async()=>{
 m.repeticao.mockResolvedValue({agregadoId:"atendimento",autorId:"ator",payload:{leadId:"lead",pessoaId:"pessoa",contatoId:"contato",conversaId:"conversa",numeroId:"numero",ownerId:"ator",criado:true}});
 m.leitura.mockResolvedValue({...cadastro(),oportunidadesAutorizadas:[{id:"lead",telefoneE164:entrada.telefoneE164}]});
 expect(await criarRamoNovoConversaTx(tx,entrada)).toEqual({atendimentoId:"atendimento",leadId:"lead",criado:true});
 expect(db.contatoWhatsApp.create).not.toHaveBeenCalled();expect(m.codigo).not.toHaveBeenCalled();expect(m.evento).not.toHaveBeenCalled();
});
it("replay com binding divergente não retorna outro alvo ou reabre conversa",async()=>{
 m.repeticao.mockResolvedValue({agregadoId:"atendimento",autorId:"ator",payload:{leadId:"lead",pessoaId:"pessoa",contatoId:"contato",conversaId:"conversa",numeroId:"numero",ownerId:"ator",criado:true}});
 m.visivel.mockResolvedValue(null);await expect(criarRamoNovoConversaTx(tx,entrada)).rejects.toBeInstanceOf(ErroRegra);
 expect(db.contatoWhatsApp.create).not.toHaveBeenCalled();expect(db.atendimentoWhatsApp.create).not.toHaveBeenCalled();
});
