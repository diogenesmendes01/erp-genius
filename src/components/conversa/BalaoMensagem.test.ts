import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { BalaoMensagem } from "./BalaoMensagem";
import { CartaoPix } from "./CartaoPix";
import { EnqueteLeitura } from "./EnqueteLeitura";
import { AVISO_RECURSO_MOTOR, type RecursoMotor } from "./recursos-canal";

const base: MensagemThread = {
  id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENVIADA", origem: "HUMANO",
  autorNome: null, templateNome: null, criadoEm: "2026-10-17T15:30:00.000Z", participanteNome: null, favorita: false, clientMessageId: null,
};
function html(p: Partial<MensagemThread>, o: { menuAberto?: boolean; recursos?: (r: RecursoMotor) => boolean } = {}) {
  return renderToStaticMarkup(createElement(BalaoMensagem, {
    m: { ...base, ...p }, fuso: "America/Sao_Paulo", aoComando: () => {}, recursos: o.recursos ?? (() => false), menuAberto: o.menuAberto,
  }));
}

describe("BalaoMensagem", () => {
  it("autor de cada mensagem", () => {
    expect(html({ origem: "CELULAR", direcao: "SAIDA" })).toContain("Enviada pelo celular");
    expect(html({ origem: "IA", direcao: "SAIDA" })).toContain("Aria");
    expect(html({ origem: "HUMANO", autorNome: "Camila", direcao: "SAIDA" })).toContain("Camila");
    expect(html({ origem: "CRON", direcao: "SAIDA" })).toContain("Sistema");
    expect(html({ direcao: "ENTRADA", origem: null, participanteNome: "Pai do João" })).toContain("Pai do João");
  });
  it("status FALHOU aparece como erro, não como ✓✓", () => { expect(html({ status: "FALHOU", direcao: "SAIDA" })).toContain("Não enviada"); });
  it("editar/apagar/reagir desabilitados com o aviso do motor", () => {
    const h = html({ direcao: "SAIDA" }, { menuAberto: true });
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Editar", "Apagar", "Reagir"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=\"\"[^>]*>(?:(?!</button>).)*${r}`));
  });
  it("com o recurso disponível os itens ficam habilitados e sem aviso", () => {
    const h = html({ direcao: "SAIDA" }, { menuAberto: true, recursos: () => true });
    expect(h).not.toContain(AVISO_RECURSO_MOTOR);
    expect(h).not.toMatch(/<button[^>]* disabled=""/);
  });
  it("menu fechado não mostra itens; horário usa o fuso", () => {
    const h = html({});
    expect(h).not.toContain('role="menu"');
    expect(h).toContain("12:30");
  });
  it("mídia vem de /api/files e não de api do motor", () => {
    const h = html({ tipo: "IMAGEM", midiaPath: "/api/files/a/foto.png", corpo: "legenda" });
    expect(h).toContain('src="/api/files/a/foto.png"');
    expect(h).toContain("legenda");
    expect(html({ tipo: "DOCUMENTO", midiaPath: "/api/files/a/boleto.pdf", corpo: null })).toContain("boleto.pdf");
  });
  it("favorita mostra a estrela e o rótulo do menu muda", () => {
    expect(html({ favorita: true }, { menuAberto: true })).toContain("Remover dos favoritos");
  });
});

describe("EnqueteLeitura e CartaoPix", () => {
  it("enquete só mostra totais, sem controle de voto", () => {
    const h = renderToStaticMarkup(createElement(EnqueteLeitura, { enquete: { nome: "Dia?", selecionavel: 1, opcoes: [{ texto: "Seg", votos: 2 }, { texto: "Ter", votos: 1 }] } }));
    expect(h).toContain("Dia?");
    expect(h).toContain("3 votos");
    expect(h).not.toContain("<button");
  });
  it("pix mostra valor e botão de copiar", () => {
    const h = renderToStaticMarkup(createElement(CartaoPix, { pix: { quantia: "R$ 150,00", solicitante: "Escola", codigoCopiaCola: "000201" } }));
    expect(h).toContain("R$ 150,00");
    expect(h).toContain("Copiar código Pix");
  });
});
