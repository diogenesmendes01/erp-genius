import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { descreverAcaoExecutada } from "./handoff-inbox";
import { ETAPA_LABEL } from "@/lib/labels";
describe("descricao segura das doze acoes", () => {
  it.each([
    ["RESPONDER", { texto: "NAO_VAZAR" }, "Respondeu ao contato"],
    ["ENVIAR_DOCUMENTO", { documentoId: "NAO_VAZAR" }, "Enviou um documento"],
    ["ATUALIZAR_CAMPO", { nomeCampo: "objetivo", para: "viagem" }, "Preencheu objetivo: viagem"],
    ["TAG", { nome: "Quente" }, "Adicionou a tag Quente"],
    ["MOVER_ETAPA", { para: "QUALIFICADO" }, "Moveu para " + ETAPA_LABEL.QUALIFICADO],
    ["MARCAR_PERDIDO", {}, "Marcou como perdido"],
    ["CRIAR_TAREFA", { titulo: "Ligar" }, "Criou tarefa: Ligar"],
    ["AGENDAR_MENSAGEM", {}, "Agendou mensagem"],
    ["NOTA_INTERNA", { texto: "NAO_VAZAR" }, "Escreveu uma nota interna"],
    ["CONDICAO_COMERCIAL", { descontoPct: 25 }, "Ofereceu condição comercial"],
    ["CLASSIFICAR_SETOR", {}, "Classificou o setor"],
    ["HANDOFF", {}, "Pediu um humano"],
  ] as const)("descreve %s", (acao, payload, texto) => expect(descreverAcaoExecutada(acao, payload)).toBe(texto));
  it("preserva zero/false e evita objetos, enum e titulo invalidos", () => {
    expect(descreverAcaoExecutada("ATUALIZAR_CAMPO", { nomeCampo: "n", para: 0 })).toBe("Preencheu n: 0");
    expect(descreverAcaoExecutada("ATUALIZAR_CAMPO", { nomeCampo: "b", para: false })).toBe("Preencheu b: false");
    for (const payload of [null, [], { nomeCampo: "x", para: { secreto: "NAO_VAZAR" } }]) expect(descreverAcaoExecutada("ATUALIZAR_CAMPO", payload)).toBe("Preencheu um campo");
    expect(descreverAcaoExecutada("MOVER_ETAPA", { para: "constructor" })).toBe("Moveu a etapa");
    expect(descreverAcaoExecutada("CRIAR_TAREFA", { titulo: {} })).toBe("Criou uma tarefa");
    expect(descreverAcaoExecutada("TAG", null)).toBe("Adicionou uma tag");
  });
});
