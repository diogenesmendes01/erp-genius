import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
import {marcaIdempotencia} from "@/server/_shared/idempotencia";
import {executarAgendadaInbox,type BancoAgendadaInbox,type ComandoAgendadaInbox} from "./agendadas-operacao-inbox";
const m=vi.hoisted(()=>({visivel:vi.fn(),estado:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:m.visivel}));
vi.mock("@/server/whatsapp/enfileirar-inbox",()=>({lerContextoAtualInbox:m.estado}));
vi.mock("@/server/whatsapp/janela-agendamento",()=>({exigirAgendamentoNaJanela:vi.fn().mockResolvedValue(undefined)}));
function fixture(){
 const u={id:"u",nome:"Ator fictício",papeis:[Papel.VENDEDOR] as Papel[],permissoes:[],ativo:true,gerenteComercialId:null as string|null};
 const a={id:"a",numeroId:"n",contatoId:"c",conversaId:"conversa",finalidade:"COMERCIAL",responsavelId:"u" as string|null,encerradoEm:null as Date|null,leadId:null,iaPausadaEm:new Date() as Date|null,conversa:{id:"conversa",numeroId:"n",grupoId:null,numero:{ativo:true,donoId:"u" as string|null},contato:{id:"c",pessoaId:null,leadId:null,optOutEm:null as Date|null}}};
 const it={id:"i",atendimentoId:"a",numeroId:"n",contatoId:"c",origem:"HUMANO",tipo:"TEXTO",templateId:null as string|null,midiaPath:null as string|null,conteudo:null as unknown,autorId:"u",status:"PENDENTE",agendadaPara:new Date("2035-01-02T15:00:00Z") as Date|null,validaAte:null,passo:null,passoComercial:null,autor:{gerenteComercialId:null}};
 const tx={atendimentoWhatsApp:{findUnique:vi.fn().mockResolvedValue(a),findFirst:vi.fn().mockResolvedValue(a)},$queryRaw:vi.fn().mockResolvedValue([]),$executeRaw:vi.fn().mockResolvedValue(0),usuario:{findUnique:vi.fn().mockResolvedValue(u),findMany:vi.fn().mockResolvedValue([u])},configIA:{upsert:vi.fn().mockResolvedValue({id:"ia"}),findUnique:vi.fn().mockResolvedValue({id:"ia"})},intencaoMensagem:{findFirst:vi.fn().mockResolvedValue(it),findUnique:vi.fn().mockResolvedValue(it),create:vi.fn().mockResolvedValue({id:"nova"}),updateMany:vi.fn().mockResolvedValue({count:1})},evento:{create:vi.fn().mockResolvedValue({id:"evento"}),findFirst:vi.fn().mockResolvedValue(null)}};
 const banco={$transaction:vi.fn(async (fn:(db:typeof tx)=>Promise<unknown>)=>fn(tx))};
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

function sqlTexto(q:unknown){return Array.isArray(q)?q.join("?"):((q as {strings?:string[]})?.strings??[]).join("?");}
function observar(f:ReturnType<typeof fixture>,replay=false,comando:ComandoAgendadaInbox=criar()){
 const ordem:string[]=[];

 const entrada=comando.tipo==="CRIAR"?{atendimentoId:comando.atendimentoId,numeroId:"n",texto:comando.texto,agendadaPara:new Date(comando.agendadaPara).toISOString(),validaAte:comando.validaAte??null}:{contexto:"inbox362",operacao:comando.tipo,atendimentoId:comando.atendimentoId,intencaoId:comando.intencaoId,...(comando.tipo==="REAGENDAR"?{agendadaPara:new Date(comando.agendadaPara).toISOString()}:{})};
 const marca=marcaIdempotencia(comando.chaveIdempotencia,entrada);
 const evento={id:"e",tipo:comando.tipo==="CRIAR"?"MensagemAgendada":"MensagemReagendada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:{intencaoId:"i",...marca,...(comando.tipo!=="CRIAR"?{contexto:"inbox362",operacao:comando.tipo}:{})}};
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
it("R3B1 replay conserva ACK após troca de responsável se leitura continua autorizada",async()=>{const f=fixture();observar(f,true);const raw=f.tx.$queryRaw.getMockImplementation()!;f.tx.$queryRaw.mockImplementation(async(q:unknown)=>{const r=await raw(q);if(sqlTexto(q).includes('"IntencaoMensagem"'))f.a.responsavelId="outro";return r;});expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"i"});semEfeitos(f);expect(m.visivel).toHaveBeenLastCalledWith(expect.objectContaining({id:"u"}),"a",false,f.tx);});
it("R3B1 replay com claim ENVIANDO devolve ACK sem alterar o claim",async()=>{const f=fixture();observar(f,true);f.it.status="ENVIANDO";expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"i"});expect(f.it.status).toBe("ENVIANDO");semEfeitos(f);});
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

