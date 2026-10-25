import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
vi.mock("@/server/aria/acoes",()=>({aprovarSugestaoNoInbox:vi.fn(),rejeitarSugestaoNoInbox:vi.fn()}));
import { CartaoSugestaoAria } from "./CartaoSugestaoAria";
const s=(o:Partial<SugestaoAriaThread>={}):SugestaoAriaThread=>({id:"s",turnoId:"t",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-23T13:42Z",expiraEm:"2026-10-23T14:42Z",justificativa:"Motivo contextual",texto:"Olá!\nComo vai?",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null,...o});
const montar=(x=s())=>renderToStaticMarkup(createElement(CartaoSugestaoAria,{atendimentoId:"thread",s:x,usuarioId:"u",fuso:"America/Sao_Paulo",aoDecidir(){}}));
it("pendente mostra motivo/texto/expiração e dois botões sem edição",()=>{const h=montar();for(const texto of ["Aria sugere · aguardando aprovação","Responder ao contato","Motivo contextual","Como vai?","Expira às 11:42","Aprovar e enviar","Rejeitar","Isso será enviado agora no WhatsApp e não poderá ser desfeito."])expect(h).toContain(texto);expect(h.match(/<button/g)).toHaveLength(2);expect(h).not.toMatch(/>Editar|Editar tarefa/);expect(h).not.toContain("<form");expect(h).toContain('type="button"');});
it.each(["APROVADA","REJEITADA","EXPIRADA"] as const)("%s não mostra ação nem aviso de envio",status=>{const h=montar(s({status,decididaPorId:"u",decididaEm:"2026-10-23T13:50Z"}));expect(h).not.toContain("<button");expect(h).not.toContain("não poderá ser desfeito");expect(h).not.toContain("Expira às");expect(h).toContain(status==="APROVADA"?"Aprovado por você · 10:50":status==="REJEITADA"?"Rejeitado · 10:50":"Expirou · 10:50");});
it("escapa conteúdo sem HTML ativo e preserva quebras por estilo",()=>{const h=montar(s({texto:'<script>alert(1)</script>\nSegunda',justificativa:'<img src=x>'}));expect(h).toContain('&lt;script&gt;');expect(h).not.toContain('<script>');expect(h).not.toContain('<img src=');expect(h).toContain('whitespace-pre-wrap');});
it("cartão usa tokens/layout flat e contorno sem duplicar botão",()=>{const h=montar();expect(h).toContain('w-[min(520px,80%)]');expect(h).toContain('ml-auto');expect(h).toContain('rounded-[14px]');expect(h).toContain('border-amber-600');expect(h).toContain('text-red-700');expect(h).toContain('max-sm:min-h-11');expect(h).not.toMatch(/shadow|#[0-9a-f]{3,8}/i);});

it.each([
 [{tipo:"agendar",agendadaPara:"2026-10-24T12:00Z"},"Agendar","Ignorar"],
 [{tipo:"tarefa",titulo:"Ligar",venceEm:"2026-10-24T12:00Z"},"Aprovar","Rejeitar"]
] as const)("rótulos reais da projeção aparecem nos dois botões",(detalhe,aprovar,rejeitar)=>{const h=montar(s({detalhe}));expect(h).toContain('>'+aprovar+'</button>');expect(h).toContain('>'+rejeitar+'</button>');expect(h.match(/<button/g)).toHaveLength(2);});

it.each([["EXECUTADA","Executado"],["DESFEITA","Desfeito por você"]] as const)("estado real %s mantém histórico nominal",(status,texto)=>{
 const h=montar(s({status,podeDecidir:false,podeDesfazer:false,desfeitaPorId:"u",desfeitaEm:"2026-10-23T13:52Z"}));expect(h).toContain(texto);expect(h).not.toContain("Expirou");
});
