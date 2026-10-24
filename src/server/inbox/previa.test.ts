import { describe, expect, it } from "vitest";
import type { OrigemEnvio } from "@prisma/client";
import { autorDaPrevia } from "./previa";
const em = new Date("2026-10-24T12:00:00Z");
const mensagem = (o: Partial<NonNullable<Parameters<typeof autorDaPrevia>[0]>> = {}) => ({ direcao: "SAIDA" as const, origem: "HUMANO" as const, autorId: "u2", autorNome: "Camila Souza", criadoEm: em, ...o });
describe("autoria da previa, prioridade literal", () => {
  it("sem mensagem/entrada nao atribui autor", () => {
    expect(autorDaPrevia(null, null, "u1")).toEqual({ autor: null, rotulo: null });
    expect(autorDaPrevia(mensagem({ direcao: "ENTRADA", origem: "IA", autorId: "u1" }), null, "u1")).toEqual({ autor: null, rotulo: null });
  });
  it("IA vence autor proprio; humano proprio nao depende de nome", () => {
    expect(autorDaPrevia(mensagem({ origem: "IA", autorId: "u1" }), null, "u1")).toEqual({ autor: "aria", rotulo: null });
    expect(autorDaPrevia(mensagem({ autorId: "u1", autorNome: null }), null, "u1")).toEqual({ autor: "voce", rotulo: null });
  });
  it.each(["HUMANO", "CELULAR"] as const)("outro %s mostra somente primeiro nome", origem => {
    expect(autorDaPrevia(mensagem({ origem, autorNome: "  Camila   Souza " }), null, "u1")).toEqual({ autor: "pessoa", rotulo: "Camila" });
    expect(autorDaPrevia(mensagem({ origem, autorNome: "  " }), null, "u1")).toEqual({ autor: null, rotulo: null });
    expect(autorDaPrevia(mensagem({ origem, autorId: null, autorNome: null }), null, "u1")).toEqual({ autor: null, rotulo: null });
  });
  it.each(["CRON", "LOTE", "GESTAO"] as OrigemEnvio[])("automatico %s: proprio vence; demais nao mostram autor", origem => {
    expect(autorDaPrevia(mensagem({ origem, autorId: "u1" }), null, "u1")).toEqual({ autor: "voce", rotulo: null });
    expect(autorDaPrevia(mensagem({ origem }), null, "u1")).toEqual({ autor: null, rotulo: null });
    expect(autorDaPrevia(mensagem({ origem, autorId: null, autorNome: null }), null, "u1")).toEqual({ autor: null, rotulo: null });
  });
  it("previa_de_sugestao_mostra_so_o_rotulo; apenas mais nova vence", () => {
    const sugestao = { acao: "RESPONDER" as const, criadoEm: new Date(em.getTime() + 1) };
    const frozen = Object.freeze(mensagem());
    expect(autorDaPrevia(frozen, sugestao, "u1")).toEqual({ autor: "sugestao", rotulo: "Responder" });
    expect(autorDaPrevia(null, sugestao, "u1")).toEqual({ autor: "sugestao", rotulo: "Responder" });
    expect(autorDaPrevia(mensagem({ criadoEm: sugestao.criadoEm }), sugestao, "u1")).toEqual({ autor: "pessoa", rotulo: "Camila" });
    expect(autorDaPrevia(mensagem({ criadoEm: new Date(em.getTime() + 2) }), sugestao, "u1")).toEqual({ autor: "pessoa", rotulo: "Camila" });
  });
  it("sugestao posterior vence entrada; anterior nao mascara mensagem", () => {
    expect(autorDaPrevia(mensagem({ direcao: "ENTRADA" }), { acao: "NOTA_INTERNA", criadoEm: new Date(em.getTime() + 1) }, "u1")).toEqual({ autor: "sugestao", rotulo: "Nota interna" });
    expect(autorDaPrevia(mensagem(), { acao: "HANDOFF", criadoEm: new Date(em.getTime() - 1) }, "u1")).toEqual({ autor: "pessoa", rotulo: "Camila" });
  });
});
