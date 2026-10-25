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
  it("responsável transfere setor e devolve à fila, sem atribuição antecipada da #370", () => {
    expect(opcoesTransferir(base)).toEqual({ visivel: true, pessoas: false, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: false });
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
