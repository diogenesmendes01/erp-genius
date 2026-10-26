import {beforeEach,expect,it,vi} from "vitest";
import {Papel} from "@prisma/client";
import {ErroAutenticacao,ErroRegra} from "@/server/_shared/sessao";
const m=vi.hoisted(()=>({sessao:vi.fn(),core:vi.fn(),revalidar:vi.fn(),legado:vi.fn(),cancelCRM:vi.fn(),cancelInbox:vi.fn(),visivel:vi.fn(),db:{$transaction:vi.fn(),atendimentoWhatsApp:{findUnique:vi.fn()},intencaoMensagem:{findFirst:vi.fn()}}}));
vi.mock("@/lib/prisma",()=>({prisma:m.db}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidar}));
vi.mock("@/server/_shared",async()=>{const resultado=await import("@/server/_shared/resultado");const sessao=await import("@/server/_shared/sessao");const validacao=await import("@/server/_shared/validacao");return {...resultado,...sessao,...validacao,exigirSessao:m.sessao,registrarEvento:vi.fn()};});
vi.mock("@/server/inbox/agendadas-operacao-inbox",()=>({executarAgendadaInbox:m.core}));
vi.mock("@/server/crm/mensagens-agendadas",()=>({agendarMensagem:m.legado,cancelarMensagemAgendada:m.cancelCRM}));
vi.mock("./atendimentos",()=>({atendimentoVisivel:m.visivel}));
vi.mock("./despachante",()=>({despacharFila:vi.fn()}));
vi.mock("./midia",()=>({copiarMidiaParaSaida:vi.fn()}));
vi.mock("./notas-consulta",()=>({notasInternasDoAtendimento:vi.fn()}));
vi.mock("@/server/inbox/mencoes",()=>({notificarMencoesNaNota:vi.fn()}));
vi.mock("@/server/inbox/barramento",()=>({avisarAtendimentoAtualizado:vi.fn()}));
vi.mock("@/server/inbox/agendadas-cancelamento",()=>({cancelarAgendadaInboxTx:m.cancelInbox}));
import * as acoes from "./acoes-conversa";
type Saida={ok:boolean;dado?:{id:string};erro?:string};
function acao(nome:string){const fn=(acoes as unknown as Record<string,(input:unknown)=>Promise<Saida>>)[nome];expect(fn,`export público ${nome}`).toBeTypeOf("function");return fn!;}
beforeEach(()=>{vi.resetAllMocks();m.sessao.mockResolvedValue({id:"ator",nome:"Fictício",papeis:[Papel.VENDEDOR],permissoes:[]});m.core.mockResolvedValue({id:"nova"});m.cancelInbox.mockResolvedValue(undefined);m.cancelCRM.mockResolvedValue({ok:false,erro:"Você não tem acesso a esta função do CRM."});m.db.intencaoMensagem.findFirst.mockResolvedValue({id:"i"});m.legado.mockResolvedValue({ok:true,dado:{id:"antiga"}});m.visivel.mockResolvedValue({id:"a",numeroId:"n",encerradoEm:null});});
const entrada={atendimentoId:"a",texto:"Fictício",quando:"2035-01-02T16:00:00.000Z",chaveIdempotencia:"tentativa-publica-362"};
it("CRIAR público delega ao núcleo com ator da sessão e número resolvido internamente",async()=>{
 expect(await acoes.agendarMensagemNoAtendimento(entrada)).toEqual({ok:true,dado:{id:"nova"}});
 expect(m.core).toHaveBeenCalledExactlyOnceWith(m.db,"ator",{tipo:"CRIAR",atendimentoId:"a",texto:"Fictício",agendadaPara:entrada.quando,chaveIdempotencia:entrada.chaveIdempotencia});
 expect(m.db.$transaction).not.toHaveBeenCalled();expect(m.legado).not.toHaveBeenCalled();expect(m.visivel).not.toHaveBeenCalled();
 expect(m.revalidar.mock.calls.map(([path])=>path).sort()).toEqual(["/inbox","/inicio","/tarefas"].sort());
});
it("CRIAR Local mantém conversão canônica do fuso informado",async()=>{
 expect((await acoes.agendarMensagemNoAtendimentoLocal({atendimentoId:"a",texto:"Local",quandoLocal:"2035-01-02T10:00",fuso:"America/Costa_Rica"})).ok).toBe(true);
 expect(m.core).toHaveBeenCalledWith(m.db,"ator",expect.objectContaining({tipo:"CRIAR",agendadaPara:"2035-01-02T16:00:00.000Z"}));
});
it("reagendar público converte local no servidor e delega intenção/ator selecionados",async()=>{
 expect(await acao("reagendarAgendamentoDoAtendimento")({atendimentoId:"a",intencaoId:"i",quandoLocal:"2035-01-02T10:00",fuso:"America/Sao_Paulo",chaveIdempotencia:"reagendar-publica-362"})).toEqual({ok:true,dado:{id:"nova"}});
 expect(m.core).toHaveBeenCalledExactlyOnceWith(m.db,"ator",{tipo:"REAGENDAR",atendimentoId:"a",intencaoId:"i",agendadaPara:"2035-01-02T13:00:00.000Z",chaveIdempotencia:"reagendar-publica-362"});expect(m.db.$transaction).not.toHaveBeenCalled();
});
it("enviar agora público delega sem relógio ou dispatch no wrapper",async()=>{
 expect(await acao("enviarAgendamentoAgoraDoAtendimento")({atendimentoId:"a",intencaoId:"i",chaveIdempotencia:"enviar-publica-362"})).toEqual({ok:true,dado:{id:"nova"}});
 expect(m.core).toHaveBeenCalledExactlyOnceWith(m.db,"ator",{tipo:"ENVIAR_AGORA",atendimentoId:"a",intencaoId:"i",chaveIdempotencia:"enviar-publica-362"});expect(m.db.$transaction).not.toHaveBeenCalled();
});
it("horário DST pulado/repetido e fuso inválido recusam antes do núcleo",async()=>{
 for(const input of [{quandoLocal:"2026-03-08T02:30",fuso:"America/New_York"},{quandoLocal:"2026-11-01T01:30",fuso:"America/New_York"},{quandoLocal:"2035-01-02T10:00",fuso:"Fuso/Ficticio"}]){const r=await acao("reagendarAgendamentoDoAtendimento")({atendimentoId:"a",intencaoId:"i",...input});expect(r.ok).toBe(false);}
 expect(m.core).not.toHaveBeenCalled();expect(m.revalidar).not.toHaveBeenCalled();
});
it("erro de domínio do núcleo preserva Resultado e não revalida",async()=>{
 m.core.mockRejectedValue(new ErroRegra("Assuma a conversa para alterar a mensagem agendada."));
 expect(await acoes.agendarMensagemNoAtendimento(entrada)).toEqual({ok:false,erro:"Assuma a conversa para alterar a mensagem agendada."});expect(m.revalidar).not.toHaveBeenCalled();
});
it("sessão ausente impede delegação",async()=>{
 m.sessao.mockRejectedValue(new ErroAutenticacao());expect(await acao("enviarAgendamentoAgoraDoAtendimento")({atendimentoId:"a",intencaoId:"i"})).toEqual({ok:false,erro:"Não autenticado."});expect(m.core).not.toHaveBeenCalled();expect(m.revalidar).not.toHaveBeenCalled();
});
it("revalida somente depois que o núcleo confirmou commit",async()=>{
 let liberar!:(value:{id:string})=>void;const pronto=new Promise<{id:string}>(r=>liberar=r);m.core.mockReturnValue(pronto);
 const pending=acoes.agendarMensagemNoAtendimento(entrada);
 try{await vi.waitFor(()=>expect(m.core).toHaveBeenCalledTimes(1));expect(m.revalidar).not.toHaveBeenCalled();}finally{liberar({id:"nova"});await pending;}
 expect(m.revalidar).toHaveBeenCalledTimes(3);
});
it("campos extras do cliente não substituem ator ou autorização interna",async()=>{
 await acao("agendarMensagemNoAtendimento")({...entrada,autorId:"intruso",numeroEsperado:"externo",autorizadoEnviar:true,responsavelId:"intruso"});
 expect(m.core).toHaveBeenCalledExactlyOnceWith(m.db,"ator",{tipo:"CRIAR",atendimentoId:"a",texto:"Fictício",agendadaPara:entrada.quando,chaveIdempotencia:entrada.chaveIdempotencia});
});

