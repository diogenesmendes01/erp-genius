import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({ordem:[] as string[],lead:vi.fn(),tarefas:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{}}));
vi.mock("@/server/_shared/escopo-comercial",()=>({escopoComercialAtual:async()=>({})}));
vi.mock("@/server/whatsapp/escopo",()=>({escopoAtendimentos:async()=>({})}));
vi.mock("@/server/whatsapp/consultas-inbox",()=>({podeVerLeadNaThread:m.lead}));
vi.mock("@/server/operacao/relogio",()=>({carregarFusoInstitucionalTx:async()=>"America/Sao_Paulo"}));
vi.mock("./painel-tarefas",()=>({carregarTarefasDoAtendimento:m.tarefas}));
import {carregarOportunidadesPainel} from "./painel-oportunidades";
import type {Db} from "@/server/whatsapp/escopo";
import type {TarefaPainel} from "./painel-tarefas";
const u={id:"u436",nome:"Pessoa fictícia",papeis:["VENDEDOR" as const]};
const direta:TarefaPainel={id:"t436",versao:1,titulo:"Direta436",descricao:null,tipo:"OUTRO",status:"ABERTA",prioridade:"NORMAL",dataCivil:null,hora:null,fusoOrigem:"America/Sao_Paulo",lembreteAntecedenciaMin:null,responsavel:null,atrasada:false,ia:false,leadId:null,atendimentoId:"a436",criadoEm:"2026-10-25T12:00:00Z",criadorNome:null,podeAgir:true};
beforeEach(()=>{vi.clearAllMocks();m.ordem.length=0;m.lead.mockImplementation(async()=>{m.ordem.push("lead");return true;});m.tarefas.mockImplementation(async()=>{m.ordem.push("tarefas");return[direta];});});
function banco(leadId:string|null="op436"){
 const b={atendimentoWhatsApp:{findFirst:vi.fn(async()=>({id:"a436",finalidade:"COMERCIAL",leadId,conversa:{contatoId:"c436"}}))},usuario:{findMany:vi.fn(async()=>[])},oportunidade:{findUnique:vi.fn(async()=>({id:"op436",nome:"Curso436",pessoaId:null,planoPrevisto:null,valorPrevisto:null,etapa:"NOVO",temperatura:"MORNO",motivoPerda:null,dataExperimental:null,experimentalConfirmadaEm:null,professorExperimentalId:null,pais:null,vendedor:null,professorExperimental:null})),findFirst:vi.fn(async():Promise<{id:string}|null>=>({id:"op436"})),findMany:vi.fn(async()=>[])}};
 return{b,db:b as unknown as Db};
}
it("calcula alçada do lead antes da consulta independente de tarefas",async()=>{
 const {db}=banco();const r=await carregarOportunidadesPainel(u,"a436",db);expect(m.ordem).toEqual(["lead","tarefas"]);expect(r?.atual?.id).toBe("op436");expect(r?.tarefas).toEqual([direta]);
});
it("lead oculto não remove tarefas que têm ACL própria",async()=>{
 m.lead.mockImplementation(async()=>{m.ordem.push("lead");return false;});const {b,db}=banco();const r=await carregarOportunidadesPainel(u,"a436",db);expect(m.ordem).toEqual(["lead","tarefas"]);expect(b.oportunidade.findUnique).not.toHaveBeenCalled();expect(r?.atual).toBeNull();expect(r?.tarefas).toEqual([direta]);
});
it("sem lead mantém vínculo direto, sem inventar uma checagem comercial",async()=>{
 const {db}=banco(null);const r=await carregarOportunidadesPainel(u,"a436",db);expect(m.lead).not.toHaveBeenCalled();expect(m.ordem).toEqual(["tarefas"]);expect(r?.tarefas).toEqual([direta]);
});it("convite de Professor permite leitura mas não edição da previsão",async()=>{
 const {b,db}=banco();const r=await carregarOportunidadesPainel({...u,papeis:["PROFESSOR"]},"a436",db);
 expect(r?.atual?.podeEditarPrevisao).toBe(false);expect(b.oportunidade.findFirst).not.toHaveBeenCalled();
});
it("carteira excluída impede edição mesmo para Vendedor com leitura contextual",async()=>{
 const {b,db}=banco();b.oportunidade.findFirst.mockResolvedValueOnce(null);
 const r=await carregarOportunidadesPainel(u,"a436",db);expect(r?.atual?.podeEditarPrevisao).toBe(false);
});