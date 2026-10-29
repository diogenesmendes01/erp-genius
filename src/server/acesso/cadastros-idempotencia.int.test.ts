import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

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
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      o.exigirPapel(u, ...papeis);
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarUsuario as criarUsuarioAcao } from "./acoes";
import { criarPais } from "@/server/paises/acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";

let admin: Awaited<ReturnType<typeof criarUsuario>>;

beforeAll(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
});

beforeEach(() => {
  sessao.usuarioId = admin.id;
});

const pais = (codigoISO: string) => ({ nome: `País ${codigoISO}`, codigoISO, moedaLocal: "USD", ddi: "+507", fuso: "America/Panama", idioma: "es", tiposDocumento: [{ nome: "Cédula", validador: "passaporte" }] });
const usuario = (email: string) => ({ nome: "Pessoa nova", email, papeis: [Papel.VENDEDOR], limiteDescontoPct: null, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, gerenteComercialId: null, permissoes: [], senha: "segredo1" });

describe("criarPais com chave de idempotência", () => {
  it("a mesma chave duas vezes cria um país e um Evento e devolve o mesmo id", async () => {
    const r1 = await criarPais({ ...pais("PA"), chaveIdempotencia: "chave-pais-0001" });
    const r2 = await criarPais({ ...pais("PA"), chaveIdempotencia: "chave-pais-0001" });
    expect(r1.ok && r2.ok && !!r1.dado?.id && r1.dado.id === r2.dado?.id).toBe(true);
    expect(await prisma.pais.count({ where: { codigoISO: "PA" } })).toBe(1);
    expect(await prisma.tipoDocumento.count({ where: { pais: { codigoISO: "PA" } } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "PaisCriado", agregadoTipo: "Pais" } })).toBe(1);
  });

  it("envio simultâneo com a mesma chave cria um só país", async () => {
    const [a, b] = await Promise.all([
      criarPais({ ...pais("SV"), chaveIdempotencia: "chave-pais-0002" }),
      criarPais({ ...pais("SV"), chaveIdempotencia: "chave-pais-0002" }),
    ]);
    expect(a.ok && b.ok && !!a.dado?.id && a.dado.id === b.dado?.id).toBe(true);
    expect(await prisma.pais.count({ where: { codigoISO: "SV" } })).toBe(1);
  });

  it("a mesma chave com outros dados é conflito, e sem chave o código repetido é recusado", async () => {
    await criarPais({ ...pais("CR"), chaveIdempotencia: "chave-pais-0003" });
    const conflito = await criarPais({ ...pais("CR"), nome: "Outro nome", chaveIdempotencia: "chave-pais-0003" });
    expect(conflito.ok).toBe(false);
    const semChave = await criarPais(pais("CR"));
    expect(semChave.ok ? null : semChave.erro).toBe("Já existe país com código CR.");
    expect(await prisma.pais.count({ where: { codigoISO: "CR" } })).toBe(1);
  });
});

describe("criarUsuario com chave de idempotência", () => {
  it("a mesma chave duas vezes cria um usuário e devolve o mesmo id", async () => {
    const r1 = await criarUsuarioAcao({ ...usuario("nova@escola.test"), chaveIdempotencia: "chave-usuario-0001" });
    const r2 = await criarUsuarioAcao({ ...usuario("nova@escola.test"), chaveIdempotencia: "chave-usuario-0001" });
    expect(r1.ok && r2.ok && !!r1.dado?.id && r1.dado.id === r2.dado?.id).toBe(true);
    expect(await prisma.usuario.count({ where: { email: "nova@escola.test" } })).toBe(1);
    const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "UsuarioCriado", agregadoId: r1.ok ? r1.dado?.id ?? "" : "" } });
    expect(JSON.stringify(evento.payload)).not.toContain("segredo1");
  });

  it("envio simultâneo com a mesma chave cria um só usuário", async () => {
    const [a, b] = await Promise.all([
      criarUsuarioAcao({ ...usuario("paralela@escola.test"), chaveIdempotencia: "chave-usuario-0002" }),
      criarUsuarioAcao({ ...usuario("paralela@escola.test"), chaveIdempotencia: "chave-usuario-0002" }),
    ]);
    expect(a.ok && b.ok && !!a.dado?.id && a.dado.id === b.dado?.id).toBe(true);
    expect(await prisma.usuario.count({ where: { email: "paralela@escola.test" } })).toBe(1);
  });

  it("a mesma chave com outros dados é conflito", async () => {
    await criarUsuarioAcao({ ...usuario("conflito@escola.test"), chaveIdempotencia: "chave-usuario-0003" });
    const r = await criarUsuarioAcao({ ...usuario("conflito@escola.test"), nome: "Outro nome", chaveIdempotencia: "chave-usuario-0003" });
    expect(r.ok).toBe(false);
  });
});
