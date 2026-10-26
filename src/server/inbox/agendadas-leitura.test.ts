import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
import type {Db} from "@/server/whatsapp/escopo";
const m=vi.hoisted(()=>({visivel:vi.fn(),estado:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:m.visivel}));
vi.mock("@/server/whatsapp/enfileirar-inbox",()=>({lerContextoAtualInbox:m.estado}));
import {lerAgendadasDoAtendimento} from "./agendadas-leitura";
const ator=()=>({id:"u",nome:"Pessoa fictícia",papeis:[Papel.VENDEDOR],permissoes:[],ativo:true});
const atendimento=()=>({id:"a",responsavelId:"u",encerradoEm:null,numeroId:"numero",contatoId:"contato",leadId:"lead",iaPausadaEm:new Date(),finalidade:"COMERCIAL",conversaId:"conversa",conversa:{id:"conversa",grupoId:null,numero:{donoId:"u",ativo:true},contato:{id:"contato",pessoaId:"pessoa",leadId:"lead",optOutEm:null}}});
const linha=(id="m")=>({id,atendimentoId:"a",corpoRenderizado:"Texto fictício",agendadaPara:new Date("2030-01-02T15:00:00Z"),status:"PENDENTE",tipo:"TEXTO",midiaPath:null,conteudo:null,origem:"HUMANO",autorId:"u",passo:null,passoComercial:null,autor:{nome:"Pessoa fictícia",gerenteComercialId:null}});
function fixture(){const usuario={findUnique:vi.fn().mockResolvedValue(ator())},intencaoMensagem={findMany:vi.fn<(query:unknown)=>Promise<unknown[]>>().mockResolvedValue([linha()])};Object.assign(usuario,{findMany:vi.fn().mockImplementation(async()=>[await usuario.findUnique()])});const dados={usuario,intencaoMensagem};
 // Double de fronteira Db deliberadamente parcial: só as portas deste leitor; não simula SQL/ACL nativos.
 return {...dados,db:dados as unknown as Db};}