function semEfeitos(f:ReturnType<typeof fixture>){expect(f.tx.configIA.upsert).not.toHaveBeenCalled();expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();}
it.each(["optout","encerrado","consumido","expirado","linhaInativa","aria"] as const)("R3B1 recibo confirmado sobrevive a %s sem executar gate de envio",async estado=>{const f=fixture();observar(f,true);if(estado==="optout")f.a.conversa.contato.optOutEm=new Date();if(estado==="encerrado")f.a.encerradoEm=new Date();if(estado==="consumido"){f.it.status="DESPACHADA";f.it.agendadaPara=null;}if(estado==="expirado")f.it.agendadaPara=new Date("2001-01-01T00:00:00Z");if(estado==="linhaInativa")f.a.conversa.numero.ativo=false;if(estado==="aria"){f.a.iaPausadaEm=null;m.estado.mockResolvedValue({ctx:{agora:new Date(),ariaAtiva:true,handoffPendentes:new Set()},sugestao:false});}expect(await executarAgendadaInbox(f.db,"u",criar())).toEqual({id:"i"});semEfeitos(f);expect(m.estado).not.toHaveBeenCalled();expect(m.visivel).toHaveBeenLastCalledWith(expect.objectContaining({id:"u"}),"a",false,f.tx);});
it("R3B1 nova mutação mantém recusa de claim ENVIANDO",async()=>{const f=fixture();observar(f);f.it.status="ENVIANDO";await expect(executarAgendadaInbox(f.db,"u",reagendar())).rejects.toThrow("Mensagem não encontrada ou mudou de situação.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
it("R3B1 ACL revogada durante espera da intenção impede ACK sem DML",async()=>{const f=fixture();observar(f,true);const raw=f.tx.$queryRaw.getMockImplementation()!;f.tx.$queryRaw.mockImplementation(async(q:unknown)=>{const r=await raw(q);if(sqlTexto(q).includes('"IntencaoMensagem"'))m.visivel.mockResolvedValue(null);return r;});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow("Atendimento não encontrado.");semEfeitos(f);});
it("R3B1 sessão revogada na espera impede ACK",async()=>{const f=fixture();observar(f,true);const raw=f.tx.$queryRaw.getMockImplementation()!;f.tx.$queryRaw.mockImplementation(async(q:unknown)=>{const r=await raw(q);if(sqlTexto(q).includes('"IntencaoMensagem"'))f.u.ativo=false;return r;});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/sessão.*ativa/);semEfeitos(f);});
it("R3B1 perfil alterado no último await de leitura não usa fotografia antiga",async()=>{const f=fixture();observar(f,true);m.visivel.mockImplementation(async()=>{f.u.gerenteComercialId="gerenteNovo";return f.a;});await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow(/sessão ou acesso mudou/);semEfeitos(f);});
it.each(["REAGENDAR","ENVIAR_AGORA"] as const)("R3B1 ACK %s do Admin não exige autoria original da intenção",async tipo=>{const f=fixture();f.u.papeis=[Papel.ADMINISTRADOR];f.it.autorId="vendedorOriginal";f.it.status="DESPACHADA";const comando:ComandoAgendadaInbox=tipo==="REAGENDAR"?{...reagendar(),chaveIdempotencia:"ack-admin-362-reagendar"}:{tipo,atendimentoId:"a",intencaoId:"i",chaveIdempotencia:"ack-admin-362-agora"};observar(f,true,comando);expect(await executarAgendadaInbox(f.db,"u",comando)).toEqual({id:"i"});semEfeitos(f);});
it.each(["autor","agregado","tipo","intencao"] as const)("R3B1 recibo com %s incompatível não é adotado",async campo=>{const f=fixture(),o=observar(f,true);if(campo==="autor")o.evento.autorId="outro";if(campo==="agregado")o.evento.agregadoId="outro";if(campo==="tipo")o.evento.tipo="OutroEvento";if(campo==="intencao")o.evento.payload.intencaoId="outra";await expect(executarAgendadaInbox(f.db,"u",criar())).rejects.toThrow("Mensagem não encontrada ou mudou de situação.");semEfeitos(f);});
it.each(["CRIAR","REAGENDAR","ENVIAR_AGORA"] as const)("C5 recusa %s sem responsável com mensagem da operação e sem nova mutação",async tipo=>{
 const f=fixture();observar(f);f.a.responsavelId="outro";
 const comando:ComandoAgendadaInbox=tipo==="CRIAR"?criar():tipo==="REAGENDAR"?reagendar():{tipo,atendimentoId:"a",intencaoId:"i"};
 await expect(executarAgendadaInbox(f.db,"u",comando)).rejects.toThrow(tipo==="CRIAR"?"Assuma a conversa para agendar a mensagem.":"Assuma a conversa para alterar a mensagem agendada.");
 expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();
});const editar=(extra:Partial<Extract<ComandoAgendadaInbox,{tipo:"EDITAR"}>>={}):Extract<ComandoAgendadaInbox,{tipo:"EDITAR"}>=>({tipo:"EDITAR",atendimentoId:"a",intencaoId:"i",texto:"Texto novo fictício",agendadaPara:"2035-01-03T15:00:00.000Z",...extra});
it("EDITAR troca texto e horário e registra MensagemAgendadaEditada sem o texto",async()=>{const f=fixture();Object.assign(f.it,{corpoRenderizado:"Texto antigo"});expect(await executarAgendadaInbox(f.db,"u",editar({texto:"  Texto novo fictício  "}))).toEqual({id:"i"});
 expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"i",atendimentoId:"a",status:"PENDENTE"}),data:expect.objectContaining({corpoRenderizado:"Texto novo fictício",agendadaPara:new Date("2035-01-03T15:00:00Z"),status:"PENDENTE"})}));
 const evento=f.tx.evento.create.mock.calls[0]![0].data;expect(evento).toMatchObject({tipo:"MensagemAgendadaEditada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:expect.objectContaining({operacao:"EDITAR",intencaoId:"i",textoAlterado:true})});expect(JSON.stringify(evento.payload)).not.toContain("Texto novo");});
it("EDITAR só de horário marca textoAlterado falso",async()=>{const f=fixture();Object.assign(f.it,{corpoRenderizado:"Igual"});await executarAgendadaInbox(f.db,"u",editar({texto:"Igual"}));expect(f.tx.evento.create.mock.calls[0]![0].data.payload).toMatchObject({textoAlterado:false});});
it("EDITAR de mensagem já enviada recusa com motivo claro",async()=>{const f=fixture();f.it.status="DESPACHADA";await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow("A mensagem já foi enviada.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("EDITAR com texto longo demais recusa antes da transação",async()=>{const f=fixture();await expect(executarAgendadaInbox(f.db,"u",editar({texto:"x".repeat(4097)}))).rejects.toThrow();expect(f.banco.$transaction).not.toHaveBeenCalled();});
it("EDITAR de agendada de texto com texto vazio recusa sem alterar",async()=>{const f=fixture();await expect(executarAgendadaInbox(f.db,"u",editar({texto:"   "}))).rejects.toThrow("Escreva a mensagem.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("EDITAR de agendada com anexo troca legenda e horário sem tocar no anexo; legenda pode ficar vazia",async()=>{for(const texto of ["Nova legenda","  "]){const f=fixture();Object.assign(f.it,{tipo:"DOCUMENTO",midiaPath:"/api/files/whatsapp-out/u/p.pdf",corpoRenderizado:"Segue a proposta"});
 expect(await executarAgendadaInbox(f.db,"u",editar({texto}))).toEqual({id:"i"});const data=f.tx.intencaoMensagem.updateMany.mock.calls[0]![0].data;
 expect(data).toMatchObject({agendadaPara:new Date("2035-01-03T15:00:00Z"),corpoRenderizado:texto.trim()});expect(data).not.toHaveProperty("midiaPath");expect(data).not.toHaveProperty("tipo");
 expect(f.tx.evento.create.mock.calls[0]![0].data).toMatchObject({tipo:"MensagemAgendadaEditada",payload:expect.objectContaining({operacao:"EDITAR",textoAlterado:true})});}});
it("EDITAR exige ter assumido a conversa",async()=>{const f=fixture();f.a.responsavelId="outro";await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow(/Assuma a conversa para alterar/);expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
it("EDITAR de outro autor sem equipe recusa como não encontrada",async()=>{const f=fixture();f.it.autorId="outro";f.tx.usuario.findMany.mockResolvedValue([f.u,{...f.u,id:"outro"}]);await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow(/Mensagem não encontrada/);expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
it("EDITAR com a mesma chave e o mesmo conteúdo devolve o recibo sem novo Evento; outro texto é conflito",async()=>{const f=fixture();const comando=editar({chaveIdempotencia:"editar-374"});const entrada={contexto:"inbox362",operacao:"EDITAR",atendimentoId:"a",intencaoId:"i",agendadaPara:"2035-01-03T15:00:00.000Z",texto:"Texto novo fictício"};const marca=marcaIdempotencia("editar-374",entrada)!;
 const evento={id:"e",tipo:"MensagemAgendadaEditada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:{contexto:"inbox362",operacao:"EDITAR",intencaoId:"i",atendimentoId:"a",...marca}};
 f.tx.$queryRaw.mockImplementation(async(q:unknown)=>sqlTexto(q).includes('FROM "Evento"')?[evento]:[]);
 expect(await executarAgendadaInbox(f.db,"u",comando)).toEqual({id:"i"});expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();
 await expect(executarAgendadaInbox(f.db,"u",{...comando,texto:"Outro texto"})).rejects.toThrow(/tentativa já foi usada/);});
it("EDITAR de agendada já enviada de outro autor sem equipe responde como não encontrada",async()=>{const f=fixture();f.it.status="DESPACHADA";f.it.autorId="outro";f.tx.usuario.findMany.mockResolvedValue([f.u,{...f.u,id:"outro"}]);await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow(/Mensagem não encontrada/);expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
it("EDITAR de agendada em envio responde que já está sendo enviada",async()=>{const f=fixture();f.it.status="ENVIANDO";await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow("A mensagem já está sendo enviada.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it.each([{tipo:"TEXTO",templateId:"t"},{tipo:"TEXTO",conteudo:{interativo:true}},{tipo:"IMAGEM",midiaPath:null},{tipo:"TEXTO",midiaPath:"/api/files/whatsapp-out/u/x.jpg"}])("EDITAR não sobrescreve o texto de template, conteúdo estruturado ou mídia inconsistente (%o)",async(extra)=>{const f=fixture();Object.assign(f.it,extra);await expect(executarAgendadaInbox(f.db,"u",editar())).rejects.toThrow("Só mensagens de texto podem ter o texto editado.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("CRIAR grava perguntarSeResponder e o leva para a marca: mesma chave com outra opção é conflito",async()=>{const f=fixture();expect(await executarAgendadaInbox(f.db,"u",{...criar(),perguntarSeResponder:true})).toEqual({id:"nova"});
 expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({perguntarSeResponder:true})}));
 const c=criar(),entrada={atendimentoId:"a",numeroId:"n",texto:c.texto,agendadaPara:c.agendadaPara,validaAte:null,perguntarSeResponder:true};const marca=marcaIdempotencia(c.chaveIdempotencia,entrada)!;
 const evento={id:"e",tipo:"MensagemAgendada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:{intencaoId:"i",...marca}};
 const g=fixture();g.tx.$queryRaw.mockImplementation(async(q:unknown)=>sqlTexto(q).includes('FROM "Evento"')?[evento]:[]);
 await expect(executarAgendadaInbox(g.db,"u",c)).rejects.toThrow(/tentativa já foi usada/);expect(g.tx.intencaoMensagem.create).not.toHaveBeenCalled();});
it("CRIAR sem a opção grava perguntarSeResponder falso",async()=>{const f=fixture();await executarAgendadaInbox(f.db,"u",criar());expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({perguntarSeResponder:false})}));});
it("REAGENDAR, EDITAR e ENVIAR_AGORA registram a confirmação depois da resposta",async()=>{for(const comando of [reagendar(),editar(),{tipo:"ENVIAR_AGORA" as const,atendimentoId:"a",intencaoId:"i"}]){const f=fixture();Object.assign(f.it,{corpoRenderizado:"Texto"});await executarAgendadaInbox(f.db,"u",comando);expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({confirmadaAposRespostaEm:expect.any(Date)})}));}});
const manter=(extra:Partial<Extract<ComandoAgendadaInbox,{tipo:"MANTER"}>>={}):Extract<ComandoAgendadaInbox,{tipo:"MANTER"}>=>({tipo:"MANTER",atendimentoId:"a",intencaoId:"i",...extra});
it("MANTER sobre a retida volta a PENDENTE com a confirmação e registra MensagemAgendadaMantida",async()=>{const f=fixture();Object.assign(f.it,{status:"ADIADA",motivoFalha:"aguarda_confirmacao_resposta",perguntarSeResponder:true});
 expect(await executarAgendadaInbox(f.db,"u",manter())).toEqual({id:"i"});
 expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"i",atendimentoId:"a",status:"ADIADA"}),data:{confirmadaAposRespostaEm:expect.any(Date),status:"PENDENTE",despacharAposEm:null,motivoFalha:null}}));
 expect(f.tx.evento.create.mock.calls[0]![0].data).toMatchObject({tipo:"MensagemAgendadaMantida",agregadoTipo:"AtendimentoWhatsApp",agregadoId:"a",autorId:"u",payload:expect.objectContaining({operacao:"MANTER",intencaoId:"i"})});});
it("MANTER antes do despachante reter só registra a confirmação",async()=>{const f=fixture();Object.assign(f.it,{motivoFalha:null,perguntarSeResponder:true});await executarAgendadaInbox(f.db,"u",manter());expect(f.tx.intencaoMensagem.updateMany.mock.calls[0]![0].data).toEqual({confirmadaAposRespostaEm:expect.any(Date)});});
it("MANTER sem a opção recusa sem efeitos",async()=>{const f=fixture();Object.assign(f.it,{perguntarSeResponder:false});await expect(executarAgendadaInbox(f.db,"u",manter())).rejects.toThrow("Esta mensagem não aguarda confirmação.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(f.tx.evento.create).not.toHaveBeenCalled();});
it("MANTER exige ter assumido a conversa",async()=>{const f=fixture();Object.assign(f.it,{status:"ADIADA",motivoFalha:"aguarda_confirmacao_resposta",perguntarSeResponder:true});f.a.responsavelId="outro";await expect(executarAgendadaInbox(f.db,"u",manter())).rejects.toThrow("Assuma a conversa para alterar a mensagem agendada.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
it("MANTER de mensagem já enviada recusa",async()=>{const f=fixture();Object.assign(f.it,{status:"DESPACHADA",perguntarSeResponder:true});await expect(executarAgendadaInbox(f.db,"u",manter())).rejects.toThrow("Mensagem não encontrada ou mudou de situação.");expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();});
const anexo=vi.hoisted(()=>({proposta:vi.fn(),copiar:vi.fn(),descartar:vi.fn(),escopo:vi.fn(),existe:vi.fn(),verLead:vi.fn()}));
vi.mock("@/server/whatsapp/visibilidade-lead",()=>({podeVerLeadNaThread:anexo.verLead}));
vi.mock("@/server/whatsapp/proposta-atendimento",()=>({ERRO_ANEXAR_PROPOSTA:"Não foi possível anexar esta proposta.",exigirPropostaVisivel:anexo.proposta}));
vi.mock("@/server/whatsapp/midia",async(original)=>({...await original<typeof import("@/server/whatsapp/midia")>(),copiarDocumentoParaSaida:anexo.copiar,descartarMidiaSaida:anexo.descartar,midiaSaidaExiste:anexo.existe}));
vi.mock("@/server/crm/tarefas",()=>({escopoTarefas:anexo.escopo}));
function comTarefa(f:ReturnType<typeof fixture>,tarefa:{id:string}|null){const findFirst=vi.fn().mockResolvedValue(tarefa);Object.assign(f.tx,{tarefa:{findFirst}});anexo.escopo.mockResolvedValue({responsavelId:"u"});return findFirst;}
it("CRIAR com arquivo do uploader grava a mídia do autor e dispensa o texto",async()=>{
 const f=fixture();anexo.existe.mockResolvedValue(true);await executarAgendadaInbox(f.db,"u",{...criar(),texto:"",midiaUrl:"/api/files/whatsapp-out/u/1.pdf",anexoNome:"Foto da turma.pdf"});
 expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({tipo:"DOCUMENTO",midiaPath:"/api/files/whatsapp-out/u/1.pdf",corpoRenderizado:""})}));
 expect(f.tx.evento.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({payload:expect.objectContaining({anexoTipo:"DOCUMENTO",anexoNome:"Foto da turma.pdf"})})}));
});
it("arquivo de outro autor ou fora do uploader é recusado sem efeitos",async()=>{
 for(const midiaUrl of ["/api/files/whatsapp-out/outro/1.pdf","/api/files/documentos/1.pdf"]){const f=fixture();await expect(executarAgendadaInbox(f.db,"u",{...criar(),midiaUrl})).rejects.toThrow("Anexo inválido: envie o arquivo pelo uploader da inbox.");expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();}
});
it("sem texto e sem anexo continua exigindo a mensagem; arquivo e proposta juntos são recusados",async()=>{
 const f=fixture();await expect(executarAgendadaInbox(f.db,"u",{...criar(),texto:"  "})).rejects.toThrow("Escreva a mensagem.");
 await expect(executarAgendadaInbox(f.db,"u",{...criar(),midiaUrl:"/api/files/whatsapp-out/u/1.pdf",documentoPropostaId:"d"})).rejects.toThrow("Escolha só um anexo.");
 expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();
});
it("CRIAR com proposta copia o documento para a saída do autor e grava o nome",async()=>{
 const f=fixture();anexo.proposta.mockResolvedValue({url:"/api/files/documentos/p.pdf",nome:"Proposta anual.pdf"});anexo.copiar.mockResolvedValue("/api/files/whatsapp-out/u/copia.pdf");
 await executarAgendadaInbox(f.db,"u",{...criar(),documentoPropostaId:"d1"});
 expect(anexo.proposta).toHaveBeenCalledWith(expect.objectContaining({id:"u"}),"a","d1");expect(anexo.copiar).toHaveBeenCalledWith("u","/api/files/documentos/p.pdf");
 expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({tipo:"DOCUMENTO",midiaPath:"/api/files/whatsapp-out/u/copia.pdf"})}));
 expect(f.tx.evento.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({payload:expect.objectContaining({documentoPropostaId:"d1",anexoNome:"Proposta anual.pdf"})})}));
 expect(anexo.descartar).not.toHaveBeenCalled();
});
it("falha depois de copiar a proposta descarta a cópia",async()=>{
 const f=fixture();anexo.proposta.mockResolvedValue({url:"/api/files/documentos/p.pdf",nome:"P.pdf"});anexo.copiar.mockResolvedValue("/api/files/whatsapp-out/u/copia.pdf");f.tx.intencaoMensagem.create.mockRejectedValue(new Error("banco"));
 await expect(executarAgendadaInbox(f.db,"u",{...criar(),documentoPropostaId:"d1"})).rejects.toThrow("banco");expect(anexo.descartar).toHaveBeenCalledWith("u","/api/files/whatsapp-out/u/copia.pdf");
});
it("vínculo com a oportunidade da conversa grava leadId; de outra oportunidade é recusado",async()=>{
 anexo.verLead.mockResolvedValue(true);const f=fixture();Object.assign(f.a,{leadId:"op1"});await executarAgendadaInbox(f.db,"u",{...criar(),leadId:"op1"});
 expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({leadId:"op1",tarefaId:null})}));
 expect(f.tx.evento.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({agregadoTipo:"AtendimentoWhatsApp",payload:expect.objectContaining({leadId:"op1"})})}));
 const g=fixture();Object.assign(g.a,{leadId:"op1"});await expect(executarAgendadaInbox(g.db,"u",{...criar(),leadId:"op2"})).rejects.toThrow("Oportunidade não é desta conversa.");expect(g.tx.intencaoMensagem.create).not.toHaveBeenCalled();
});
it("vínculo com tarefa aberta da conversa grava tarefaId; tarefa fora do escopo, concluída ou de outro contato é recusada",async()=>{
 const f=fixture();Object.assign(f.a,{leadId:"op1"});const busca=comTarefa(f,{id:"t1"});await executarAgendadaInbox(f.db,"u",{...criar(),tarefaId:"t1"});
 expect(busca).toHaveBeenCalledWith(expect.objectContaining({where:{AND:[{id:"t1",status:"ABERTA"},{responsavelId:"u"},{OR:[{leadId:"op1"}]}]}}));
 expect(f.tx.intencaoMensagem.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({tarefaId:"t1"})}));
 const g=fixture();Object.assign(g.a,{leadId:"op1"});comTarefa(g,null);await expect(executarAgendadaInbox(g.db,"u",{...criar(),tarefaId:"t9"})).rejects.toThrow("Tarefa não encontrada ou já concluída.");expect(g.tx.intencaoMensagem.create).not.toHaveBeenCalled();
 const h=fixture();const semLigacao=comTarefa(h,{id:"t1"});await expect(executarAgendadaInbox(h.db,"u",{...criar(),tarefaId:"t1"})).rejects.toThrow("Tarefa não encontrada ou já concluída.");expect(semLigacao).not.toHaveBeenCalled();
});
it("a marca de idempotência cobre anexo e vínculo",async()=>{
 anexo.existe.mockResolvedValue(true);anexo.verLead.mockResolvedValue(true);const f=fixture();Object.assign(f.a,{leadId:"op1"});await executarAgendadaInbox(f.db,"u",{...criar(),leadId:"op1",midiaUrl:"/api/files/whatsapp-out/u/1.pdf"});
 const comVinculo=marcaIdempotencia("tentativa-criar-362",{atendimentoId:"a",numeroId:"n",texto:"Texto fictício",agendadaPara:"2035-01-02T15:00:00.000Z",validaAte:null,midiaUrl:"/api/files/whatsapp-out/u/1.pdf",leadId:"op1"});
 expect(f.tx.evento.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({payload:expect.objectContaining(comVinculo)})}));
 expect(comVinculo).not.toEqual(marcaIdempotencia("tentativa-criar-362",{atendimentoId:"a",numeroId:"n",texto:"Texto fictício",agendadaPara:"2035-01-02T15:00:00.000Z",validaAte:null}));
});
it("sem ter assumido, anexo e vínculo não são lidos nem copiados",async()=>{
 const f=fixture();f.a.responsavelId="outro";await expect(executarAgendadaInbox(f.db,"u",{...criar(),documentoPropostaId:"d1"})).rejects.toThrow(/Assuma/);expect(anexo.proposta).not.toHaveBeenCalled();expect(anexo.copiar).not.toHaveBeenCalled();
});
it("vínculo com oportunidade exige conversa comercial e visibilidade do lead na thread",async()=>{
 anexo.verLead.mockResolvedValue(false);const f=fixture();Object.assign(f.a,{leadId:"op1"});
 await expect(executarAgendadaInbox(f.db,"u",{...criar(),leadId:"op1"})).rejects.toThrow("Oportunidade não é desta conversa.");
 expect(anexo.verLead).toHaveBeenCalledWith(expect.objectContaining({id:"u"}),"a","op1",expect.any(Number),f.tx);expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();
 anexo.verLead.mockResolvedValue(true);const g=fixture();Object.assign(g.a,{leadId:"op1",finalidade:"SECRETARIA"});
 await expect(executarAgendadaInbox(g.db,"u",{...criar(),leadId:"op1"})).rejects.toThrow("Oportunidade não é desta conversa.");expect(g.tx.intencaoMensagem.create).not.toHaveBeenCalled();
});
it("arquivo do uploader que não existe mais é recusado ao agendar",async()=>{
 anexo.existe.mockResolvedValue(false);const f=fixture();
 await expect(executarAgendadaInbox(f.db,"u",{...criar(),midiaUrl:"/api/files/whatsapp-out/u/sumiu.pdf"})).rejects.toThrow("Anexo inválido: envie o arquivo pelo uploader da inbox.");
 expect(anexo.existe).toHaveBeenCalledWith("u","/api/files/whatsapp-out/u/sumiu.pdf");expect(f.tx.intencaoMensagem.create).not.toHaveBeenCalled();
});
it("nome do anexo acima de 255 caracteres é encurtado em vez de recusar",async()=>{
 anexo.existe.mockResolvedValue(true);const f=fixture();const nome="a".repeat(300)+".pdf";
 await executarAgendadaInbox(f.db,"u",{...criar(),midiaUrl:"/api/files/whatsapp-out/u/1.pdf",anexoNome:nome});
 expect(f.tx.evento.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({payload:expect.objectContaining({anexoNome:"a".repeat(255)})})}));
});
