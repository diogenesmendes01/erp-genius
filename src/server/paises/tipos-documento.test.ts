import { describe, expect, it } from "vitest";
import { planejarTiposDocumento } from "./tipos-documento";

const atual = { id: "cpf-estavel", nome: "CPF", validador: "cpf", _count: { alunos: 2 } };
describe("tipos documentais preservam referências existentes", () => {
  it("renomeia por ID, mantendo vínculo dos alunos", () => {
    expect(planejarTiposDocumento([atual], [{ id: atual.id, nome: "CPF brasileiro", validador: "cpf" }])).toEqual({ atualizar: [{ id: atual.id, nome: "CPF brasileiro", validador: "cpf" }], criar: [], remover: [] });
  });
  it("formulário legado idêntico mantém o ID", () => {
    expect(planejarTiposDocumento([atual], [{ nome: "CPF", validador: "cpf" }]).atualizar[0].id).toBe(atual.id);
  });
  it("nega remoção de documento em uso", () => {
    expect(() => planejarTiposDocumento([atual], [])).toThrow("usado por alunos");
  });
  it("nega ID de outro país", () => {
    expect(() => planejarTiposDocumento([atual], [{ id: "outro-pais", nome: "CPF", validador: "cpf" }])).toThrow("não pertence");
  });
  it("remove somente tipo sem referência", () => {
    expect(planejarTiposDocumento([{ ...atual, _count: { alunos: 0 } }], []).remover).toEqual([atual.id]);
  });
  it("nega duas atualizações para uma identidade", () => {
    expect(() => planejarTiposDocumento([atual], [atual, atual])).toThrow("duplicado");
  });
});
