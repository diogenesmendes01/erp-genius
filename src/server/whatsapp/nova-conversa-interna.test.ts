import { describe, expect, it } from "vitest";
import { classificarAlvoNovaConversa, type CadastroTelefoneInterno } from "./nova-conversa-interna";
const vazio = (): CadastroTelefoneInterno => ({ oportunidadesAutorizadas: [], pessoaIdentificada: false, alunoIdentificado: false, responsavelIdentificado: false, contatoIdentificado: false, oportunidadeOcultaIdentificada: false });
const telefone = "+50688889999";
describe("classificador interno estrito372, sem adoção cadastral", () => {
 it("somente número sem cadastro pode seguir como NOVO", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone }, vazio())).toEqual({ tipo: "novo" });
 });
 it("oportunidade autorizada exata segue ramo próprio mesmo com Pessoa/Contato identificados", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone }, { ...vazio(), pessoaIdentificada: true, contatoIdentificado: true, oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: telefone }] })).toEqual({ tipo: "existente", leadId: "lead-a" });
 });
 it("seleção explícita escolhe só o alvo autorizado exato entre múltiplos", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone, leadEsperadoId: "lead-b" }, { ...vazio(), oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: telefone }, { id: "lead-b", telefoneE164: telefone }] })).toEqual({ tipo: "existente", leadId: "lead-b" });
 });
 it("alvo esperado ausente não vira outro lead nem número novo", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone, leadEsperadoId: "lead-removido" }, { ...vazio(), oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: telefone }] })).toEqual({ tipo: "recusar" });
 });
 it("ID autorizado com telefone divergente não prova identidade do alvo", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone, leadEsperadoId: "lead-a" }, { ...vazio(), oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: "+5511999990000" }] })).toEqual({ tipo: "recusar" });
 });
 it("múltiplas oportunidades sem escolha explícita não usam ordem ou mais recente", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone }, { ...vazio(), oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: telefone }, { id: "lead-b", telefoneE164: telefone }] })).toEqual({ tipo: "recusar" });
 });
 it.each(["pessoaIdentificada", "alunoIdentificado", "responsavelIdentificado", "contatoIdentificado", "oportunidadeOcultaIdentificada"] as const)("cadastro %s impede NOVO com resposta genérica sem IDs", campo => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone }, { ...vazio(), [campo]: true })).toEqual({ tipo: "recusar" });
 });
 it("cadastro oculto paralelo não substitui ou expõe o alvo autorizado explicitamente escolhido", () => {
  expect(classificarAlvoNovaConversa({ telefoneE164: telefone, leadEsperadoId: "lead-a" }, { ...vazio(), oportunidadeOcultaIdentificada: true, oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: telefone }] })).toEqual({ tipo: "existente", leadId: "lead-a" });
 });
});

it("única oportunidade com telefone divergente sem seleção é inconsistente, nunca NOVO", () => {
 expect(classificarAlvoNovaConversa({ telefoneE164: telefone }, { ...vazio(), oportunidadesAutorizadas: [{ id: "lead-a", telefoneE164: "+5511999990000" }] })).toEqual({ tipo: "recusar" });
});