beforeEach(()=>{vi.resetAllMocks();m.visivel.mockResolvedValue(atendimento());m.estado.mockResolvedValue({ctx:{agora:new Date(),ariaAtiva:false,handoffPendentes:new Set()},sugestao:false});});
it("projeta somente contrato autorizado, sem IDs de vínculo, arquivo ou campos cadastrais",async()=>{const f=fixture();expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([{id:"m",texto:"Texto fictício",agendadaPara:"2030-01-02T15:00:00.000Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"voce",autorNome:"Pessoa fictícia",podeAlterar:true}]);});
it("consulta somente atendimento selecionado, shape manual, duas origens e ordem determinística com limite50",async()=>{const f=fixture();await lerAgendadasDoAtendimento(f.db,"u","a");expect(f.intencaoMensagem.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({atendimentoId:"a",agendadaPara:{not:null},passo:null,passoComercial:null,status:{in:["PENDENTE","ADIADA"]},origem:{in:["HUMANO","IA"]}}),orderBy:[{agendadaPara:"asc"},{id:"asc"}],take:50,select:expect.any(Object)}));expect(f.intencaoMensagem.findMany.mock.calls[0]?.[0]).not.toHaveProperty("include");});
it("sem ACL não consulta mensagens",async()=>{const f=fixture();m.visivel.mockResolvedValue(null);expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([]);expect(f.intencaoMensagem.findMany).not.toHaveBeenCalled();});
it("encerrado não consulta mensagens",async()=>{const f=fixture();m.visivel.mockResolvedValue({...atendimento(),encerradoEm:new Date()});expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([]);expect(f.intencaoMensagem.findMany).not.toHaveBeenCalled();});
it("IA tem autor aria e somente leitura; anexo é booleano",async()=>{const f=fixture();f.intencaoMensagem.findMany.mockResolvedValue([{...linha(),origem:"IA",autorId:null,autor:null,midiaPath:"PRIVADO-NAO-RETORNAR"}]);const dto=await lerAgendadasDoAtendimento(f.db,"u","a");expect(dto).toEqual([expect.objectContaining({autor:"aria",autorNome:null,podeAlterar:false,temAnexo:true})]);expect(JSON.stringify(dto)).not.toContain("PRIVADO-NAO-RETORNAR");});
it("revogação Portal durante await da lista veta o lote inteiro antes de serializar",async()=>{const f=fixture();let revogado=false;f.usuario.findUnique.mockImplementation(async()=>({...ator(),papeis:revogado?[Papel.ALUNO]:[Papel.VENDEDOR]}));f.intencaoMensagem.findMany.mockImplementation(async()=>{revogado=true;return [linha()];});expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([]);expect(f.intencaoMensagem.findMany).toHaveBeenCalledTimes(1);});
it("binding mudado durante a lista veta resultado antigo",async()=>{const f=fixture();let mudou=false;m.visivel.mockImplementation(async()=>mudou?{...atendimento(),contatoId:"outro",conversa:{...atendimento().conversa,contato:{...atendimento().conversa.contato,id:"outro"}}}:atendimento());f.intencaoMensagem.findMany.mockImplementation(async()=>{mudou=true;return [linha()];});expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([]);});
it("perda de Assumir durante await mantém leitura mas retira alteração",async()=>{const f=fixture();let mudou=false;m.visivel.mockImplementation(async()=>({...atendimento(),responsavelId:mudou?"outro":"u"}));f.intencaoMensagem.findMany.mockImplementation(async()=>{mudou=true;return [linha()];});expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([expect.objectContaining({id:"m",podeAlterar:false})]);});
it("usa o Db fornecido em todas as checagens contextuais",async()=>{const f=fixture();await lerAgendadasDoAtendimento(f.db,"u","a");expect(m.visivel).toHaveBeenCalledWith(expect.objectContaining({id:"u"}),"a",false,f.db);expect(m.estado).toHaveBeenCalledWith(f.db,"a");});

it("GC mantém leitura mas perde alteração quando autor sai da equipe durante await do estado",async()=>{
 const f=fixture();let saiuDaEquipe=false;
 const gerente=()=>({...ator(),papeis:[Papel.GERENTE_COMERCIAL],gerenteComercialId:null});
 const autor=()=>({id:"colega",nome:"Autora fictícia",papeis:[Papel.VENDEDOR],permissoes:[],ativo:true,gerenteComercialId:saiuDaEquipe?"fora":"u"});
 f.usuario.findUnique.mockImplementation(async()=>gerente());
 const findMany=vi.fn().mockImplementation(async()=>[gerente(),autor()]);
 Object.assign(f.usuario,{findMany});
 f.intencaoMensagem.findMany.mockResolvedValue([{...linha(),autorId:"colega",autor:{nome:"Autora fictícia",gerenteComercialId:"u"}}]);
 // Controle com equipe preservada: a mesma linha continua alterável antes da revogação.
 expect(await lerAgendadasDoAtendimento(f.db,"u","a")).toEqual([expect.objectContaining({id:"m",podeAlterar:true})]);
 // A fronteira canônica é aguardada pelo leitor; esta mutação ocorre após o snapshot da lista.
 m.estado.mockImplementation(async()=>{await Promise.resolve();saiuDaEquipe=true;return {ctx:{agora:new Date(),ariaAtiva:false,handoffPendentes:new Set()},sugestao:false};});
 const dto=await lerAgendadasDoAtendimento(f.db,"u","a");
 expect(saiuDaEquipe).toBe(true);
 expect(findMany).toHaveBeenCalledTimes(2);
 expect(findMany).toHaveBeenLastCalledWith({where:{id:{in:["u","colega"]}},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true,gerenteComercialId:true}});
 expect(dto).toEqual([{id:"m",texto:"Texto fictício",agendadaPara:"2030-01-02T15:00:00.000Z",status:"PENDENTE",tipo:"TEXTO",temAnexo:false,autor:"equipe",autorNome:"Autora fictícia",podeAlterar:false}]);
});
