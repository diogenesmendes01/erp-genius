import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { carregarCarteira, reatribuirEmLote, type FiltrosCarteira } from "./carteira";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });
const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const base: FiltrosCarteira = { donoId: "", busca: "", semInteracaoDias: "", emTurma: false, tipo: "todos" };

type U = Awaited<ReturnType<typeof criarUsuario>>;
let gerente: U;
let v1: U;
let v2: U;
let v3: U;
let op1: string;
let op2: string;
let opOutraEquipe: string;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const outroGerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  v3 = await criarUsuario([Papel.VENDEDOR], "V3");
  await prisma.usuario.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { gerenteComercialId: gerente.id } });
  await prisma.usuario.update({ where: { id: v3.id }, data: { gerenteComercialId: outroGerente.id } });
  const mk = async (nome: string, dono: string, extra: Record<string, unknown> = {}) =>
    (await prisma.oportunidade.create({ data: { nome, vendedorDonoId: dono, ...extra } as never })).id;
  op1 = await mk("Ana", v1.id);
  op2 = await mk("Bia", v2.id);
  opOutraEquipe = await mk("Carla", v3.id);
  await mk("Perdida", v1.id, { etapa: "PERDIDO" });
  await prisma.coberturaCarteira.create({
    data: { titularId: v1.id, substitutoId: v2.id, inicio: new Date(Date.now() - 86_400_000), fim: new Date("2099-10-20T15:00:00Z"), motivo: "Férias de V1", concedenteId: gerente.id },
  });
});

describe("carregarCarteira", () => {
  it("gerente vê só a equipe; vendedor vê própria + coberta", async () => {
    const r = await carregarCarteira(sessaoDe(gerente), base);
    expect(new Set(r.linhas.map((l) => l.dono!.id))).toEqual(new Set([v1.id, v2.id]));
    expect(r.linhas.map((l) => l.nome).sort()).toEqual(["Ana", "Bia"]);
    expect(r.total).toBe(2);
    expect((await carregarCarteira(sessaoDe(v2), base)).vendedores.map((v) => v.nome)).toEqual(["V2", "V1 (cobertura até 20/10)"]);
    expect((await carregarCarteira(sessaoDe(v2), base)).vendedores.map((v) => v.cobertoPor)).toEqual([null, "V2"]);
  });
  it("dias sem interação usa o último evento; filtros de tipo, turma e busca", async () => {
    await prisma.evento.create({ data: { tipo: "LeadAtribuido", agregadoTipo: "Lead", agregadoId: op1, payload: {}, criadoEm: new Date(Date.now() - 20 * 86_400_000) } });
    const r = await carregarCarteira(sessaoDe(gerente), base);
    const ana = r.linhas.find((l) => l.oportunidadeId === op1)!;
    expect(ana.diasSemInteracao).toBeGreaterThanOrEqual(19);
    expect(ana.diasSemInteracao).toBeLessThanOrEqual(20);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, semInteracaoDias: "15" })).linhas.map((l) => l.nome)).toEqual(["Ana"]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, busca: "bia" })).linhas.map((l) => l.nome)).toEqual(["Bia"]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, tipo: "pj" })).linhas).toEqual([]);
    expect((await carregarCarteira(sessaoDe(gerente), { ...base, emTurma: true })).linhas).toEqual([]);
  });
});

describe("reatribuirEmLote", () => {
  it("reatribuir exige motivo e respeita equipe", async () => {
    logadoComo(gerente.id);
    expect(await reatribuirEmLote({ ids: [op1], vendedorId: v2.id, motivo: "" })).toEqual({ ok: false, erro: "Informe o motivo (mínimo 5 caracteres)." });
    const r = await reatribuirEmLote({ ids: [op1, opOutraEquipe], vendedorId: v2.id, motivo: "Férias de V1" });
    expect(r.ok && r.dado).toEqual({ feitas: 1, recusadas: [{ id: opOutraEquipe, motivo: "Oportunidade fora da sua carteira." }] });
    expect((await eventosDo("Lead", op1)).at(-1)).toMatchObject({ tipo: "LeadAtribuido", payload: { motivo: "Férias de V1" } });
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: op1 } })).vendedorDonoId).toBe(v2.id);
  });
  it("limites de ids e vendedor fora da equipe", async () => {
    logadoComo(gerente.id);
    expect(await reatribuirEmLote({ ids: [], vendedorId: v2.id, motivo: "Férias de V1" })).toMatchObject({ ok: false });
    expect(await reatribuirEmLote({ ids: Array.from({ length: 51 }, (_, i) => `x${i}`), vendedorId: v2.id, motivo: "Férias de V1" })).toEqual({ ok: false, erro: "Selecione no máximo 50 oportunidades." });
    expect(await reatribuirEmLote({ ids: [op1], vendedorId: v2.id, motivo: "x".repeat(1001) })).toMatchObject({ ok: false });
    const r = await reatribuirEmLote({ ids: [op1], vendedorId: v3.id, motivo: "Férias de V1" });
    expect(r.ok && r.dado).toEqual({ feitas: 0, recusadas: [{ id: op1, motivo: "O vendedor não pertence à sua equipe." }] });
    expect(op2).toBeTruthy();
  });
});
