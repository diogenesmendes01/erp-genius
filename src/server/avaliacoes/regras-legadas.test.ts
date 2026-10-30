import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), tx: {} as Record<string, unknown>, contexto: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
vi.mock("@/server/_shared", async () => {
  const sessao = await vi.importActual<typeof import("@/server/_shared/sessao")>("@/server/_shared/sessao");
  const resultado = await vi.importActual<typeof import("@/server/_shared/resultado")>("@/server/_shared/resultado");
  return { ...sessao, ...resultado, exigirSessaoComPapel: m.sessao, registrarEvento: vi.fn() };
});
vi.mock("./migracao-regra-tx", async () => {
  const real = await vi.importActual<typeof import("./migracao-regra-tx")>("./migracao-regra-tx");
  return { ...real, bloquearMigracaoRegra: vi.fn(), contextoMigracaoRegra: m.contexto };
});

import { ErroRegra } from "@/server/_shared/sessao";
import { regraAvaliacaoTeste, regraLegadaIlegivel, regrasLegadasPortugues } from "@/test/regra-avaliacao";
import { consultarRegrasAvaliacao } from "./regras";
import { decidirRegraAvaliacaoTx } from "./regras-tx";
import { consultarMigracoesRegra } from "./migracao-regra";
import { MENSAGEM_REGRA_FORMATO_ANTIGO } from "./regra-conteudo";

const preparador = { id: "preparador", nome: "Gestora" };
const versao = (id: string, conteudo: unknown, v = 1) => ({ id, nivelId: "nivel", versao: v, conteudo, conteudoHash: "a".repeat(64), motivo: "Regra legada",
  criadaEm: new Date("2026-09-01T00:00:00Z"), preparador, decisao: null });

function txNivel(codigo: string, regras: ReturnType<typeof versao>[]) {
  m.tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
    usuario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["GERENTE_PEDAGOGICO"] }) },
    nivel: { findUnique: vi.fn().mockResolvedValue({ id: "nivel", codigo, idioma: { nome: "Português" } }) },
    versaoRegraAvaliacao: { findMany: vi.fn().mockResolvedValue(regras), findFirst: vi.fn().mockImplementation(({ where }: { where: { decisao?: unknown } }) =>
      Promise.resolve(where.decisao ? null : regras[0] ? { id: regras[0].id, versao: regras[0].versao } : null)) },
  };
}

beforeEach(() => { vi.clearAllMocks(); m.sessao.mockResolvedValue({ id: "decisor" }); vi.spyOn(console, "warn").mockImplementation(() => {}); });

