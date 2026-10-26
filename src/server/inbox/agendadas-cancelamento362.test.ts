import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
import type {prisma} from "@/lib/prisma";
import {ErroRegra} from "@/server/_shared/sessao";
const portas=vi.hoisted(()=>({visivel:vi.fn(),evento:vi.fn(),aviso:vi.fn()}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:portas.visivel}));
vi.mock("@/server/_shared/evento",()=>({registrarEvento:portas.evento}));
vi.mock("./barramento",()=>({avisarAtendimentoAtualizado:portas.aviso}));
import {cancelarAgendadaInboxTx} from "./agendadas-cancelamento";
function fixture(){
 const u={id:"gp",nome:"GP fictício",papeis:[Papel.GERENTE_PEDAGOGICO] as Papel[],permissoes:[],ativo:true};
 const a={id:"a",responsavelId:"gp" as string|null,encerradoEm:null as Date|null,conversaId:"c"};
 const m={id:"m",atendimentoId:"a",origem:"HUMANO",autorId:"gp",status:"PENDENTE",agendadaPara:new Date("2035-01-02T15:00Z"),passo:null,passoComercial:null,motivoFalha:null as string|null};
 const tx={$queryRaw:vi.fn().mockResolvedValue([{id:"m"}]),usuario:{findUnique:vi.fn().mockImplementation(async()=>({...u,papeis:[...u.papeis]}))},atendimentoWhatsApp:{findFirst:vi.fn().mockImplementation(async()=>({...a})),findUnique:vi.fn().mockImplementation(async()=>({...a}))},intencaoMensagem:{findFirst:vi.fn().mockImplementation(async()=>({...m})),updateMany:vi.fn().mockResolvedValue({count:1})},evento:{findFirst:vi.fn().mockResolvedValue({autorId:"gp"})}};
 const banco={$transaction:vi.fn(async(fn:(db:typeof tx)=>Promise<unknown>)=>fn(tx))};
 portas.visivel.mockImplementation(async()=>({...a}));portas.evento.mockResolvedValue(undefined);portas.aviso.mockResolvedValue(undefined);
 return {u,a,m,tx,banco,db:banco as unknown as typeof prisma};
}
beforeEach(()=>vi.resetAllMocks());
const executar=(f:ReturnType<typeof fixture>)=>cancelarAgendadaInboxTx(f.u,"a","m",f.db);
const semEscrita=(f:ReturnType<typeof fixture>)=>{expect(f.tx.intencaoMensagem.updateMany).not.toHaveBeenCalled();expect(portas.evento).not.toHaveBeenCalled();expect(portas.aviso).not.toHaveBeenCalled();};
it("362 GP ativo autor HUMANO responsável e com leitura cancela sem capacidade CRM",async()=>{const f=fixture();await expect(executar(f)).resolves.toBeUndefined();expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledOnce();expect(portas.evento).toHaveBeenCalledWith(f.tx,expect.objectContaining({tipo:"MensagemAgendadaCancelada",autorId:"gp"}));expect(portas.aviso).toHaveBeenCalledOnce();});
it("362 exceção GP também cancela com atendimento encerrado ainda visível e responsável",async()=>{const f=fixture();f.a.encerradoEm=new Date();await expect(executar(f)).resolves.toBeUndefined();expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledOnce();});
it.each(["ativo","papel","responsavel","autor","origem","visibilidade"] as const)("362 GP recusa revogação %s enquanto aguarda lock da intenção",async revogacao=>{const f=fixture();let locks=0;f.tx.$queryRaw.mockImplementation(async()=>{if(++locks===2){if(revogacao==="ativo")f.u.ativo=false;if(revogacao==="papel")f.u.papeis=[Papel.PROFESSOR];if(revogacao==="responsavel")f.a.responsavelId=null;if(revogacao==="autor")f.m.autorId="outra";if(revogacao==="origem")f.m.origem="IA";if(revogacao==="visibilidade")portas.visivel.mockResolvedValue(null);}return [{id:"m"}];});await expect(executar(f)).rejects.toThrow();expect(locks).toBe(2);semEscrita(f);});
it("362 replay GP autorizado não escreve nem repete aviso",async()=>{const f=fixture();f.m.status="CANCELADA";f.m.motivoFalha="cancelada_pelo_autor_inbox";await expect(executar(f)).resolves.toBeUndefined();expect(f.tx.evento.findFirst).toHaveBeenCalledOnce();semEscrita(f);});
it.each(["ativo","papel","responsavel","visibilidade"] as const)("362 replay GP revalida %s depois do await do recibo",async revogacao=>{const f=fixture();f.m.status="CANCELADA";f.m.motivoFalha="cancelada_pelo_autor_inbox";f.tx.evento.findFirst.mockImplementation(async()=>{if(revogacao==="ativo")f.u.ativo=false;if(revogacao==="papel")f.u.papeis=[Papel.PROFESSOR];if(revogacao==="responsavel")f.a.responsavelId=null;if(revogacao==="visibilidade")portas.visivel.mockResolvedValue(null);return {autorId:"gp"};});await expect(executar(f)).rejects.toThrow();expect(f.tx.evento.findFirst).toHaveBeenCalledOnce();semEscrita(f);});
it("362 GP perde responsabilidade durante leitura da intenção e não ganha cancelamento pelo snapshot anterior",async()=>{const f=fixture();f.tx.intencaoMensagem.findFirst.mockImplementation(async()=>{f.a.responsavelId=null;return {...f.m};});await expect(executar(f)).rejects.toThrow();expect(f.tx.intencaoMensagem.findFirst).toHaveBeenCalledOnce();semEscrita(f);});
it("362 revogação GP no await do Evento recusa a transação em vez de anunciar sucesso",async()=>{const f=fixture();portas.evento.mockImplementation(async()=>{f.u.ativo=false;});await expect(executar(f)).rejects.toThrow();expect(portas.evento).toHaveBeenCalledOnce();});
it("362 CAS perdido mantém recusa de domínio e não cria Evento nem aviso",async()=>{const f=fixture();f.tx.intencaoMensagem.updateMany.mockResolvedValue({count:0});await expect(executar(f)).rejects.toBeInstanceOf(ErroRegra);expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledOnce();expect(portas.evento).not.toHaveBeenCalled();expect(portas.aviso).not.toHaveBeenCalled();});
it("333 vendedor próprio continua cancelando sem responsável geral",async()=>{const f=fixture();f.u.papeis=[Papel.VENDEDOR];f.a.responsavelId=null;await expect(executar(f)).resolves.toBeUndefined();expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledOnce();});
it("333 Admin continua cancelando IA mesmo de outro autor sem Assumir",async()=>{const f=fixture();f.u.papeis=[Papel.ADMINISTRADOR];f.m.origem="IA";f.m.autorId="outro";f.a.responsavelId=null;await expect(executar(f)).resolves.toBeUndefined();});
it("362 professor autor responsável não recebe exceção GP",async()=>{const f=fixture();f.u.papeis=[Papel.PROFESSOR];await expect(executar(f)).rejects.toThrow();semEscrita(f);});
it("362 locks permanecem pai SHARE antes de Intencao FOR UPDATE",async()=>{const f=fixture();f.u.papeis=[Papel.VENDEDOR];await executar(f);const sql=f.tx.$queryRaw.mock.calls.map(([q])=>Array.isArray(q)?q.join("?"):"");expect(sql[0]).toMatch(/AtendimentoWhatsApp.*FOR SHARE/);expect(sql[1]).toMatch(/IntencaoMensagem.*FOR UPDATE/);expect(f.banco.$transaction).toHaveBeenCalledOnce();});

it("362 revogação após await do CAS recusa e não avisa sucesso",async()=>{const f=fixture();f.tx.intencaoMensagem.updateMany.mockImplementation(async()=>{f.u.ativo=false;return {count:1};});await expect(executar(f)).rejects.toThrow();expect(f.tx.intencaoMensagem.updateMany).toHaveBeenCalledOnce();expect(portas.aviso).not.toHaveBeenCalled();});
it("362 revogação durante aviso transacional ainda recusa antes do commit",async()=>{const f=fixture();portas.aviso.mockImplementation(async()=>{f.a.responsavelId=null;});await expect(executar(f)).rejects.toThrow();expect(portas.aviso).toHaveBeenCalledOnce();});
