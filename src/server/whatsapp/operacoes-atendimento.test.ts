import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Travas UNITÁRIAS de listarOpcoesAtendimento no `npm test` comum (Prisma mockado): o sinal
// `comercial` segue o papel do usuário, e sem destinatário no escopo os canais não são listados
// (a tela explica o motivo em vez de acusar falta de canal).

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  db: {
    lead: { findMany: vi.fn(), count: vi.fn() },
    turma: { findMany: vi.fn() },
    aluno: { findMany: vi.fn() },
    matricula: { findMany: vi.fn() },
    numeroWhatsApp: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessao: m.sessao,
  // Mesma regra de src/server/_shared/sessao.ts: administrador tem todo papel.
  temPapel: (u: { papeis: Papel[] }, ...alvo: Papel[]) => u.papeis.includes(Papel.ADMINISTRADOR) || u.papeis.some((p) => alvo.includes(p)),
  ErroRegra: class extends Error {},
  executarAcao: vi.fn(),
  exigirSessaoComPapel: vi.fn(),
  registrarEvento: vi.fn(),
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: vi.fn(async () => ({})) }));
vi.mock("@/server/diario/permissoes", () => ({ escopoTurmasDocente: vi.fn(() => ({})) }));

import { listarOpcoesAtendimento } from "./operacoes-atendimento";

const LINHA_DE_V1 = { id: "linha-v1", rotulo: "Vendas — V1", finalidade: "VENDAS", donoId: "v1" };
const COBRANCA = { id: "cobranca", rotulo: "Cobrança", finalidade: "COBRANCA", donoId: null };

function entrar(id: string, ...papeis: Papel[]) {
  m.sessao.mockResolvedValue({ id, nome: "Teste", papeis });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [m.db.lead.findMany, m.db.turma.findMany, m.db.aluno.findMany, m.db.matricula.findMany, m.db.usuario.findMany]) f.mockResolvedValue([]);
  m.db.lead.count.mockResolvedValue(1);
  // Canais ativos EXISTEM: se a checagem de "sem destino" cair, eles vazariam para a tela.
  m.db.numeroWhatsApp.findMany.mockResolvedValue([LINHA_DE_V1, COBRANCA]);
});

describe("listarOpcoesAtendimento — sem destinatário no escopo", () => {
  it("vendedor sem lead: nenhum canal listado nem consultado, e sinalizado como comercial", async () => {
    entrar("v1", Papel.VENDEDOR);
    expect(await listarOpcoesAtendimento()).toEqual({ destinos: [], numeros: [], comercial: true });
    expect(m.db.numeroWhatsApp.findMany).not.toHaveBeenCalled();
  });

  it("gerente comercial sem lead na equipe: comercial", async () => {
    entrar("g1", Papel.GERENTE_COMERCIAL);
    expect(await listarOpcoesAtendimento()).toEqual({ destinos: [], numeros: [], comercial: true });
  });

  it("professor sem turma nem experimental: não comercial, sem canais", async () => {
    entrar("p1", Papel.PROFESSOR);
    expect(await listarOpcoesAtendimento()).toEqual({ destinos: [], numeros: [], comercial: false });
    expect(m.db.numeroWhatsApp.findMany).not.toHaveBeenCalled();
  });

  it("financeiro sem matrícula: não comercial, sem canais", async () => {
    entrar("f1", Papel.FINANCEIRO);
    expect(await listarOpcoesAtendimento()).toEqual({ destinos: [], numeros: [], comercial: false });
  });
});

describe("listarOpcoesAtendimento — com destinatário", () => {
  it("vendedor com lead: comercial, canais listados e só a própria linha aceita o assunto comercial", async () => {
    entrar("v1", Papel.VENDEDOR);
    m.db.lead.findMany.mockResolvedValue([{ id: "lead-1", nome: "Ana", professorExperimentalId: null, etapa: "NOVO" }]);
    const r = await listarOpcoesAtendimento();
    expect(r.comercial).toBe(true);
    expect(r.destinos.map((d) => d.chave)).toEqual(["COMERCIAL:lead-1"]);
    expect(r.numeros).toEqual([
      { id: "linha-v1", nome: "Vendas — V1", comercial: true },
      { id: "cobranca", nome: "Cobrança", comercial: false },
    ]);
  });

  it("secretaria com aluno: não comercial, canais listados, nenhum aceita assunto comercial", async () => {
    entrar("s1", Papel.SECRETARIA_ACADEMICA);
    m.db.aluno.findMany.mockResolvedValue([{ id: "a1", primeiroNome: "Bia", sobrenome: null, telefoneE164: null, whatsapp: false, responsaveis: [], alocacoes: [] }]);
    const r = await listarOpcoesAtendimento();
    expect(r.comercial).toBe(false);
    expect(r.destinos.map((d) => d.chave)).toEqual(["SECRETARIA:a1"]);
    expect(r.numeros.map((n) => [n.id, n.comercial])).toEqual([["linha-v1", false], ["cobranca", false]]);
  });
});
