import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tx: {} as Record<string, unknown>, sessao: vi.fn(), bloquear: vi.fn(), consolidado: vi.fn(), frequencia: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
vi.mock("./sessao", () => ({ exigirSessaoPortalAluno: m.sessao }));
vi.mock("@/server/avaliacoes/lancamento-tx", () => ({ bloquearLancamento: m.bloquear }));
vi.mock("@/server/avaliacoes/consolidado-tx", () => ({ coletarConsolidadoAvaliacoesDoVinculoTx: m.consolidado }));
vi.mock("@/server/avaliacoes/frequencia-nivel-tx", () => ({ carregarFrequenciaNivelTx: m.frequencia, simularFrequenciaCorrecaoAulaTx: m.frequencia }));

import { regraLegadaIlegivel, regrasLegadasPortugues } from "@/test/regra-avaliacao";
import { consultarFechamentosPortalAluno } from "./fechamentos";

const alocacao = { id: "aloc", matriculaId: "mat", turmaId: "turma", criadoEm: new Date("2026-01-01T00:00:00Z"), turma: { nivelId: "nivel" } };
function cenario(conteudo: unknown) {
  m.sessao.mockResolvedValue({ sessaoId: "s", contaId: "c", alunoId: "aluno", email: "a@example.test" });
  m.bloquear.mockResolvedValue({ id: "aloc", matriculaId: "mat", turmaId: "turma" });
  m.tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValue([{ alunoId: "aluno" }]),
    alocacaoTurma: {
      findMany: vi.fn().mockImplementation(({ select }: { select: { turma?: { select?: { regraAvaliacaoId?: true } } } }) =>
        Promise.resolve(select.turma?.select?.regraAvaliacaoId ? [{ id: "aloc", turmaId: "turma", turma: { regraAvaliacaoId: "regra" } }] : [alocacao])),
      findFirst: vi.fn().mockResolvedValue({ id: "aloc" }),
    },
    turma: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "turma", nivelId: "nivel", regraAvaliacao: { id: "regra", conteudo } }) },
    fechamentoAcademico: { findFirst: vi.fn().mockResolvedValue({ alocacaoReferenciaId: "aloc", regraId: "regra", estadoHash: "h", resultadoSuficiente: true, versao: 3, confirmadoEm: new Date("2026-10-01T12:00:00Z") }) },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("#530 C3 portal do aluno com regra legada", () => {
  it.each<[string, unknown]>([["ilegível", regraLegadaIlegivel()], ...Object.entries(regrasLegadasPortugues()).map(([c, r]): [string, unknown] => [`Português ${c}`, r])])(
    "regra %s → EM_REVISAO sem resumo e nada calculado", async (_n, conteudo) => {
      cenario(conteudo);
      const r = await consultarFechamentosPortalAluno();
      expect(r).toEqual([{ matriculaId: "mat", nivelId: "nivel", estado: "EM_REVISAO", resumo: null, versao: 3, confirmadoEm: "2026-10-01T12:00:00.000Z" }]);
      expect(JSON.stringify(r)).not.toContain("Required");
      expect(m.consolidado).not.toHaveBeenCalled();
      expect(m.frequencia).not.toHaveBeenCalled();
    });
});
