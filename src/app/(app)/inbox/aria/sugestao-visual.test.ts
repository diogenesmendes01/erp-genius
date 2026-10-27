import { describe, expect, it } from "vitest";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL } from "@/lib/labels";
import { visualPacote, visualSugestao } from "./sugestao-visual";
const s = (o: Partial<SugestaoAriaThread> = {}): SugestaoAriaThread => ({ id:"s1", turnoId:"t1", acao:"RESPONDER", status:"SUGERIDA", criadoEm:"2026-10-23T13:42:00Z", expiraEm:"2026-10-23T14:42:00Z", justificativa:"Pediu o valor.", texto:"Olá!\nSemestral R$720.", detalhe:{tipo:"enviar",documento:false}, decididaPorId:null, decididaPorNome:null, decididaEm:null, ...o });
const v=(x:SugestaoAriaThread)=>visualSugestao(x,{usuarioId:"u1",fuso:"America/Sao_Paulo"});
describe("visual da sugestão",()=>{
 it("resposta pendente conserva texto e aviso explícito de envio",()=>{ expect(v(s())).toEqual({cabecalho:"Aria sugere · aguardando aprovação",titulo:"Responder ao contato",linhas:[{icone:"enviar",texto:"Enviar a mensagem acima"}],textoProposto:"Olá!\nSemestral R$720.",avisoEnvio:true,rotuloAprovar:"Aprovar e enviar",rotuloRejeitar:"Rejeitar",pendente:true,decidido:null,expira:"Expira às 11:42"}); });
 it("documento também informa envio irreversível sem inventar nome",()=>{ expect(v(s({acao:"ENVIAR_DOCUMENTO",texto:null,detalhe:{tipo:"enviar",documento:true}}))).toMatchObject({titulo:"Enviar documento ao contato",textoProposto:null,avisoEnvio:true}); });
 it("agendamento usa dataHora explícita e rótulos próprios",()=>{ expect(v(s({acao:"AGENDAR_MENSAGEM",detalhe:{tipo:"agendar",agendadaPara:"2026-10-24T12:00:00Z"}}))).toMatchObject({titulo:"Agendar mensagem",linhas:[{icone:"agendar",texto:"Agendar a mensagem acima · 24/10/2026, 09:00"}],rotuloAprovar:"Agendar",rotuloRejeitar:"Ignorar",avisoEnvio:false}); });
 it("etapa usa a fonte única de rótulos",()=>{ const texto="Mover para "+ETAPA_LABEL.QUALIFICADO;expect(v(s({acao:"MOVER_ETAPA",detalhe:{tipo:"etapa",para:"QUALIFICADO"}}))).toMatchObject({titulo:texto,linhas:[{icone:"etapa",texto}],textoProposto:null}); });
 it("tarefa tem título/data sem oferecer edição",()=>{ expect(v(s({acao:"CRIAR_TAREFA",detalhe:{tipo:"tarefa",titulo:"Ligar",venceEm:"2026-10-24T12:00:00Z"}}))).toMatchObject({titulo:"Criar tarefa",linhas:[{icone:"tarefa",texto:"Criar tarefa: Ligar · 24/10/2026, 09:00"}],textoProposto:null}); });
 it.each([ ["tag",{tipo:"tag",nome:"VIP"},"Aplicar a tag VIP","Adicionar a tag VIP"], ["campo",{tipo:"campo",nome:"Ativo",valor:"false"},"Preencher Ativo","Ativo: false"], ["campo",{tipo:"campo",nome:"Saldo",valor:"0"},"Preencher Saldo","Saldo: 0"], ["perdido",{tipo:"perdido",motivo:"Sem horário"},"Marcar como perdido","Motivo: Sem horário"], ["condicao",{tipo:"condicao",descontoPct:0,parcelas:2},"Condição comercial","0% de desconto em 2x"] ] as const)("detalhe %s conserva dados tipados",(icone,detalhe,titulo,texto)=>{expect(v(s({detalhe}))).toMatchObject({titulo,linhas:[{icone,texto}],textoProposto:null,avisoEnvio:false,rotuloAprovar:"Aprovar"});});
 it("nota mantém texto; outro usa label da ação sem payload",()=>{ expect(v(s({acao:"NOTA_INTERNA",detalhe:{tipo:"nota"}}))).toMatchObject({titulo:"Nota interna",textoProposto:s().texto,avisoEnvio:false});expect(v(s({acao:"HANDOFF",detalhe:{tipo:"outro"}}))).toMatchObject({titulo:ACAO_AGENTE_IA_LABEL.HANDOFF,linhas:[],textoProposto:null}); });
 it("aprovação própria ou de primeiro nome e ausência de nome",()=>{const p=s({status:"APROVADA",decididaPorId:"u1",decididaEm:"2026-10-23T13:50:00Z"});expect(v(p).decidido).toEqual({tom:"brand",texto:"Aprovado por você · 10:50"});expect(v({...p,decididaPorId:"u2",decididaPorNome:"  Camila Souza "}).decidido?.texto).toBe("Aprovado por Camila · 10:50");expect(v({...p,decididaPorId:"u2"}).decidido?.texto).toBe("Aprovado · 10:50");});
 it.each([["REJEITADA","Rejeitado"],["EXPIRADA","Expirou"]] as const)("%s é decisão neutra sem aviso/botões nem expiração futura",(status,t)=>{expect(v(s({status,decididaEm:"2026-10-23T13:50:00Z"}))).toMatchObject({cabecalho:"Aria sugeriu",pendente:false,avisoEnvio:false,decidido:{tom:"neutro",texto:t+" · 10:50"},expira:null});expect(v(s({status})).decidido?.texto).toBe(t);});
 it("sem expiração não fabrica relógio; três fusos são explícitos",()=>{expect(v(s({expiraEm:null})).expira).toBeNull();expect(visualSugestao(s(),{usuarioId:"u",fuso:"Asia/Tokyo"}).expira).toBe("Expira às 23:42");for(const fuso of [null,"UTC","invalido"]){expect(visualSugestao(s(),{usuarioId:"u",fuso}).expira).toBe("Expira às 14:42");}});
});
describe("visual do pacote por turno",()=>{
 const pacote=[s(),s({id:"s2",acao:"CRIAR_TAREFA",texto:null,justificativa:null,expiraEm:"2026-10-23T14:12:00Z",detalhe:{tipo:"tarefa",titulo:"Ligar",venceEm:"2026-10-24T12:00:00Z"}}),s({id:"s3",acao:"MOVER_ETAPA",texto:null,detalhe:{tipo:"etapa",para:"QUALIFICADO"}})];
 it("um cartão com N linhas na ordem de aplicação e envio por último",()=>{
  const p=visualPacote(pacote,{usuarioId:"u1",fuso:"America/Sao_Paulo"});
  expect(p.cabecalho).toBe("Aria sugere 3 ações · aguardando aprovação");
  expect(p.itens.map(x=>x.s.id)).toEqual(["s3","s2","s1"]);
  expect(p.itens.map(x=>x.linha.icone)).toEqual(["etapa","tarefa","enviar"]);
  expect(p.titulo).toBe("Mover para "+ETAPA_LABEL.QUALIFICADO+", criar tarefa e responder ao contato");
  expect(p).toMatchObject({justificativa:"Pediu o valor.",avisoEnvio:true,rotuloAprovar:"Aprovar tudo e enviar",rotuloRejeitar:"Rejeitar tudo",expira:"Expira às 11:12"});
 });
 it("sem mensagem não avisa envio e nota ganha linha própria",()=>{
  const p=visualPacote([pacote[2],s({id:"n",acao:"NOTA_INTERNA",detalhe:{tipo:"nota"},expiraEm:null})],{usuarioId:"u1",fuso:"UTC"});
  expect(p).toMatchObject({avisoEnvio:false,rotuloAprovar:"Aprovar tudo"});
  expect(p.itens[1].linha).toEqual({icone:"nota",texto:"Nota interna"});
 });
});
