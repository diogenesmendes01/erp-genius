import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && (await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } }));
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return {
    ...original,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao();
      original.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import type { EscopoRelatorio } from "@/server/relatorios/escopo";
import { progressoMetas, salvarMeta } from "./metas";

const tudo: EscopoRelatorio = { tipo: "TUDO" };
type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U, vend1: U, vendOutraEquipe: U;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });
const m = () => ({ competencia: "2026-11", usuarioId: vend1.id, metrica: "MATRICULAS" as const, valor: 20 });

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  vendOutraEquipe = await criarUsuario([Papel.VENDEDOR], "V2");
  await prisma.usuario.update({ where: { id: vend1.id }, data: { gerenteComercialId: gerente.id } });
});

async function ultimoEvento(tipo: string) {
  return prisma.evento.findFirstOrThrow({ where: { tipo, agregadoTipo: "MetaComercial" }, orderBy: { criadoEm: "desc" } });
}
async function metas(valores: [string, number][], usuarioId: string | null = vend1.id) {
  for (const [competencia, valor] of valores) await prisma.metaComercial.create({ data: { competencia, usuarioId, metrica: "MATRICULAS", valor, criadaPorId: admin.id } });
}
async function matriculasDe(dono: U, n: number, mes = "2026-11", valorPrevisto?: number, moeda?: string) {
  const pais = moeda ? await prisma.pais.upsert({ where: { codigoISO: moeda }, update: {}, create: { nome: moeda, codigoISO: moeda, moedaLocal: moeda, ddi: "+1" } }) : null;
  for (let i = 0; i < n; i++) {
    const l = await prisma.oportunidade.create({ data: { nome: "L", etapa: "MATRICULADO", vendedorDonoId: dono.id, valorPrevisto, paisId: pais?.id } });
    await prisma.evento.create({ data: { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: l.id, criadoEm: new Date(`${mes}-10T15:00:00Z`), payload: { de: "AGUARDANDO_MATRICULA", para: "MATRICULADO" } } });
  }
}

describe("salvarMeta", () => {
  it("admin_define_para_qualquer", async () => {
    logado(admin);
    expect((await salvarMeta(m())).ok).toBe(true);
    expect((await salvarMeta({ ...m(), usuarioId: null, metrica: "EXPERIMENTAIS_REALIZADAS" })).ok).toBe(true);
  });
  it("gerente_so_equipe", async () => {
    logado(gerente);
    expect((await salvarMeta({ ...m(), usuarioId: vendOutraEquipe.id })).ok).toBe(false);
    expect((await salvarMeta(m())).ok).toBe(true);
    expect((await salvarMeta({ ...m(), usuarioId: null })).ok).toBe(false);
  });
  it("vendedor_nao_define", async () => {
    logado(vend1);
    expect((await salvarMeta(m())).ok).toBe(false);
  });
  it("valor_ganho_exige_moeda", async () => {
    logado(admin);
    expect((await salvarMeta({ ...m(), metrica: "VALOR_GANHO", moeda: undefined })).ok).toBe(false);
    expect((await salvarMeta({ ...m(), metrica: "VALOR_GANHO", moeda: "BRL" })).ok).toBe(true);
  });
  it("competencia_invalida", async () => {
    logado(admin);
    expect((await salvarMeta({ ...m(), competencia: "2026-13" })).ok).toBe(false);
  });
  it("regravar_registra_de_para_e_mantem_uma_linha", async () => {
    logado(admin);
    await salvarMeta(m());
    await salvarMeta({ ...m(), valor: 25 });
    expect((await ultimoEvento("MetaDefinida")).payload).toMatchObject({ de: 20, para: 25 });
    expect(await prisma.metaComercial.count()).toBe(1);
  });
  it("meta_geral_regravada_nao_duplica", async () => {
    logado(admin);
    await salvarMeta({ ...m(), usuarioId: null });
    await salvarMeta({ ...m(), usuarioId: null, valor: 30 });
    expect(await prisma.metaComercial.count()).toBe(1);
  });
});

describe("progressoMetas", () => {
  it("progresso_trimestre_soma_meses", async () => {
    await metas([["2026-10", 10], ["2026-11", 10], ["2026-12", 10]]);
    await matriculasDe(vend1, 15);
    expect((await progressoMetas({ competencias: ["2026-10", "2026-11", "2026-12"], escopo: tudo }))[0]).toMatchObject({ meta: 30, realizado: 15, pct: 0.5 });
  });
  it("matricula_fora_do_mes_nao_conta_e_mes_usa_fuso_da_escola", async () => {
    await metas([["2026-11", 10]]);
    await matriculasDe(vend1, 2, "2026-10");
    const l = await prisma.oportunidade.create({ data: { nome: "L", etapa: "MATRICULADO", vendedorDonoId: vend1.id } });
    // 01/12 01:00Z = 30/11 22:00 em São Paulo: ainda é novembro.
    await prisma.evento.create({ data: { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: l.id, criadoEm: new Date("2026-12-01T01:00:00Z"), payload: { para: "MATRICULADO" } } });
    expect((await progressoMetas({ competencias: ["2026-11"], escopo: tudo }))[0]).toMatchObject({ meta: 10, realizado: 1 });
  });
  it("escopo_de_equipe_nao_ve_meta_de_fora", async () => {
    await metas([["2026-11", 10]]);
    await metas([["2026-11", 10]], vendOutraEquipe.id);
    const r = await progressoMetas({ competencias: ["2026-11"], escopo: { tipo: "USUARIOS", ids: [gerente.id, vend1.id] } });
    expect(r.map((x) => x.usuarioId)).toEqual([vend1.id]);
  });
  it("meta_de_equipe_compara_com_soma", async () => {
    await metas([["2026-11", 30]], null);
    await matriculasDe(vend1, 2);
    await matriculasDe(vendOutraEquipe, 3);
    expect((await progressoMetas({ competencias: ["2026-11"], escopo: tudo }))[0]).toMatchObject({ usuarioId: null, meta: 30, realizado: 5 });
  });
  it("valor_ganho_soma_na_moeda", async () => {
    await prisma.metaComercial.create({ data: { competencia: "2026-11", usuarioId: vend1.id, metrica: "VALOR_GANHO", valor: 1000, moeda: "BRL", criadaPorId: admin.id } });
    await matriculasDe(vend1, 2, "2026-11", 100, "BRL");
    await matriculasDe(vend1, 1, "2026-11", 900, "CRC");
    expect((await progressoMetas({ competencias: ["2026-11"], escopo: tudo }))[0]).toMatchObject({ meta: 1000, realizado: 200, pct: 0.2, moeda: "BRL" });
  });
});
