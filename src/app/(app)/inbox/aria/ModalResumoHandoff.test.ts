import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
import { ModalResumoHandoff } from "./ModalResumoHandoff";
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: vi.fn() }));
const handoff: HandoffDoAtendimento = { acaoId: "h1", pedidoEm: "2026-10-25T11:56:00Z", motivo: "VALOR", motivoTexto: "Valor alto", destino: "FILA_SETOR", responsavelNome: null, resumo: { quer: "Quer 15% para 12 matrículas", proximoPasso: "Ligar hoje" }, feito: [{ texto: "Adicionou a tag Quente", quando: "2026-10-25T11:50:00Z" }], podeAssumir: true, ehResponsavel: false };
const montar = (o: Partial<HandoffDoAtendimento> = {}) => renderToStaticMarkup(createElement(ModalResumoHandoff, { atendimentoId: "A", contatoNome: "Grupo Ventura", handoff: { ...handoff, ...o }, fuso: "UTC", aoFechar() { }, aoAssumido() { }, aoResponder() { } }));
it("secoes_em_sentence_case", () => { const h = montar(); for (const t of ["Resumo de handoff", "Preparado pela Aria · Grupo Ventura", "O que o contato quer", "O que a Aria já fez", "Próxima ação sugerida", "Quer 15% para 12 matrículas", "Adicionou a tag Quente", "Ligar hoje", "11:50"])
    expect(h).toContain(t); expect(h).not.toContain("uppercase"); expect(h).toContain('role="dialog"'); });
it("botoes_por_alcada", () => { expect(montar()).toContain("Assumir e responder"); expect(montar()).toContain("Cancelar"); expect(montar({ podeAssumir: false, ehResponsavel: true })).toContain(">Responder<"); const h = montar({ podeAssumir: false }); expect(h).toContain(">Fechar<"); expect(h).not.toMatch(/>Cancelar<|Assumir e responder|>Responder</); });
it("resumo_nulo_e_feito_vazio", () => { const h = montar({ resumo: null, feito: [] }); expect(h).toContain("A Aria não deixou resumo."); expect(h).toContain("Nenhuma ação registrada."); expect(h).not.toContain("Próxima ação sugerida"); });
it("abertura invalidada preserva resumo e mostra somente Fechar mesmo com capacidades devolvidas",()=>{
 const html=renderToStaticMarkup(createElement(ModalResumoHandoff,{atendimentoId:"a",contatoNome:"Ana",handoff:{...handoff,podeAssumir:true,ehResponsavel:true},fuso:"UTC",sessaoInvalidada:true,contextoAtivo:false,erroConfirmacao:"falha",aoTentarConfirmar(){},aoFechar(){},aoAssumido(){},aoResponder(){}}));
 expect(html).toContain("Feche e abra o resumo novamente");expect(html).toContain(">Fechar<");expect(html).not.toContain("Assumir e responder");expect(html).not.toContain(">Responder<");expect(html).not.toContain("Tentar de novo");
});
it("snapshot em confirmação não autoriza novo assumir nem Responder, mas permite cancelar e retry de leitura",()=>{
 const html=renderToStaticMarkup(createElement(ModalResumoHandoff,{atendimentoId:"a",contatoNome:"Ana",handoff:{...handoff,podeAssumir:true,ehResponsavel:true},fuso:"UTC",confirmacaoPendente:true,confirmando:false,erroConfirmacao:"Não foi possível atualizar",aoTentarConfirmar(){},aoFechar(){},aoAssumido(){},aoResponder(){}}));
 expect(html).toContain("Quer 15% para 12 matrículas");expect(html).toContain(">Cancelar<");expect(html).toContain("Tentar de novo");expect(html).not.toContain("Assumir e responder");expect(html).not.toContain(">Responder<");expect(html).not.toContain("Atualizando a conversa…");
});
