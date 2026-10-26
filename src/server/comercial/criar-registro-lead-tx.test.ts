import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadSchema } from "./schema";
const m = vi.hoisted(() => ({ criar: vi.fn(), evento: vi.fn() }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: m.evento }));
import { criarRegistroLeadTx } from "./criar-registro-lead-tx";
const tx = { oportunidade: { create: m.criar } } as unknown as Prisma.TransactionClient;
const dados = () => LeadSchema.parse({ nome: "Nome explícito fictício", telefoneE164: "raw diferente", origemCanal: "OUTRO" });
beforeEach(() => {
 m.criar.mockReset(); m.evento.mockReset(); m.criar.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "lead-ficticio" })); m.evento.mockResolvedValue(undefined);
});
describe("factory de registro Lead extraída sem política #372", () => {
 it("grava telefone explícito já normalizado, código e identidade calculados no caller", async () => {
  expect(await criarRegistroLeadTx(tx, { dados: dados(), codigo: "L-000007", telefoneE164: "+50688889999", pessoaId: "pessoa-ficticia", empresaId: null, donoId: "vendedor-ficticio", autorId: "autor-ficticio", marca: null })).toBe("lead-ficticio");
  expect(m.criar).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ codigo: "L-000007", nome: "Nome explícito fictício", telefoneE164: "+50688889999", pessoaId: "pessoa-ficticia", empresaId: null, vendedorDonoId: "vendedor-ficticio", origemCanal: "OUTRO", segmento: "ADULTO", temperatura: "MORNO", b2b: false }) });
  expect(m.evento.mock.calls.map(c => c[1])).toEqual([
   { tipo: "LeadCriado", agregadoTipo: "Lead", agregadoId: "lead-ficticio", autorId: "autor-ficticio", payload: { codigo: "L-000007", nome: "Nome explícito fictício", segmento: "ADULTO", b2b: false, pessoaId: "pessoa-ficticia", empresaId: null } },
   { tipo: "LeadAtribuido", agregadoTipo: "Lead", agregadoId: "lead-ficticio", autorId: "autor-ficticio", payload: { de: null, para: "vendedor-ficticio" } },
  ]);
 });
 it("telefone e dono null preservam legado sem usar raw nem inventar atribuição", async () => {
  await criarRegistroLeadTx(tx, { dados: dados(), codigo: "L-000008", telefoneE164: null, pessoaId: null, empresaId: null, donoId: null, autorId: "admin-ficticio", marca: null });
  expect(m.criar).toHaveBeenCalledTimes(1); expect(m.criar.mock.calls[0][0].data).toMatchObject({ telefoneE164: null, vendedorDonoId: null, pessoaId: null });
  expect(m.evento).toHaveBeenCalledTimes(1); expect(m.evento.mock.calls[0][1]).toMatchObject({ tipo: "LeadCriado", autorId: "admin-ficticio" });
 });
 it("marca e campos comerciais do caller conservam os payloads globais", async () => {
  const entrada = LeadSchema.parse({ nome: "Empresa fictícia", criarEmpresa: true, origemCanal: "SITE", valorPrevisto: "125,50", planoPrevisto: "Plano fictício", comissaoPrevista: 5 });
  const marca = { chaveIdempotencia: "chave-ficticia-372", entradaHash: "hash-ficticio" };
  await criarRegistroLeadTx(tx, { dados: entrada, codigo: "L-000009", telefoneE164: "+5511999990000", pessoaId: null, empresaId: "empresa-ficticia", donoId: null, autorId: "autor-ficticio", marca });
  expect(m.criar).toHaveBeenCalledTimes(1); expect(m.criar.mock.calls[0][0].data).toMatchObject({ b2b: true, empresaId: "empresa-ficticia", valorPrevisto: 125.5, planoPrevisto: "Plano fictício", comissaoPrevista: 5 });
  expect(m.evento.mock.calls[0][1].payload).toEqual({ codigo: "L-000009", nome: "Empresa fictícia", segmento: "ADULTO", b2b: true, pessoaId: null, empresaId: "empresa-ficticia", ...marca });
 });
 it("erro de evento propaga ao caller dono da TX, sem resultado de falso sucesso", async () => {
  const erro = new Error("Falha fictícia de evento"); m.evento.mockRejectedValueOnce(erro);
  await expect(criarRegistroLeadTx(tx, { dados: dados(), codigo: "L-000010", telefoneE164: "+50688889999", pessoaId: "p", empresaId: null, donoId: "v", autorId: "a", marca: null })).rejects.toBe(erro);
  expect(m.criar).toHaveBeenCalledTimes(1); expect(m.evento).toHaveBeenCalledTimes(1);
 });
});
