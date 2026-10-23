import { describe, expect, it } from "vitest";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { itensDaThread } from "./itens-thread";

const mensagem = (id: string, criadoEm: string): MensagemThread => ({
  id, criadoEm, direcao: "ENTRADA", tipo: "TEXTO", corpo: id, midiaPath: null, status: "RECEBIDA", origem: null,
  autorNome: null, templateNome: null, participanteNome: null, favorita: false, clientMessageId: null,
});
const nota = (id: string, criadoEm: string): NotaInternaThread => ({ id, criadoEm, nota: id, autorNome: "Ana", origem: "atendimento" });

describe("itensDaThread", () => {
  it("nota posterior à janela só aparece quando não há mensagens mais novas fora dela", () => {
    const mensagens = [mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n1", "2026-10-01T11:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, false, true).map((i) => i.id)).toEqual(["m1"]);
    expect(itensDaThread(mensagens, notas, false, false).map((i) => i.id)).toEqual(["m1", "nota:n1"]);
  });

  it("filtra as duas bordas fora de ordem, incluindo notas exatamente nos limites", () => {
    const mensagens = [mensagem("m2", "2026-10-01T12:00:00.000Z"), mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("fora-antes", "2026-10-01T09:00:00.000Z"), nota("inicio", "2026-10-01T10:00:00.000Z"),
      nota("fim", "2026-10-01T12:00:00.000Z"), nota("fora-depois", "2026-10-01T13:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, true).map((i) => i.id)).toEqual(["m1", "nota:inicio", "m2", "nota:fim"]);
  });
  it("intercala por horário e id; mensagem vem antes da nota no empate", () => {
    const t = "2026-10-01T12:00:00.000Z";
    const itens = itensDaThread(
      [mensagem("m2", t), mensagem("m1", "2026-10-01T10:00:00.000Z")],
      [nota("n2", t), nota("n1", "2026-10-01T11:00:00.000Z")], false, false,
    );
    expect(itens.map((i) => i.id)).toEqual(["m1", "nota:n1", "m2", "nota:n2"]);
    expect(itens.map((i) => i.tipo)).toEqual(["mensagem", "nota", "mensagem", "nota"]);
  });

  it("desempata notas por id e usa chave distinta quando id coincide com mensagem", () => {
    const t = "2026-10-01T12:00:00.000Z";
    expect(itensDaThread([mensagem("n1", t)], [nota("n2", t), nota("n1", t)], false, false).map((i) => i.id))
      .toEqual(["n1", "nota:n1", "nota:n2"]);
  });

  it("nota anterior à janela aparece só depois de carregar todas as mensagens anteriores", () => {
    const mensagens = [mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n0", "2026-10-01T09:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, false).map((i) => i.id)).toEqual(["m1"]);
    expect(itensDaThread(mensagens, notas, false, false).map((i) => i.id)).toEqual(["nota:n0", "m1"]);
  });

  it("usa a mensagem mais antiga da janela mesmo se a entrada chegar fora de ordem", () => {
    const mensagens = [mensagem("m2", "2026-10-01T12:00:00.000Z"), mensagem("m1", "2026-10-01T10:00:00.000Z")];
    const notas = [nota("n1", "2026-10-01T11:00:00.000Z")];
    expect(itensDaThread(mensagens, notas, true, false).map((i) => i.id)).toEqual(["m1", "nota:n1", "m2"]);
  });

  it("thread só com notas mantém todas elas", () => {
    expect(itensDaThread([], [nota("n2", "2026-10-01T12:00:00.000Z"), nota("n1", "2026-10-01T11:00:00.000Z")], true, false)
      .map((i) => i.id)).toEqual(["nota:n1", "nota:n2"]);
  });
});
