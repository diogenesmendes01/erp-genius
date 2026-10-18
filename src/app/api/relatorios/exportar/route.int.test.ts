import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && (await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } }));
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao };
});

import { prisma } from "@/lib/prisma";
import * as detalhe from "@/server/relatorios/detalhe";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { GET } from "./route";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vend1: typeof admin;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const bruto = async (r: Response) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(await r.arrayBuffer());
const req = (q: string) => GET(new Request(`http://localhost/api/relatorios/exportar${q}`));
const ultimoEvento = (tipo: string) => prisma.evento.findFirstOrThrow({ where: { tipo }, orderBy: { criadoEm: "desc" } });

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  await prisma.oportunidade.create({ data: { nome: "Ana Silva", vendedorDonoId: vend1.id, telefoneE164: "+5511999999999" } });
  await prisma.oportunidade.create({ data: { nome: "=Formula", vendedorDonoId: vend1.id } });
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/relatorios/exportar", () => {
  it("sem_capacidade_403", async () => {
    logado(vend1);
    expect((await req("?aba=funil")).status).toBe(403);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });

  it("nao_autenticado_401_e_aba_invalida_400", async () => {
    authMock.mockResolvedValue(null);
    expect((await req("?aba=funil")).status).toBe(401);
    logado(admin);
    expect((await req("?aba=nada")).status).toBe(400);
    expect((await req("?aba=detalhe&chave=lixo")).status).toBe(400);
    expect((await req("?aba=funil&periodo=PERSONALIZADO&de=2026-05-01&ate=2026-01-01")).status).toBe(400);
  });

  it("gera_csv_e_evento_minimizado", async () => {
    logado(admin);
    const r = await req("?aba=detalhe&chave=abertas&busca=ana");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="relatorio-detalhe.csv"');
    const texto = await bruto(r);
    expect(texto.startsWith("﻿Nome;Etapa;")).toBe(true);
    expect(texto).toContain("Ana Silva");
    expect(texto).not.toContain("999999999");
    const evento = await ultimoEvento("DadosExportados");
    expect(evento.payload).toMatchObject({ conjunto: "relatorio:detalhe", filtros: { busca: { aplicada: true, caracteres: 3 } } });
    expect(JSON.stringify(evento.payload)).not.toContain("ana");
  });

  it("neutraliza_formula_no_nome", async () => {
    logado(admin);
    expect(await (await req("?aba=detalhe&chave=abertas")).text()).toContain("'=Formula");
  });

  it("todas_as_abas_geram_csv", async () => {
    logado(admin);
    for (const aba of ["pipeline", "funil", "atendimento", "equipe", "aria", "atividades"]) {
      const r = await req(`?aba=${aba}`);
      expect(r.status, aba).toBe(200);
      expect((await bruto(r)).startsWith("﻿"), aba).toBe(true);
    }
  });

  it("acesso_revogado_durante_a_geracao_falha", async () => {
    logado(admin);
    const original = detalhe.detalharMetrica;
    vi.spyOn(detalhe, "detalharMetrica").mockImplementation(async (...a) => {
      const r = await original(...a);
      await prisma.usuario.update({ where: { id: admin.id }, data: { papeis: [Papel.FINANCEIRO] } });
      return r;
    });
    expect((await req("?aba=detalhe&chave=abertas")).status).toBe(403);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });
});
