import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
const p=vi.hoisted(()=>({visivel:vi.fn(),tarefas:vi.fn(),db:{usuario:{findUnique:vi.fn()},intencaoMensagem:{findMany:vi.fn()},atendimentoWhatsApp:{count:vi.fn()}}}));
vi.mock("@/lib/prisma",()=>({prisma:p.db}));
vi.mock("@/server/whatsapp/atendimentos",()=>({atendimentoVisivel:p.visivel}));
vi.mock("@/server/whatsapp/escopo",()=>({escopoAtendimentos:vi.fn().mockResolvedValue({})}));
vi.mock("@/server/whatsapp/notas-consulta",()=>({notasInternasDoAtendimento:vi.fn().mockResolvedValue([])}));
vi.mock("./painel-tarefas",()=>({carregarTarefasDoAtendimento:p.tarefas}));
vi.mock("./painel-atividade-aria",()=>({carregarAriaAtividade:vi.fn().mockResolvedValue({aria:null,alteracoes:[]})}));
import {carregarAtividadePainel} from "./painel-atividade";
beforeEach(()=>vi.clearAllMocks());
function fixture(){
 const u={id:"gp",nome:"GP fictício",papeis:[Papel.GERENTE_PEDAGOGICO] as Papel[],permissoes:[],ativo:true};
 const a={id:"a",responsavelId:"gp" as string|null,contatoId:"c",ultimaMensagemEm:null,encerradoEm:new Date()};
 const m={id:"m",corpoRenderizado:"Fictício",agendadaPara:new Date("2035-01-02T15:00Z"),autorId:"gp",origem:"HUMANO",status:"PENDENTE",passo:null,passoComercial:null,autor:{nome:"GP fictício"}};
 p.db.usuario.findUnique.mockImplementation(async()=>({...u,papeis:[...u.papeis]}));p.visivel.mockImplementation(async()=>({...a}));p.db.intencaoMensagem.findMany.mockImplementation(async()=>[{...m}]);p.db.atendimentoWhatsApp.count.mockResolvedValue(1);p.tarefas.mockResolvedValue([]);
 return {u,a,m};
}
it("362 painel concede cancelarGP próprio com contexto servidor mesmo encerrado e sem CRM",async()=>{const f=fixture();expect((await carregarAtividadePainel(f.u,"a"))?.agendadas[0]?.podeCancelar).toBe(true);expect(p.db.usuario.findUnique).toHaveBeenCalled();});
it.each(["ativo","papel","responsavel","visibilidade","autor","origem"] as const)("362 painel atualiza contexto GP após await de tarefas: %s",async qual=>{const f=fixture();p.tarefas.mockImplementation(async()=>{if(qual==="ativo")f.u.ativo=false;if(qual==="papel")f.u.papeis=[Papel.PROFESSOR];if(qual==="responsavel")f.a.responsavelId=null;if(qual==="visibilidade")p.visivel.mockResolvedValue(null);if(qual==="autor")f.m.autorId="outro";if(qual==="origem")f.m.origem="IA";return [];});const r=await carregarAtividadePainel(f.u,"a");expect(r?.agendadas[0]?.podeCancelar??false).toBe(false);expect(p.db.usuario.findUnique).toHaveBeenCalled();});
