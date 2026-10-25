import { describe, expect, it } from "vitest";
import { detalheDaSugestao } from "./sugestoes-thread";
describe("detalhe tipado da sugestao", () => {
  it.each([
    ["RESPONDER", { texto: "Oi", documentoId: null }, { tipo: "enviar", documento: false }],
    ["ENVIAR_DOCUMENTO", { texto: "", documentoId: "d1" }, { tipo: "enviar", documento: true }],
    ["AGENDAR_MENSAGEM", { agendadaPara: "2026-10-24T12:00:00.000Z" }, { tipo: "agendar", agendadaPara: "2026-10-24T12:00:00.000Z" }],
    ["MOVER_ETAPA", { para: "QUALIFICADO" }, { tipo: "etapa", para: "QUALIFICADO" }],
    ["CRIAR_TAREFA", { titulo: "Ligar", venceEmISO: "2026-10-24T12:00:00.000Z" }, { tipo: "tarefa", titulo: "Ligar", venceEm: "2026-10-24T12:00:00.000Z" }],
    ["TAG", { nome: "Quente" }, { tipo: "tag", nome: "Quente" }],
    ["ATUALIZAR_CAMPO", { nomeCampo: "objetivo", para: "viajar" }, { tipo: "campo", nome: "objetivo", valor: "viajar" }],
    ["ATUALIZAR_CAMPO", { nomeCampo: "numero", para: 0 }, { tipo: "campo", nome: "numero", valor: "0" }],
    ["ATUALIZAR_CAMPO", { nomeCampo: "bool", para: false }, { tipo: "campo", nome: "bool", valor: "false" }],
    ["ATUALIZAR_CAMPO", { nomeCampo: "limpar", para: null }, { tipo: "campo", nome: "limpar", valor: "" }],
    ["MARCAR_PERDIDO", { motivoPerda: "Sem interesse" }, { tipo: "perdido", motivo: "Sem interesse" }],
    ["NOTA_INTERNA", { texto: "Ficticio" }, { tipo: "nota" }],
    ["CONDICAO_COMERCIAL", { descontoPct: 0, parcelas: 1 }, { tipo: "condicao", descontoPct: 0, parcelas: 1 }],
    ["HANDOFF", {}, { tipo: "outro" }],
    ["CLASSIFICAR_SETOR", {}, { tipo: "outro" }],
  ] as const)("decodifica %s", (acao, payload, esperado) => expect(detalheDaSugestao(acao, payload)).toEqual(esperado));
  it.each([null, [], "texto", 2, false, {}, { para: "INEXISTENTE" }])("payload sem etapa valida: %j", payload => expect(detalheDaSugestao("MOVER_ETAPA", payload)).toEqual({ tipo: "outro" }));
  it("datas, campos objeto e numeros invalidos nao viram detalhes confiaveis", () => {
    expect(detalheDaSugestao("AGENDAR_MENSAGEM", { agendadaPara: "invalida" })).toEqual({ tipo: "outro" });
    expect(detalheDaSugestao("CRIAR_TAREFA", { titulo: "Ligar", venceEmISO: "invalida" })).toEqual({ tipo: "outro" });
    expect(detalheDaSugestao("ATUALIZAR_CAMPO", { nomeCampo: "x", para: { segredo: "raw" } })).toEqual({ tipo: "outro" });
    expect(detalheDaSugestao("CONDICAO_COMERCIAL", { descontoPct: NaN, parcelas: 1 })).toEqual({ tipo: "outro" });
  });
});
