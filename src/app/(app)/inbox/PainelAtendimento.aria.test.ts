import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/aria/pausa", () => ({ devolverParaAria: vi.fn() }));
vi.mock("@/server/aria/historico", () => ({ aprovarAcaoAria: vi.fn(), rejeitarAcaoAria: vi.fn() }));

import { BalaoMensagem } from "@/components/conversa/BalaoMensagem";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { PainelAria } from "./PainelAria";
import type { AriaDoAtendimento } from "@/server/whatsapp/consultas-inbox";

const sug = { id: "s1", acao: "RESPONDER" as const, resumo: "Oi, posso ajudar com a matrícula.", expiraEm: "2026-10-18T15:00:00.000Z" };
const montar = (aria: AriaDoAtendimento) => renderToStaticMarkup(createElement(PainelAria, { atendimentoId: "a1", aria, fuso: null, aoMudar: () => {} }));
const texto = (h: string) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const botao = (h: string, rotulo: string) => new RegExp(`<button[^>]*>${rotulo}</button>`).test(h) || new RegExp(`<button[^>]*aria-label="${rotulo}[^"]*"`).test(h);

const msgIA: MensagemThread = {
  id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENVIADA", origem: "IA",
  autorNome: null, templateNome: null, criadoEm: "2026-10-17T15:30:00.000Z", participanteNome: null, favorita: false, clientMessageId: null,
};

describe("Aria no painel do atendimento (Task 29)", () => {
  it("mostra_motivo_e_devolver", () => {
    const h = montar({ pausada: true, motivo: "CELULAR", podeDevolver: true, sugestoes: [] });
    expect(texto(h)).toContain("Aria pausada · Resposta pelo celular");
    expect(botao(h, "Devolver para Aria")).toBe(true);
  });
  it("sem_escopo_de_envio_ve_a_pausa_sem_devolver", () => {
    // Mesma regra do servidor (devolverParaAria exige o escopo de envio): quem só lê vê a pausa, sem o botão.
    const h = montar({ pausada: true, motivo: "HUMANO_RESPONDEU", podeDevolver: false, sugestoes: [] });
    expect(texto(h)).toContain("Aria pausada");
    expect(h).not.toContain("Devolver para Aria");
  });
  it("pausada_sem_motivo_nao_quebra", () => {
    expect(texto(montar({ pausada: true, motivo: null, podeDevolver: true, sugestoes: [] }))).toContain("Aria pausada");
  });
  it("sugestoes_com_aprovar_e_rejeitar", () => {
    const h = montar({ pausada: false, motivo: null, podeDevolver: false, sugestoes: [sug] });
    expect(botao(h, "Aprovar")).toBe(true);
    expect(botao(h, "Rejeitar")).toBe(true);
    expect(texto(h)).toContain("Oi, posso ajudar com a matrícula.");
    expect(h).not.toContain("Devolver para Aria");
  });
  it("sem_pausa_e_sem_sugestao_nao_mostra_nada", () => {
    expect(montar({ pausada: false, motivo: null, podeDevolver: false, sugestoes: [] })).toBe("");
  });
  it("mensagem_da_aria_identificada", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msgIA, fuso: null, aoComando: () => {}, recursos: () => true }));
    expect(texto(h)).toContain("Aria");
  });
  it("o_painel_do_inbox_monta_o_bloco_da_aria (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/InboxNovo.tsx", "utf8");
    expect(fonte).toMatch(/<PainelAria[\s\S]*?aria=\{painelSetor\.dado\.aria\}/);
  });
});