describe("#530 consultarRegrasAvaliacao com versões legadas", () => {
  it.each(Object.entries(regrasLegadasPortugues()))("Português %s abre com aviso, sem 'Required', e o JSON salvo fica intacto", async (codigo, raw) => {
    const antes = JSON.stringify(raw);
    txNivel(codigo, [versao(`regra-${codigo}`, raw)]);
    const r = await consultarRegrasAvaliacao({ nivelId: "nivel" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(JSON.stringify(r)).not.toContain("Required");
    expect(r.dado.nivel.codigo).toBe(codigo);
    expect(r.dado.regras[0]).toMatchObject({ legado: true, ilegivel: false, podeDecidir: false, podeAprovar: false, conteudo: { titulo: `Português ${codigo}` } });
    expect(JSON.stringify(raw)).toBe(antes);
  });

  it("versão ilegível não derruba a página nem pode ser decidida; versão atual segue decidível", async () => {
    txNivel("B1", [versao("ilegivel", regraLegadaIlegivel(), 2), versao("valida", regraAvaliacaoTeste(), 1)]);
    const r = await consultarRegrasAvaliacao({ nivelId: "nivel" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(r.dado.regras[0]).toMatchObject({ id: "ilegivel", conteudo: null, legado: true, ilegivel: true, podeDecidir: false, podeAprovar: false });
    expect(r.dado.regras[1]).toMatchObject({ id: "valida", legado: false, ilegivel: false, podeDecidir: true });
    expect(console.warn).toHaveBeenCalledWith("regra-avaliacao-legada", { regraId: "ilegivel", caminhos: ["titulo"] });
  });

  it("WARN-532-01: última versão ilegível → formulário parte da legível mais recente", async () => {
    txNivel("B1", [versao("ilegivel", regraLegadaIlegivel(), 2), versao("valida", regraAvaliacaoTeste(), 1)]);
    const r = await consultarRegrasAvaliacao({ nivelId: "nivel" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(r.dado.conteudoInicial).toEqual(regraAvaliacaoTeste());
  });

  it("WARN-532-01: legível fora da página atual também é encontrada", async () => {
    const pagina = Array.from({ length: 21 }, (_, i) => versao(`ilegivel-${i}`, regraLegadaIlegivel(), 30 - i));
    txNivel("B1", pagina);
    const findMany = (m.tx.versaoRegraAvaliacao as { findMany: ReturnType<typeof vi.fn> }).findMany;
    findMany.mockResolvedValueOnce(pagina).mockResolvedValueOnce([...pagina, { conteudo: regrasLegadasPortugues().B1 }]);
    const r = await consultarRegrasAvaliacao({ nivelId: "nivel" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(r.dado.conteudoInicial).toMatchObject({ titulo: "Português B1" });
  });

  it("WARN-532-01: nenhuma versão legível → formulário vazio", async () => {
    txNivel("B1", [versao("ilegivel", regraLegadaIlegivel(), 2), versao("ilegivel-2", regraLegadaIlegivel(), 1)]);
    const r = await consultarRegrasAvaliacao({ nivelId: "nivel" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(r.dado.conteudoInicial).toBeNull();
  });

  it("Pré A1/C1/C2 sem versão seguem iguais", async () => {
    for (const codigo of ["Pré A1", "C1", "C2"]) {
      txNivel(codigo, []);
      expect(await consultarRegrasAvaliacao({ nivelId: "nivel" })).toMatchObject({ ok: true, dado: { regras: [], vigente: null, ultimaVersao: 0 } });
    }
  });
});

describe("#530 decisão de versão legada falha fechado", () => {
  it.each(Object.entries(regrasLegadasPortugues()))("Português %s não é aprovado e nada é gravado", async (_c, raw) => {
    const create = vi.fn();
    const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn(),
      usuario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["GERENTE_PEDAGOGICO"] }) },
      versaoRegraAvaliacao: { findUnique: vi.fn().mockResolvedValue({ nivelId: "nivel" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "r", nivelId: "nivel", versao: 1, preparadorId: "outro", conteudo: raw, conteudoHash: "a".repeat(64), decisao: null }) },
      decisaoRegraAvaliacao: { create } };
    await expect(decidirRegraAvaliacaoTx(tx as never, "decisor", { regraId: "r", conteudoHash: "a".repeat(64), aprovada: true, motivo: "Aprovar regra legada" }))
      .rejects.toThrow(ErroRegra);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("#530 consultarMigracoesRegra com origem legada (qa_turma_aberta-b1 / qa_turma_aberta-kids)", () => {
  it.each([["qa_turma_aberta-b1", "B1"], ["qa_turma_aberta-kids", "A1"]] as const)("%s abre com origem legada e decisão bloqueada", async (turmaId, nivel) => {
    const raw = regrasLegadasPortugues()[nivel];
    m.contexto.mockRejectedValue(new ErroRegra(MENSAGEM_REGRA_FORMATO_ANTIGO));
    const proposta = { id: "p1", versao: 1, estadoHash: "b".repeat(64), motivo: "Migrar", criadaEm: new Date(), snapshot: { encontros: [], alocacoes: [{ ativa: true }] },
      preparador: { id: "outro", nome: "Outra" }, origem: { id: "origem", versao: 1, conteudo: raw }, destino: { id: "destino", versao: 2, conteudo: regraAvaliacaoTeste() }, decisao: null };
    m.tx = { propostaMigracaoRegraTurma: { findMany: vi.fn().mockResolvedValue([proposta]), findFirst: vi.fn().mockResolvedValue({ id: "p1" }) } };
    const r = await consultarMigracoesRegra({ turmaId });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(JSON.stringify(r)).not.toContain("Required");
    expect(r.dado.propostas[0]).toMatchObject({ pendencia: MENSAGEM_REGRA_FORMATO_ANTIGO, podeDecidir: false, podeAprovar: false,
      origem: { legado: true, ilegivel: false }, destino: { legado: false } });
    expect(r.dado.propostas[0].alteracoes.length).toBeGreaterThan(0);
  });

  it("origem ilegível vira conteúdo nulo, sem exceção", async () => {
    m.contexto.mockResolvedValue({ estadoHash: "b".repeat(64) });
    const proposta = { id: "p1", versao: 1, estadoHash: "b".repeat(64), motivo: "Migrar", criadaEm: new Date(), snapshot: { encontros: [], alocacoes: [] },
      preparador: { id: "outro", nome: "Outra" }, origem: { id: "origem", versao: 1, conteudo: regraLegadaIlegivel() }, destino: { id: "destino", versao: 2, conteudo: regraAvaliacaoTeste() }, decisao: null };
    m.tx = { propostaMigracaoRegraTurma: { findMany: vi.fn().mockResolvedValue([proposta]), findFirst: vi.fn().mockResolvedValue({ id: "p1" }) } };
    const r = await consultarMigracoesRegra({ turmaId: "qa_turma_aberta-kids" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    expect(r.dado.propostas[0]).toMatchObject({ origem: { conteudo: null, ilegivel: true }, podeDecidir: false });
  });
});
