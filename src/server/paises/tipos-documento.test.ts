import { describe, expect, it } from "vitest";
import { planejarTiposDocumento } from "./tipos-documento";

const atual = { id: "cpf-estavel", nome: "CPF", validador: "cpf", _count: { alunos: 2, pessoas: 0 } };
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
    expect(planejarTiposDocumento([{ ...atual, _count: { alunos: 0, pessoas: 0 } }], []).remover).toEqual([atual.id]);
  });
  it("nega duas atualizações para uma identidade", () => {
    expect(() => planejarTiposDocumento([atual], [atual, atual])).toThrow("duplicado");
  });
});

it("nega remover tipo ligado somente a Pessoa, sem Aluno",()=>{const emPessoa={id:"tipo-pessoa",nome:"Documento",validador:"passaporte",_count:{alunos:0,pessoas:1}};expect(()=>planejarTiposDocumento([emPessoa],[])).toThrow(/pessoas/i);});
it("renomear tipo ligado a Pessoa preserva identidade e não veta manutenção",()=>{const emPessoa={id:"tipo-pessoa",nome:"Documento",validador:"passaporte",_count:{alunos:0,pessoas:1}};expect(planejarTiposDocumento([emPessoa],[{id:emPessoa.id,nome:"Passaporte",validador:"passaporte"}])).toEqual({atualizar:[{id:emPessoa.id,nome:"Passaporte",validador:"passaporte"}],criar:[],remover:[]});});
