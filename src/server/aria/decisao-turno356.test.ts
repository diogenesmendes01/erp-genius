import { ErroPermissao, ErroRegra } from "../_shared/sessao";
import type { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const h=vi.hoisted(()=>({alvos:vi.fn(),replay:vi.fn(),aprovar:vi.fn(),rejeitar:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("../whatsapp/escopo",()=>({escopoAtendimentos:vi.fn(async()=>({}))}));
vi.mock("./escopo-decisao-inbox",()=>({acoesDecidiveisNoInbox:h.alvos,pessoaDoPayloadValida:()=>true,usaLeadAtualNaResposta:()=>false}));
vi.mock("@/server/inbox/barramento",()=>({avisarAtendimentoAtualizado:vi.fn()}));
vi.mock("../whatsapp/enfileirar-inbox",()=>({validarDestinoSaidaHumanaInboxTx:vi.fn()}));
vi.mock("./pausa",()=>({pausarAriaComIntencoesTravadasTx:vi.fn()}));
vi.mock("../_shared/idempotencia",async original=>({...await original<object>(),repeticaoIdempotente:h.replay}));
vi.mock("./historico",()=>({aprovarAcaoAriaTx:h.aprovar,rejeitarAcaoAriaTx:h.rejeitar,desfazerAcaoAriaTx:vi.fn()}));
vi.mock("./turno/executor",()=>({aplicarAcao:vi.fn(),urlDocumentoEnviavel:vi.fn()}));
vi.mock("../operacao/relogio",()=>({carregarFusoInstitucionalTx:vi.fn(async()=>"UTC")}));
vi.mock("../whatsapp/janela-agendamento",()=>({exigirAgendamentoNaJanela:vi.fn()}));
import { aprovarTurnoAriaTx, rejeitarTurnoAriaTx } from "./decisao-inbox";

const u={id:"u",ativo:true,papeis:["VENDEDOR"],nome:"v",permissoes:[]};
const a={id:"at",finalidade:"COMERCIAL",responsavelId:"u",leadId:"lead"};
type Acao={id:string;acao:string;status:string;turnoId:string;atendimentoId:string;oportunidadeId:string|null;payload:unknown;expiraEm:null};
const acao=(id:string,tipo:string,o:Partial<Acao>={}):Acao=>({id,acao:tipo,status:"SUGERIDA",turnoId:"t",atendimentoId:"at",oportunidadeId:"lead",payload:{},expiraEm:null,...o});
function fixture(acoes:Acao[],pendentes=acoes.filter(x=>x.status==="SUGERIDA")){
 return {$queryRaw:vi.fn(async()=>[]),$executeRaw:vi.fn(async()=>0),usuario:{findUnique:vi.fn(async()=>u)},
  acaoAgenteIA:{findMany:vi.fn(async(q:{where:{status?:string}})=>q.where.status?pendentes.map(x=>({id:x.id})):acoes)},
  atendimentoWhatsApp:{findFirst:vi.fn(async()=>a)},oportunidade:{findUnique:vi.fn(async()=>({pessoaId:null}))}};
}
const tx=(p:ReturnType<typeof fixture>)=>p as unknown as Prisma.TransactionClient;
const turno=[acao("r","RESPONDER"),acao("e","MOVER_ETAPA"),acao("c","CRIAR_TAREFA")];
const input={turnoId:"t",atendimentoId:"at",acaoIds:["r","e","c"],chaveIdempotencia:"chave-turno-1"};
beforeEach(()=>{Object.values(h).forEach(f=>f.mockReset());h.alvos.mockImplementation(async(_tx:unknown,_u:unknown,_a:unknown,xs:Acao[])=>new Set(xs.map(x=>x.id)));h.replay.mockResolvedValue(null);});

it("aprova_todas_do_turno_na_ordem com a marca de idempotência só na primeira",async()=>{
 const p=fixture(turno);
 expect(await aprovarTurnoAriaTx(tx(p),"u",input)).toBe(3);
 expect(h.aprovar.mock.calls.map(c=>c[1].id)).toEqual(["e","c","r"]);
 expect(h.aprovar.mock.calls[0][3]).toEqual({fusoTarefa:"UTC"});
 expect(h.aprovar.mock.calls[0][4]).toMatchObject({turnoId:"t",chaveIdempotencia:"chave-turno-1",decididasNoTurno:3});
 expect(h.aprovar.mock.calls[1][4]).toEqual({turnoId:"t"});
 expect(h.aprovar.mock.calls[2][4]).toEqual({turnoId:"t"});
});
it("falha_em_uma_desfaz_todas: o erro cita a ação e interrompe o pacote",async()=>{
 const p=fixture(turno);
 h.aprovar.mockImplementation(async(_tx:unknown,x:Acao)=>{if(x.acao==="CRIAR_TAREFA")throw new ErroRegra("Vencimento inválido.");});
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toThrow("Não foi possível criar a tarefa: Vencimento inválido.");
 expect(h.aprovar.mock.calls.map(c=>c[1].id)).toEqual(["e","c"]);
});
it("erro de permissão dentro do pacote continua sendo de permissão",async()=>{
 const p=fixture(turno);
 h.aprovar.mockImplementation(async(_tx:unknown,x:Acao)=>{if(x.acao==="MOVER_ETAPA")throw new ErroPermissao("Sem acesso.");});
 const r=aprovarTurnoAriaTx(tx(p),"u",input);
 await expect(r).rejects.toBeInstanceOf(ErroPermissao);
 await expect(r).rejects.toThrow("Não foi possível mover de etapa: Sem acesso.");
});
it("turno_com_acao_fora_do_escopo_falha_inteiro antes de aplicar qualquer ação",async()=>{
 const p=fixture(turno);
 h.alvos.mockResolvedValue(new Set(["r","c"]));
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toThrow("Não foi possível mover de etapa: esta ação está fora do seu escopo no atendimento.");
 expect(h.aprovar).not.toHaveBeenCalled();
});
it("repetido_com_a_mesma_chave_e_ok sem reaplicar",async()=>{
 const p=fixture(turno.map(x=>({...x,status:"APROVADA"})),[]);
 h.replay.mockResolvedValue({agregadoId:"e",payload:{decididasNoTurno:3}});
 expect(await aprovarTurnoAriaTx(tx(p),"u",input)).toBe(3);
 expect(h.aprovar).not.toHaveBeenCalled();
});
it("repetição continua exigindo escopo atual",async()=>{
 const p=fixture(turno);
 h.replay.mockResolvedValue({agregadoId:"e",payload:{decididasNoTurno:3}});
 h.alvos.mockResolvedValue(new Set());
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toBeInstanceOf(ErroPermissao);
});
it("sugestão já decidida no pacote recusa tudo",async()=>{
 const p=fixture([turno[0],{...turno[1],status:"REJEITADA"},turno[2]]);
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toThrow("Não foi possível mover de etapa: esta sugestão já foi decidida.");
 expect(h.aprovar).not.toHaveBeenCalled();
});
it("pacote diferente do que está pendente no turno pede para reabrir",async()=>{
 const p=fixture(turno,[...turno,acao("n","NOTA_INTERNA")]);
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toThrow("As sugestões deste turno mudaram. Reabra o painel antes de decidir.");
 expect(h.aprovar).not.toHaveBeenCalled();
});
it("ação de outro turno ou atendimento não entra no pacote",async()=>{
 const p=fixture([turno[0],{...turno[1],turnoId:"outro"},turno[2]]);
 await expect(aprovarTurnoAriaTx(tx(p),"u",input)).rejects.toThrow("A sugestão não pertence a este atendimento.");
});
it("trava as ações antes do atendimento",async()=>{
 const p=fixture(turno);const sqls:string[]=[];
 p.$queryRaw.mockImplementation((async(q:unknown)=>{sqls.push(((q as {strings?:string[]}).strings??(q as string[])).join("?"));return [];}) as ()=>Promise<never[]>);
 await aprovarTurnoAriaTx(tx(p),"u",input);
 const acoes=sqls.findIndex(s=>s.includes('"AcaoAgenteIA"')&&s.includes("FOR UPDATE"));
 const pai=sqls.findIndex(s=>s.includes('"AtendimentoWhatsApp"')&&s.includes("FOR NO KEY UPDATE"));
 expect(acoes).toBeGreaterThanOrEqual(0);expect(pai).toBeGreaterThan(acoes);
});
it("rejeitar o turno rejeita todas com o mesmo motivo",async()=>{
 const p=fixture(turno);
 expect(await rejeitarTurnoAriaTx(tx(p),"u",{...input,motivo:"  Não agora  "})).toBe(3);
 expect(h.rejeitar.mock.calls.map(c=>[c[1].id,c[3]])).toEqual([["e","Não agora"],["c","Não agora"],["r","Não agora"]]);
 expect(h.rejeitar.mock.calls[0][4]).toMatchObject({chaveIdempotencia:"chave-turno-1"});
 expect(h.aprovar).not.toHaveBeenCalled();
});
