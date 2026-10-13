import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// docs/42 /login #2 e docs/43 §6 item 8: sem sessão, o guard da página manda para o login levando o caminho
// pedido em `callbackUrl` — só quando ele é interno. Banco e NextAuth são mocks (nenhuma consulta real).
const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), cabecalhos: new Map<string, string>(), headersFalha: false, headersSinal: null as Error | null }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: m.usuario } } }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (m.headersSinal) throw m.headersSinal;
    if (m.headersFalha) throw new Error("`headers` was called outside a request scope.");
    return { get: (nome: string) => m.cabecalhos.get(nome) ?? null };
  },
}));

import { CABECALHO_CAMINHO } from "@/lib/destino-interno";
import { exigirSessaoPagina } from "./sessao";

/** A URL do redirect que o guard pediu. */
async function redirecionaPara(): Promise<string> {
  try {
    await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    if (texto.startsWith("REDIRECT:")) return texto.slice("REDIRECT:".length);
    throw e;
  }
  throw new Error("o guard não redirecionou");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.cabecalhos.clear();
  m.headersFalha = false;
  m.headersSinal = null;
  m.auth.mockResolvedValue(null);
});

describe("exigirSessaoPagina — volta à página pedida", () => {
  it("sem sessão, leva o caminho interno pedido em callbackUrl (codificado)", async () => {
    m.cabecalhos.set(CABECALHO_CAMINHO, "/matriculas/m1?aba=contrato");
    expect(await redirecionaPara()).toBe("/login?callbackUrl=%2Fmatriculas%2Fm1%3Faba%3Dcontrato");
  });

  it("usuário desativado (sessão sem usuário fresco) também volta para a página pedida depois do login", async () => {
    m.auth.mockResolvedValue({ user: { id: "desativado" } });
    m.usuario.mockResolvedValue({ nome: "X", papeis: [Papel.SECRETARIA_ACADEMICA], ativo: false, permissoes: [] });
    m.cabecalhos.set(CABECALHO_CAMINHO, "/alunos/a1");
    expect(await redirecionaPara()).toBe("/login?callbackUrl=%2Falunos%2Fa1");
  });

  it("caminho externo ou forjado não vira callbackUrl", async () => {
    for (const forjado of ["//golpe.example", "https://golpe.example", "/\\golpe.example", "/.//golpe.example"]) {
      m.cabecalhos.set(CABECALHO_CAMINHO, forjado);
      expect(await redirecionaPara(), forjado).toBe("/login");
    }
  });

  it("sem o cabeçalho, ou com headers() fora de uma requisição, vai para /login puro", async () => {
    expect(await redirecionaPara()).toBe("/login");
    m.headersFalha = true;
    m.cabecalhos.set(CABECALHO_CAMINHO, "/alunos/a1");
    expect(await redirecionaPara()).toBe("/login");
  });

  it("o sinal de renderização dinâmica do Next não é engolido", async () => {
    const sinal = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    m.headersSinal = sinal;
    await expect(exigirSessaoPagina()).rejects.toBe(sinal);
  });
});
