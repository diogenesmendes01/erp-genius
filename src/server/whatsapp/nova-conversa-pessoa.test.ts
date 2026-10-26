import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared/sessao";
const m = vi.hoisted(() => ({ contato: vi.fn(), pessoa: vi.fn(), vincular: vi.fn(), evento: vi.fn() }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: m.evento }));
import { criarPessoaDoContatoNovoTx } from "./nova-conversa-pessoa";
const tx = { contatoWhatsApp: { findUnique: m.contato, updateMany: m.vincular }, pessoa: { create: m.pessoa } } as unknown as Prisma.TransactionClient;
const contatoCriado = { id: "contato-proprio", telefoneE164: "+50688889999" };
const limpo = () => ({ ...contatoCriado, pessoaId: null, alunoId: null, responsavelId: null, leadId: null });
const entrada = { nome: "Contato WhatsApp", autorId: "autor-ficticio" };
beforeEach(() => {
 for (const fn of Object.values(m)) fn.mockReset();
 m.contato.mockResolvedValue(limpo()); m.pessoa.mockResolvedValue({ id: "pessoa-nova" }); m.vincular.mockResolvedValue({ count: 1 }); m.evento.mockResolvedValue(undefined);
});
describe("Pessoa local somente para Contato criado pela tx372", () => {
 it("grava escrita/evento canônicos e só vincula o Contato próprio com bindings nulos", async () => {
  expect(await criarPessoaDoContatoNovoTx(tx, contatoCriado, entrada)).toEqual({ pessoaId: "pessoa-nova" });
  expect(m.pessoa).toHaveBeenCalledExactlyOnceWith({ data: { nome: "Contato WhatsApp", email: null, origemCanal: "PROSPECCAO_ATIVA" } });
  expect(m.evento).toHaveBeenCalledExactlyOnceWith(tx, { tipo: "PessoaCriada", agregadoTipo: "Pessoa", agregadoId: "pessoa-nova", autorId: "autor-ficticio", payload: { nome: "Contato WhatsApp", origemCanal: "PROSPECCAO_ATIVA", vinculo: null } });
  expect(m.vincular).toHaveBeenCalledExactlyOnceWith({ where: { ...contatoCriado, pessoaId: null, alunoId: null, responsavelId: null, leadId: null }, data: { pessoaId: "pessoa-nova" } });
 });
 it("binding prévio ou identidade divergente recusa sem adotar ou atualizar entidade externa", async () => {
  for(const alterado of [{ pessoaId: "p-externa" }, { alunoId: "a-externo" }, { responsavelId: "r-externo" }, { leadId: "l-externo" }, { telefoneE164: "+5511999990000" }, { id: "contato-externo" }]) {
   m.contato.mockResolvedValue({ ...limpo(), ...alterado });
   await expect(criarPessoaDoContatoNovoTx(tx, contatoCriado, entrada)).rejects.toBeInstanceOf(ErroRegra);
   expect(m.pessoa).not.toHaveBeenCalled(); expect(m.evento).not.toHaveBeenCalled(); expect(m.vincular).not.toHaveBeenCalled();
  }
 });
 it("CAS perdido após evento lança para rollback outer, sem falso sucesso", async () => {
  m.vincular.mockResolvedValue({ count: 0 });
  await expect(criarPessoaDoContatoNovoTx(tx, contatoCriado, entrada)).rejects.toBeInstanceOf(ErroRegra);
  expect(m.pessoa).toHaveBeenCalledTimes(1); expect(m.evento).toHaveBeenCalledTimes(1); expect(m.vincular).toHaveBeenCalledTimes(1);
 });
 it("erro de evento propaga e não grava vínculo do Contato", async () => {
  const erro = new Error("Falha fictícia de PessoaCriada"); m.evento.mockRejectedValueOnce(erro);
  await expect(criarPessoaDoContatoNovoTx(tx, contatoCriado, entrada)).rejects.toBe(erro);
  expect(m.pessoa).toHaveBeenCalledTimes(1); expect(m.vincular).not.toHaveBeenCalled();
 });
});
