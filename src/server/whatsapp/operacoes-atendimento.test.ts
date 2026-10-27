import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  escopo: vi.fn(),
  db: {
    oportunidade: { findMany: vi.fn(), count: vi.fn() },
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
  temPapel: (u: { papeis: Papel[] }, ...alvo: Papel[]) => u.papeis.includes(Papel.ADMINISTRADOR) || u.papeis.some((p) => alvo.includes(p)),
  ErroRegra: class extends Error {},
  executarAcao: vi.fn(),
  exigirSessaoComPapel: vi.fn(),
  registrarEvento: vi.fn(),
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: m.escopo }));
vi.mock("@/server/diario/permissoes", () => ({ escopoTurmasDocente: vi.fn(() => ({})) }));

import { listarOpcoesAtendimento } from "./operacoes-atendimento";

const LINHA_DE_V1 = { id: "linha-v1", rotulo: "Vendas — V1", finalidade: "VENDAS", donoId: "v1" };
const COBRANCA = { id: "cobranca", rotulo: "Cobrança", finalidade: "COBRANCA", donoId: null };

function entrar(id: string, ...papeis: Papel[]) {
  m.sessao.mockResolvedValue({ id, nome: "Teste", papeis });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.escopo.mockImplementation(async (u: { id: string; papeis: Papel[] }) => u.papeis.includes(Papel.ADMINISTRADOR) ? {} : { vendedorDonoId: u.id });
  for (const f of [m.db.oportunidade.findMany, m.db.turma.findMany, m.db.aluno.findMany, m.db.matricula.findMany, m.db.usuario.findMany]) f.mockResolvedValue([]);
  m.db.oportunidade.count.mockResolvedValue(1);
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
    m.db.oportunidade.findMany.mockResolvedValue([{ id: "lead-1", nome: "Ana", professorExperimentalId: null, etapa: "NOVO" }]);
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

describe("C3 — seleção limitada determinística e contagem somente para escopo restrito", () => {
  const lead = (id: string, professorExperimentalId: string | null = null) => ({ id, nome: id, professorExperimentalId, etapa: professorExperimentalId ? "EXPERIMENTAL_AGENDADA" : "NOVO" });
  it("ordena os 200 cadastros por criação e desempata por id, ambos descendentes", async () => {
    entrar("admin", Papel.ADMINISTRADOR);
    await listarOpcoesAtendimento();
    expect(m.db.oportunidade.findMany).toHaveBeenCalledExactlyOnceWith({ where: {}, take: 200, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, nome: true, professorExperimentalId: true, etapa: true } });
  });
  it.each([Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL])("escopo canônico vazio de %s não faz COUNT por lead", async papel => {
    entrar("ator", papel); m.escopo.mockResolvedValue({});
    m.db.oportunidade.findMany.mockResolvedValue([lead("l2"), lead("l1")]);
    expect((await listarOpcoesAtendimento()).destinos.map(d => d.chave)).toEqual(["COMERCIAL:l2", "COMERCIAL:l1"]);
    expect(m.db.oportunidade.count).not.toHaveBeenCalled();
  });
  it.each([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR])("escopo restrito de %s conserva COUNT e exclui o lead recusado", async papel => {
    entrar("ator", papel); const scope = { vendedorDonoId: { in: ["ator", "equipe"] } }; m.escopo.mockResolvedValue(scope);
    m.db.oportunidade.findMany.mockResolvedValue([lead("permitido"), lead("negado")]);
    m.db.oportunidade.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect((await listarOpcoesAtendimento()).destinos.map(d => d.chave)).toEqual(["COMERCIAL:permitido"]);
    expect(m.db.oportunidade.count).toHaveBeenCalledTimes(2);
    expect(m.db.oportunidade.count).toHaveBeenNthCalledWith(2, { where: { AND: [{ id: "negado" }, scope] } });
  });
  it("perfil misto conserva destino acadêmico próprio quando o comercial é recusado", async () => {
    entrar("ator", Papel.VENDEDOR, Papel.PROFESSOR);
    m.db.oportunidade.findMany.mockResolvedValue([lead("comercial"), lead("experimental", "ator")]);
    m.db.oportunidade.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect((await listarOpcoesAtendimento()).destinos.map(d => d.chave)).toEqual(["COMERCIAL:comercial", "PEDAGOGICO:experimental"]);
    expect(m.db.oportunidade.count).toHaveBeenCalledTimes(2);
    expect(m.db.oportunidade.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ vendedorDonoId: "ator" }, { professorExperimentalId: "ator", etapa: "EXPERIMENTAL_AGENDADA" }] } }));
  });
  it("professor sem escopo comercial conserva só experimental e não conta leads", async () => {
    entrar("ator", Papel.PROFESSOR);
    m.db.oportunidade.findMany.mockResolvedValue([lead("experimental", "ator")]);
    expect((await listarOpcoesAtendimento()).destinos.map(d => d.chave)).toEqual(["PEDAGOGICO:experimental"]);
    expect(m.escopo).not.toHaveBeenCalled(); expect(m.db.oportunidade.count).not.toHaveBeenCalled();
  });
});