import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  eventos: [] as Record<string, unknown>[],
  criados: [] as { id: string; email: string }[],
  tx: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    usuario: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    evento: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(m.tx)) } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hash") } }));
vi.mock("@/server/_shared/sessao", async () => ({
  ...(await vi.importActual<typeof import("@/server/_shared/sessao")>("@/server/_shared/sessao")),
  exigirSessaoComPapel: m.sessao,
}));

import { criarUsuario } from "./acoes";

const textoSql = (a: unknown) => (Array.isArray(a) ? a.join("?") : (a as Prisma.Sql).sql);
const doEventoComChave = (a: unknown) => m.eventos.filter((e) => (a as Prisma.Sql).values.includes((e.payload as { chaveIdempotencia?: string }).chaveIdempotencia)).slice(0, 1);
const entrada = {
  nome: "Ana", email: "ana@escola.test", papeis: [Papel.VENDEDOR], limiteDescontoPct: null, limiteDescontoTaxaPct: null,
  limiteDescontoMensalidadePct: null, gerenteComercialId: null, permissoes: [], senha: "segredo1",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.eventos = [];
  m.criados = [];
  m.sessao.mockResolvedValue({ id: "adm", papeis: [Papel.ADMINISTRADOR] });
  m.tx.$queryRaw.mockImplementation(async (a: unknown) => (textoSql(a).includes(`FROM "Evento"`) ? doEventoComChave(a) : []));
  m.tx.usuario.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
    where.id === "adm" ? { ativo: true, papeis: [Papel.ADMINISTRADOR] } : m.criados.find((u) => u.email === where.email) ?? null);
  m.tx.usuario.create.mockImplementation(async ({ data }: { data: { nome: string; email: string } }) => {
    const u = { id: `u${m.criados.length + 1}`, nome: data.nome, email: data.email };
    m.criados.push(u);
    return u;
  });
  m.tx.evento.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { m.eventos.push(data); return data; });
});

describe("criarUsuario com chave de idempotência", () => {
  it("cria o usuário e grava a marca no Evento, sem a senha no hash da entrada", async () => {
    expect(await criarUsuario({ ...entrada, chaveIdempotencia: "tentativa-usuario-1" })).toEqual({ ok: true, dado: { id: "u1" } });
    const payload = (m.eventos[0] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ chaveIdempotencia: "tentativa-usuario-1", entradaHash: expect.any(String) });
    const { hashEntrada } = await import("@/server/_shared/idempotencia");
    const { CriarUsuarioSchema } = await import("./schema");
    const { senha, ...semSenha } = CriarUsuarioSchema.parse(entrada);
    void senha;
    expect(payload.entradaHash).toBe(hashEntrada(semSenha));
    expect(JSON.stringify(payload)).not.toContain("segredo1");
  });

  it("o reenvio com a mesma chave devolve o mesmo usuário em vez de \"já existe\"", async () => {
    await criarUsuario({ ...entrada, chaveIdempotencia: "tentativa-usuario-2" });
    expect(await criarUsuario({ ...entrada, chaveIdempotencia: "tentativa-usuario-2" })).toEqual({ ok: true, dado: { id: "u1" } });
    expect(m.tx.usuario.create).toHaveBeenCalledTimes(1);
  });

  it("a mesma chave com outros dados é conflito", async () => {
    await criarUsuario({ ...entrada, chaveIdempotencia: "tentativa-usuario-3" });
    const r = await criarUsuario({ ...entrada, nome: "Beatriz", chaveIdempotencia: "tentativa-usuario-3" });
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("Esta tentativa já foi usada com outros dados") });
    expect(m.tx.usuario.create).toHaveBeenCalledTimes(1);
  });

  it("sem chave, o e-mail repetido continua recusado", async () => {
    await criarUsuario(entrada);
    expect(await criarUsuario(entrada)).toEqual({ ok: false, erro: "Já existe usuário com esse e-mail." });
  });
});
