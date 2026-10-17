import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { listarCoberturas } from "./consultas";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const sessaoDe = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
let adm: U, gerente: U, outroGerente: U, v1: U, v2: U, v3: U, v4: U;

const cobrir = (titularId: string, substitutoId: string, motivo: string, criadoEm = new Date()) =>
  prisma.coberturaCarteira.create({ data: { titularId, substitutoId, inicio: new Date(Date.now() - 86_400_000), fim: new Date("2099-10-20T15:00:00Z"), motivo, concedenteId: gerente.id, criadoEm } });

beforeEach(async () => {
  await truncarBanco();
  adm = await criarUsuario([Papel.ADMINISTRADOR], "Adm");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  outroGerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  v3 = await criarUsuario([Papel.VENDEDOR], "V3");
  v4 = await criarUsuario([Papel.VENDEDOR], "V4");
  await prisma.usuario.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { gerenteComercialId: gerente.id } });
  await prisma.usuario.updateMany({ where: { id: { in: [v3.id, v4.id] } }, data: { gerenteComercialId: outroGerente.id } });
});

describe("listarCoberturas", () => {
  it("o gerente vê só as da equipe; o administrador vê todas; o vendedor não vê nenhuma", async () => {
    await cobrir(v1.id, v2.id, "Férias de V1");
    await cobrir(v3.id, v4.id, "Férias de V3");
    await cobrir(v1.id, v3.id, "Entre equipes");
    const g = await listarCoberturas(sessaoDe(gerente), 1);
    expect(g.itens.map((c) => c.motivo)).toEqual(["Férias de V1"]);
    expect(g.itens[0]).toMatchObject({ titular: "V1", substituto: "V2", revogadaEm: null });
    expect(g.itens[0].inicio).toBeInstanceOf(Date);
    expect(g.possuiMais).toBe(false);
    expect((await listarCoberturas(sessaoDe(adm), 1)).itens).toHaveLength(3);
    expect(await listarCoberturas(sessaoDe(v1), 1)).toEqual({ itens: [], possuiMais: false });
  });

  it("50 por página, mais recentes primeiro, com possuiMais", async () => {
    const base = Date.now();
    for (let i = 0; i < 51; i++) await cobrir(v1.id, v2.id, `Motivo ${String(i).padStart(2, "0")}`, new Date(base + i * 1000));
    const p1 = await listarCoberturas(sessaoDe(gerente), 1);
    expect(p1.itens).toHaveLength(50);
    expect(p1.possuiMais).toBe(true);
    expect(p1.itens[0].motivo).toBe("Motivo 50");
    const p2 = await listarCoberturas(sessaoDe(gerente), 2);
    expect(p2.itens.map((c) => c.motivo)).toEqual(["Motivo 00"]);
    expect(p2.possuiMais).toBe(false);
  });
});
