import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { consultarCadastrosPreparacao } from "./preparacao-comercial";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

describe("preparar contratação: escopo da carteira", () => {
  let v1: { id: string }, v2: { id: string }, gerente: { id: string }, opDeV1: string;
  beforeEach(async () => {
    await truncarBanco();
    gerente = await criarUsuario(["GERENTE_COMERCIAL"]);
    v1 = await criarUsuario(["VENDEDOR"]);
    v2 = await criarUsuario(["VENDEDOR"]);
    await prisma.usuario.update({ where: { id: v1.id }, data: { gerenteComercialId: gerente.id } });
    await prisma.usuario.update({ where: { id: v2.id }, data: { gerenteComercialId: gerente.id } });
    opDeV1 = (await prisma.oportunidade.create({ data: { nome: "Oportunidade de V1", telefoneE164: "+50688887777", vendedorDonoId: v1.id } })).id;
  });

  it("cobertura vigente abre a contratação para o substituto", async () => {
    const agora = Date.now();
    await prisma.coberturaCarteira.create({ data: { titularId: v1.id, substitutoId: v2.id, concedenteId: gerente.id, inicio: new Date(agora - 60_000), fim: new Date(agora + 3_600_000), motivo: "Férias de V1" } });
    logadoComo(v2.id);
    expect((await consultarCadastrosPreparacao({ leadId: opDeV1 })).ok).toBe(true);
  });

  it("cobertura vencida não abre contratação", async () => {
    const ontem = new Date(Date.now() - 24 * 3_600_000), ontem2 = new Date(Date.now() - 48 * 3_600_000);
    await prisma.coberturaCarteira.create({ data: { titularId: v1.id, substitutoId: v2.id, concedenteId: gerente.id, inicio: ontem2, fim: ontem, motivo: "Férias de V1" } });
    logadoComo(v2.id);
    expect(await consultarCadastrosPreparacao({ leadId: opDeV1 })).toEqual({ ok: false, erro: "Oportunidade fora da sua carteira." });
  });
});
