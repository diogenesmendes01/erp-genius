import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
import {marcaIdempotencia} from "@/server/_shared/idempotencia";
import {executarAgendadaInbox,type BancoAgendadaInbox,type ComandoAgendadaInbox} from "./agendadas-operacao-inbox";
const m=vi.hoisted(()=>({visivel:vi.fn(),estado:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:m.visivel}));
vi.mock("@/server/whatsapp/enfileirar-inbox",()=>({lerContextoAtualInbox:m.estado}));
vi.mock("@/server/whatsapp/janela-agendamento",()=>({exigirAgendamentoNaJanela:vi.fn().mockResolvedValue(undefined)}));
function fixture(){
 const u={id:"u",nome:"Ator fictício",papeis:[Papel.VENDEDOR] as Papel[],permissoes:[],ativo:true,gerenteComercialId:null};
 const a={id:"a",numeroId:"n",contatoId:"c",conversaId:"conversa",finalidade:"COMERCIAL",responsavelId:"u" as string|null,encerradoEm:null,leadId:null,iaPausadaEm:new Date() as Date|null,conversa:{id:"conversa",numeroId:"n",grupoId:null,numero:{ativo:true,donoId:"u" as string|null},contato:{id:"c",pessoaId:null,leadId:null,optOutEm:null}}};
 const it={id:"i",atendimentoId:"a",numeroId:"n",contatoId:"c",origem:"HUMANO",autorId:"u",status:"PENDENTE",agendadaPara:new Date("2035-01-02T15:00:00Z"),validaAte:null,passo:null,passoComercial:null,autor:{gerenteComercialId:null}};
 const tx={atendimentoWhatsApp:{findUnique:vi.fn().mockResolvedValue(a),findFirst:vi.fn().mockResolvedValue(a)},$queryRaw:vi.fn().mockResolvedValue([]),$executeRaw:vi.fn().mockResolvedValue(0),usuario:{findUnique:vi.fn().mockResolvedValue(u),findMany:vi.fn().mockResolvedValue([u])},configIA:{upsert:vi.fn().mockResolvedValue({id:"ia"}),findUnique:vi.fn().mockResolvedValue({id:"ia"})},intencaoMensagem:{findFirst:vi.fn().mockResolvedValue(it),findUnique:vi.fn().mockResolvedValue(it),create:vi.fn().mockResolvedValue({id:"nova"}),updateMany:vi.fn().mockResolvedValue({count:1})},evento:{create:vi.fn().mockResolvedValue({id:"evento"}),findFirst:vi.fn().mockResolvedValue(null)}};
 const banco={$transaction:vi.fn(async (fn:(db:typeof tx)=>Promise<unknown>)=>fn(tx))};
 // Double parcial só da fronteira; não é teste de SQL/ACL/TX nativa.
 const db=banco as unknown as BancoAgendadaInbox;
 m.visivel.mockResolvedValue(a);m.estado.mockResolvedValue({ctx:{agora:new Date(),ariaAtiva:false,handoffPendentes:new Set()},sugestao:false});
 Object.assign(a,{numero:a.conversa.numero,contato:a.conversa.contato});
 return {u,a,it,tx,banco,db};
}
beforeEach(()=>{vi.resetAllMocks();});
const criar=():Extract<ComandoAgendadaInbox,{tipo:"CRIAR"}>=>({tipo:"CRIAR",atendimentoId:"a",texto:"Texto fictício",agendadaPara:"2035-01-02T15:00:00.000Z",chaveIdempotencia:"tentativa-criar-362"});
it("CRIAR persiste HUMANO no destino resolvido e retorna a intenção",async()=>{const f=fixture();expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"nova"});expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({atendimentoId:"a",numeroId:"n",contatoId:"c",autorId:"u",origem:"HUMANO",corpoRenderizado:"Texto fictício"})}));});
it("REAGENDAR muda somente agenda/status no alvo selecionado",async()=>{const f=fixture();expect(await executarAgendadaInbox(f.db,"u",{tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i",agendadaPara:"2035-01-03T15:00:00.000Z"})).toEqual({id:"i"});expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"i",atendimentoId:"a"}),data:expect.objectContaining({agendadaPara:new Date("2035-01-03T15:00:00Z"),status:"PENDENTE"})}));});
it("ENVIAR_AGORA apenas torna elegível no próximo ciclo",async()=>{const f=fixture();expect(await executarAgendadaInbox(f.db,"u",{tipo:"ENVIAR_AGORA",atendimentoId:"a",intencaoId:"i"})).toEqual({id:"i"});expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({agendadaPara:expect.any(Date),status:"PENDENTE"})}));});
it("Admin não substitui Assumir por alçada",async()=>{const f=fixture();f.u.papeis=[Papel.ADMINISTRADOR];f.a.responsavelId="outro";await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/Assuma/);expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("revogação de responsável durante leitura de estado recusa sem efeitos",async()=>{const f=fixture();m.estado.mockImplementation(async()=>{await Promise.resolve();f.a.responsavelId="outro";return {ctx:{agora:new Date(),ariaAtiva:false,handoffPendentes:new Set()},sugestao:false};});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/Assuma/);expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();});

/** SQL doubles observe order and selected shape; native locks remain a separate gate. */
function sqlTexto(q:unknown){return Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");}
function observar(f:ReturnType<typeof fixture>,replay=false){
 const ordem:string[]=[];
 const comando=criar();
 const marca=marcaIdempotencia(comando.chaveIdempotencia,{atendimentoId:"a",numeroId:"n",texto:"Texto fictício",agendadaPara:"2035-01-02T15:00:00.000Z",validaAte:null});
 const evento={id:"e",tipo:"MensagemAgendada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:{intencaoId:"i",...marca}};
 f.tx.$executeRaw.mockImplementation(async(q:unknown)=>{const sql=sqlTexto(q);if(sql.includes("pg_advisory_xact_lock"))ordem.push("advisory");return 0;});
 f.tx.$queryRaw.mockImplementation(async(q:unknown)=>{const sql=sqlTexto(q);if(sql.includes('FROM "Evento"')){ordem.push("recibo");return replay?[evento]:[];}if(sql.includes('"AtendimentoWhatsApp"')&&sql.includes("FOR SHARE")){ordem.push("pai");return [{id:"a"}];}if(sql.includes('"IntencaoMensagem"')&&sql.includes("FOR UPDATE")){ordem.push("intencao");return [{id:"i"}];}return [];});
 f.tx.atendimentoWhatsApp.findUnique.mockImplementation(async()=>{ordem.push("resolver");return f.a;});
 f.tx.atendimentoWhatsApp.findFirst.mockImplementation(async()=>{ordem.push("resolver");return f.a;});
 f.tx.configIA.upsert.mockImplementation(async()=>{ordem.push("config");return {id:"ia"};});
 f.tx.intencaoMensagem.findFirst.mockImplementation(async()=>{ordem.push("status");return f.it;});
 f.tx.intencaoMensagem.findUnique.mockImplementation(async()=>{ordem.push("status");return f.it;});
 return {ordem,evento};
}
const reagendar=():ComandoAgendadaInbox=>({tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i",agendadaPara:"2035-01-03T15:00:00.000Z"});
it("resolve número antes de advisory, prepara Config antes do pai e usa uma TX",async()=>{const f=fixture();const {ordem}=observar(f);expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"nova"});expect(f.banco.$transaction).toHaveBeenCalledTimes(1);for(const etapa of ["resolver","advisory","config","pai"])expect(ordem).toContain(etapa);expect(ordem.indexOf("resolver")).toBeLessThan(ordem.indexOf("advisory"));expect(ordem.indexOf("advisory")).toBeLessThan(ordem.indexOf("config"));expect(ordem.indexOf("config")).toBeLessThan(ordem.indexOf("pai"));const pai=f.tx.$queryRaw.mock.calls.map(([q])=>sqlTexto(q)).find(sql=>sql.includes('"AtendimentoWhatsApp"'));expect(pai).toContain("FOR SHARE");expect(pai).not.toContain("FOR NO KEY UPDATE");});
it("replay autorizado mantém intenção e trava pai depois intenção antes de status",async()=>{const f=fixture();const {ordem}=observar(f,true);expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"i"});expect(ordem).toContain("intencao");expect(ordem.indexOf("pai")).toBeLessThan(ordem.indexOf("intencao"));expect(ordem.indexOf("intencao")).toBeLessThan(ordem.indexOf("status"));expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("replay não devolve recibo se dono foi revogado durante espera da intenção",async()=>{const f=fixture();observar(f,true);const raw=f.tx.$queryRaw.getMockImplementation()!;f.tx.$queryRaw.mockImplementation(async(q:unknown)=>{const r=await raw(q);if(sqlTexto(q).includes('"IntencaoMensagem"'))f.a.responsavelId="outro";return r;});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/Assuma/);expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("replay com status ENVIANDO depois do lock é recusado",async()=>{const f=fixture();observar(f,true);f.it.status="ENVIANDO";await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/enviando|situação|encontrada/i);expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("CAS perdido não grava Evento de sucesso",async()=>{const f=fixture();observar(f);f.tx.intencaoMensagem.updateMany.mockResolvedValue({count:0});await expect(executarAgendadaInbox(f.db,"u",reagendar())).rejects.toThrow(/mudou|situação|encontrada/i);expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledTimes(1);expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("retarget do número durante Config recusa mesmo sem numeroEsperado",async()=>{const f=fixture();observar(f);f.tx.configIA.upsert.mockImplementation(async()=>{f.a.numeroId="outro-numero";f.a.conversa.numeroId="outro-numero";return {id:"ia"};});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/Número|destino|Atendimento/i);expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();});
it("retarget do contato durante Evento é detectado pelo gate final",async()=>{const f=fixture();observar(f);f.tx.evento.create.mockImplementation(async()=>{f.a.contatoId="outro-contato";f.a.conversa.contato.id="outro-contato";return {id:"evento"};});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/destino|Atendimento/i);expect(f.tx.evento.create).toHaveBeenCalledTimes(1);});
it("revogação de ator no await de Evento recusa após escrita tentada",async()=>{const f=fixture();observar(f);f.tx.evento.create.mockImplementation(async()=>{f.u.ativo=false;return {id:"evento"};});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/ativa|acesso|Atendimento|sessão/i);expect(f.tx.evento.create).toHaveBeenCalledTimes(1);});
it("Aria ia/aprovacao/handoff recusam antes da mutação",async()=>{for(const estado of ["ia","aprovacao","handoff"]){const f=fixture();observar(f);f.a.iaPausadaEm=null;f.a.conversa.numero.donoId=null;m.estado.mockResolvedValue({ctx:{agora:new Date(),ariaAtiva:estado==="ia",handoffPendentes:new Set(estado==="handoff"?["a"]:[])},sugestao:estado==="aprovacao"});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/Assuma/);expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();}});
it("owner nulo recusa e owner atual sem tarefas.ver conserva canário positivo",async()=>{const negativo=fixture();observar(negativo);negativo.a.responsavelId=null;await expect(executarAgendadaInbox(negativo.db,"u",criar())).rejects.toThrow(/Assuma/);expect(negativo.tx.intencaoMensagem.create).not.toHaveBeenCalled();const positivo=fixture();observar(positivo);expect(positivo.u.permissoes).toEqual([]);expect(await executarAgendadaInbox(positivo.db,"u",criar())).toEqual({id:"nova"});});

it("N1 atendimento oculto com número errado e inexistente têm a mesma recusa",async()=>{
 const comando={...criar(),numeroEsperado:"numero-errado"};
 const inexistente=fixture();observar(inexistente);inexistente.tx.atendimentoWhatsApp.findUnique.mockResolvedValue(null as unknown as typeof inexistente.a);
 await expect(executarAgendadaInbox(inexistente.db,"u",comando)).rejects.toThrow(/^Atendimento não encontrado\.$/);
 const oculto=fixture();observar(oculto);m.visivel.mockResolvedValue(null);
 await expect(executarAgendadaInbox(oculto.db,"u",comando)).rejects.toThrow(/^Atendimento não encontrado\.$/);
 expect(oculto.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(oculto.tx.evento.create).not.toHaveBeenCalled();
});
it("N1 ator autorizado com número errado conserva recusa de número sem gravação",async()=>{
 const f=fixture();observar(f);
 await expect(executarAgendadaInbox(f.db,"u",{...criar(),numeroEsperado:"numero-errado"})).rejects.toThrow(/^Número de envio indisponível\.$/);
 expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();
});
