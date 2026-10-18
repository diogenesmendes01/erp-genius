import { describe, it, expect, beforeEach } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { ErroPermissao } from "@/server/_shared/sessao";
import { escopoRelatorio, filtroOportunidade } from "./escopo";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let vend1: Awaited<ReturnType<typeof criarUsuario>>;
let vend2: Awaited<ReturnType<typeof criarUsuario>>;
let vendDeOutro: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  vend2 = await criarUsuario([Papel.VENDEDOR], "V2");
  vendDeOutro = await criarUsuario([Papel.VENDEDOR], "V3");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Fin");
  await prisma.usuario.updateMany({ where: { id: { in: [vend1.id, vend2.id] } }, data: { gerenteComercialId: gerente.id } });
});

describe("escopo dos relatórios", () => {
  it("admin_tudo", async () => expect(await escopoRelatorio(admin)).toEqual({ tipo: "TUDO" }));
  it("gerente_ele_e_equipe", async () => {
    const e = (await escopoRelatorio(gerente)) as { tipo: "USUARIOS"; ids: string[] };
    expect(e.tipo).toBe("USUARIOS");
    expect(new Set(e.ids)).toEqual(new Set([gerente.id, vend1.id, vend2.id]));
    expect(e.ids).not.toContain(vendDeOutro.id);
  });
  it("vendedor_so_ele", async () => expect(await escopoRelatorio(vend1)).toEqual({ tipo: "USUARIOS", ids: [vend1.id] }));
  it("financeiro_sem_acesso", async () => await expect(escopoRelatorio(financeiro)).rejects.toThrow(ErroPermissao));
  it("papeis_sao_lidos_frescos_do_banco_e_inativo_e_negado", async () => {
    // o objeto da sessão diz ADMINISTRADOR, mas o banco já rebaixou o usuário
    await prisma.usuario.update({ where: { id: admin.id }, data: { papeis: [Papel.FINANCEIRO] } });
    await expect(escopoRelatorio(admin)).rejects.toThrow(ErroPermissao);
    await prisma.usuario.update({ where: { id: vend1.id }, data: { ativo: false } });
    await expect(escopoRelatorio(vend1)).rejects.toThrow(ErroPermissao);
  });
  it("filtroOportunidade", () => {
    expect(filtroOportunidade({ tipo: "TUDO" })).toEqual({});
    expect(filtroOportunidade({ tipo: "USUARIOS", ids: ["a", "b"] })).toEqual({ vendedorDonoId: { in: ["a", "b"] } });
  });
});
