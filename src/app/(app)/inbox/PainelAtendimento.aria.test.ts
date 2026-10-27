import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BalaoMensagem } from "@/components/conversa/BalaoMensagem";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { textoPausaAria, linhaEstadoAria } from "./aria/textos-aria";
import { BotaoDevolverAria } from "./aria/BotaoDevolverAria";
import { CartaoSugestaoAria } from "./aria/CartaoSugestaoAria";
vi.mock("@/server/aria/acoes",()=>({devolverParaAria:vi.fn(),aprovarSugestaoNoInbox:vi.fn(),rejeitarSugestaoNoInbox:vi.fn()}));
const sug:SugestaoAriaThread={id:"s1",turnoId:"t1",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-18T14:00:00Z",expiraEm:"2026-10-18T15:00:00Z",justificativa:null,texto:"Oi, posso ajudar com a matrícula.",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
const msgIA:MensagemThread={id:"m1",direcao:"SAIDA",tipo:"TEXTO",corpo:"Olá",midiaPath:null,status:"ENVIADA",origem:"IA",autorNome:null,templateNome:null,criadoEm:"2026-10-17T15:30:00Z",participanteNome:null,favorita:false,clientMessageId:null};
describe("353: Aria no cabeçalho e na thread, sem painel duplicado",()=>{
 it.each([["CELULAR","Aria pausada · Resposta pelo celular"],["HUMANO_RESPONDEU","Aria pausada · Humano respondeu no ERP"],[null,"Aria pausada"]] as const)("motivo de pausa continua no texto e dica do cabeçalho: %s",(motivo,dica)=>{
  expect(textoPausaAria(motivo)).toBe(dica);expect(linhaEstadoAria("humano",{atendidoPorVoce:true,responsavelNome:"Ana",podeDecidir:false,pausada:true,motivo})?.dica).toBe(dica);
  const h=renderToStaticMarkup(createElement(BotaoDevolverAria,{atendimentoId:"a1",dica,aoMudar(){}}));expect(h).toContain('title="'+dica+'"');expect(h).toContain('aria-label="Devolver para Aria"');
 });
 it("cartão pendente conserva resumo e aprovar/rejeitar fora do painel",()=>{
  const h=renderToStaticMarkup(createElement(CartaoSugestaoAria,{atendimentoId:"a1",s:sug,usuarioId:"u1",fuso:"UTC",aoDecidir(){}}));expect(h).toContain(sug.texto);expect(h).toContain("Aprovar e enviar");expect(h).toContain("Rejeitar");expect(h).not.toContain("Devolver para Aria");
 });
 it("cartão decidido conserva histórico sem ação",()=>{
  const h=renderToStaticMarkup(createElement(CartaoSugestaoAria,{atendimentoId:"a1",s:{...sug,status:"APROVADA",decididaEm:"2026-10-18T14:20Z",decididaPorId:"u1"},usuarioId:"u1",fuso:"UTC",aoDecidir(){}}));expect(h).toContain("Aprovado por você");expect(h).not.toContain("<button");
 });
 it("mensagem_da_aria_identificada",()=>{const h=renderToStaticMarkup(createElement(BalaoMensagem,{m:msgIA,fuso:null,aoComando(){},recursos:()=>true}));expect(h).toContain("Aria");});
});
