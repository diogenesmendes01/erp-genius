import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (1º lote): "Nova oportunidade" (funil) chama `criarLead` com chave de idempotência. Um reenvio
// com a mesma chave não cria segunda oportunidade, Pessoa, Empresa nem Evento: devolve o mesmo id.

// Sessão: só `exigirSessao` é trocada, e os papéis continuam lidos do banco (`carregarUsuarioFresco`).
// O mock de `@/lib/auth` usado nas outras suítes não serve aqui: dois `import("@/lib/auth")` simultâneos
// (o teste de envio concorrente) escapam do vi.mock no Vitest e carregam o NextAuth real.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarLead } from "./acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outroVendedor: Awaited<ReturnType<typeof criarUsuario>>;

async function contagens() {
  return {
    oportunidades: await prisma.oportunidade.count(),
    pessoas: await prisma.pessoa.count(),
    empresas: await prisma.empresa.count(),
    eventos: await prisma.evento.count(),
    criados: await prisma.evento.count({ where: { tipo: "LeadCriado" } }),
  };
}

beforeAll(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
});

beforeEach(() => {
  sessao.usuarioId = vendedor.id;
});

describe("criarLead com chave de idempotência (#166)", () => {
  it("a mesma chave duas vezes cria uma oportunidade e um Evento, e devolve o mesmo resultado", async () => {
    const entrada = { nome: "Carla Souza", telefoneE164: "+5511988887777", email: "carla@teste.br", chaveIdempotencia: "chave-lead-0001" };
    const antes = await contagens();
    const primeira = await criarLead(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const depoisDaPrimeira = await contagens();
    expect(depoisDaPrimeira.oportunidades - antes.oportunidades).toBe(1);
    expect(depoisDaPrimeira.pessoas - antes.pessoas).toBe(1);
    expect(depoisDaPrimeira.criados - antes.criados).toBe(1);

    const segunda = await criarLead(entrada);
    expect(segunda).toEqual(primeira);
    expect(await contagens()).toEqual(depoisDaPrimeira);
  });

  it("dois envios simultâneos com a mesma chave criam uma só oportunidade", async () => {
    const entrada = { nome: "Davi Lima", chaveIdempotencia: "chave-lead-0002" };
    const antes = await contagens();
    const [a, b] = await Promise.all([criarLead(entrada), criarLead(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    const depois = await contagens();
    expect(depois.oportunidades - antes.oportunidades).toBe(1);
    expect(depois.criados - antes.criados).toBe(1);
  });

  it("no modo Empresa, o reenvio não cria segunda Empresa", async () => {
    const entrada = { nome: "Acme Idiomas", b2b: true, criarEmpresa: true, chaveIdempotencia: "chave-lead-0003" };
    const primeira = await criarLead(entrada);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    const depoisDaPrimeira = await contagens();
    expect(await criarLead(entrada)).toEqual(primeira);
    expect(await contagens()).toEqual(depoisDaPrimeira);
    expect(await prisma.evento.count({ where: { tipo: "EmpresaCriada" } })).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem gravar nada", async () => {
    expect((await criarLead({ nome: "Elisa", chaveIdempotencia: "chave-lead-0004" })).ok).toBe(true);
    const antes = await contagens();
    const outra = await criarLead({ nome: "Fábio", chaveIdempotencia: "chave-lead-0004" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await contagens()).toEqual(antes);
  });

  it("chaves diferentes criam oportunidades diferentes, e a chave é de cada autor", async () => {
    const antes = await contagens();
    const a = await criarLead({ nome: "Gabi", chaveIdempotencia: "chave-lead-0005" });
    const b = await criarLead({ nome: "Gabi", chaveIdempotencia: "chave-lead-0006" });
    sessao.usuarioId = outroVendedor.id;
    const c = await criarLead({ nome: "Gabi", chaveIdempotencia: "chave-lead-0005" });
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    expect(new Set([a, b, c].map((r) => (r.ok ? r.dado!.id : ""))).size).toBe(3);
    expect((await contagens()).oportunidades - antes.oportunidades).toBe(3);
  });

  it("sem chave continua criando como antes", async () => {
    const antes = await contagens();
    expect((await criarLead({ nome: "Hugo" })).ok).toBe(true);
    expect((await criarLead({ nome: "Hugo" })).ok).toBe(true);
    expect((await contagens()).oportunidades - antes.oportunidades).toBe(2);
  });
});