it("362 cancelar GP público usa núcleo Inbox e nunca relaxa API CRM global",async()=>{
 m.sessao.mockResolvedValue({id:"gp",nome:"GP fictício",papeis:[Papel.GERENTE_PEDAGOGICO]});
 expect(await acoes.cancelarAgendamentoDoAtendimento({atendimentoId:"a",intencaoId:"i"})).toEqual({ok:true});
 expect(m.cancelInbox).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id:"gp"}),"a","i");
 expect(m.cancelCRM).not.toHaveBeenCalled();expect(m.revalidar).toHaveBeenCalledWith("/inbox");
});
it("362 cancel GP com erro do núcleo não usa fallback CRM nem revalida",async()=>{
 m.sessao.mockResolvedValue({id:"gp",nome:"GP fictício",papeis:[Papel.GERENTE_PEDAGOGICO]});
 m.cancelInbox.mockRejectedValue(new ErroRegra("Mensagem agendada não encontrada ou sem permissão para cancelar."));
 expect(await acoes.cancelarAgendamentoDoAtendimento({atendimentoId:"a",intencaoId:"i"})).toEqual({ok:false,erro:"Mensagem agendada não encontrada ou sem permissão para cancelar."});
 expect(m.cancelInbox).toHaveBeenCalledOnce();expect(m.cancelCRM).not.toHaveBeenCalled();expect(m.revalidar).not.toHaveBeenCalled();
});
it("362 demais perfis preservam caminho CRM anterior no wrapper legado",async()=>{
 m.cancelCRM.mockResolvedValue({ok:true});
 expect(await acoes.cancelarAgendamentoDoAtendimento({atendimentoId:"a",intencaoId:"i"})).toEqual({ok:true});
 expect(m.cancelCRM).toHaveBeenCalledExactlyOnceWith("i");expect(m.cancelInbox).not.toHaveBeenCalled();
});
it("362 papel GP combinado com Admin mantém default CRM anterior no wrapper",async()=>{
 m.sessao.mockResolvedValue({id:"admin",nome:"Admin GP fictício",papeis:[Papel.ADMINISTRADOR,Papel.GERENTE_PEDAGOGICO]});m.cancelCRM.mockResolvedValue({ok:true});
 expect(await acoes.cancelarAgendamentoDoAtendimento({atendimentoId:"a",intencaoId:"i"})).toEqual({ok:true});expect(m.cancelCRM).toHaveBeenCalledExactlyOnceWith("i");expect(m.cancelInbox).not.toHaveBeenCalled();
});