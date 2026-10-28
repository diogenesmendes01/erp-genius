import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import type { Setor } from "@/server/whatsapp/setor";
import { opcoesTransferir } from "./opcoes-transferir";

const base = {
  usuario: { id: "eu", papeis: [Papel.VENDEDOR] },
  atendimento: { finalidade: "COMERCIAL" as Setor, responsavelId: "eu", encerrado: false },
  setoresDoNumero: ["COMERCIAL", "SECRETARIA"] as Setor[],
  ariaPodeDevolver: false,
};
describe("Transferir unificado — capacidades atuais #360", () => {
  it("D5: vendedor responsável vê Pessoas, transfere setor e devolve à fila", () => {
    expect(opcoesTransferir(base)).toEqual({ visivel: true, pessoas: true, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: false });
  });
  it("D5: na linha de vendas o responsável comum não recebe Pessoas; o gerente continua atribuindo", () => {
    const linha = { ...base, atendimento: { ...base.atendimento, linhaComercial: true, donoLinhaId: "eu" } };
    expect(opcoesTransferir(linha).pessoas).toBe(false);
    expect(opcoesTransferir({ ...linha, usuario: { id: "g", papeis: [Papel.GERENTE_COMERCIAL] } }).pessoas).toBe(true);
  });
  it("D5: responsável de outro setor também transfere para colega do próprio setor", () => {
    expect(opcoesTransferir({ ...base, usuario: { id: "eu", papeis: [Papel.SECRETARIA_ACADEMICA] }, atendimento: { ...base.atendimento, finalidade: "SECRETARIA" } }).pessoas).toBe(true);
  });
  it("gerente atribui pessoas e não oferece devolver uma conversa já na fila", () => {
    expect(opcoesTransferir({ ...base, usuario: { id: "g", papeis: [Papel.GERENTE_COMERCIAL] }, atendimento: { ...base.atendimento, responsavelId: null } })).toMatchObject({ pessoas: true, filaDoSetor: null });
  });
  it("outra pessoa não herda alçada do responsável", () => {
    expect(opcoesTransferir({ ...base, usuario: { ...base.usuario, id: "outro" } })).toEqual({ visivel: false, pessoas: false, setores: [], filaDoSetor: null, aria: false });
  });
  it("Aria usa exclusivamente a capacidade autorizada do painel", () => {
    expect(opcoesTransferir({ ...base, usuario: { ...base.usuario, id: "outro" }, ariaPodeDevolver: true })).toMatchObject({ visivel: true, aria: true, pessoas: false });
  });
  it.each(["encerrado", "grupo"] as const)("%s não oferece operação mesmo com capacidade Aria copiada", (bloqueio) => {
    const entrada = { ...base, ariaPodeDevolver: true, grupo: bloqueio === "grupo", atendimento: { ...base.atendimento, encerrado: bloqueio === "encerrado" } };
    expect(opcoesTransferir(entrada)).toEqual({ visivel: false, pessoas: false, setores: [], filaDoSetor: null, aria: false });
  });
  it("não oferece setor atual nem repete destinos", () => {
    expect(opcoesTransferir({ ...base, setoresDoNumero: ["SECRETARIA", "COMERCIAL", "SECRETARIA"] }).setores).toEqual(["SECRETARIA"]);
  });
});
