import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  carregarCorrecao: vi.fn(), impactos: vi.fn(), reposicoes: vi.fn(), comparar: vi.fn(),
  frequencia: vi.fn(), simularFrequencia: vi.fn(), estado: vi.fn(), simularFechamento: vi.fn(),
  financeiro: vi.fn(), reposicoesFrequencia: vi.fn(),
}));
vi.mock("./correcao-aula-tx", () => ({ carregarCorrecaoAulaTx: m.carregarCorrecao }));
vi.mock("@/server/avaliacoes/impactos-reposicao-tx", () => ({ carregarImpactosFrequenciaAulaTx: m.impactos }));
vi.mock("./correcao-aula-reposicoes-tx", () => ({ carregarReposicoesCorrecaoAulaTx: m.reposicoes }));
vi.mock("./correcao-aula-comparacao", () => ({ compararCorrecaoAula: m.comparar }));
vi.mock("@/server/avaliacoes/frequencia-nivel-tx", () => ({ carregarFrequenciaNivelTx: m.frequencia, simularFrequenciaCorrecaoAulaTx: m.simularFrequencia }));
vi.mock("@/server/avaliacoes/fechamento-estado-tx", () => ({ carregarEstadoFechamentoTx: m.estado, simularFechamentoCorrecaoAulaTx: m.simularFechamento }));
vi.mock("./correcao-aula-financeiro-tx", () => ({ carregarDependenciasFinanceirasAulaTx: m.financeiro }));
vi.mock("@/server/avaliacoes/frequencia-reposicoes-tx", () => ({ carregarReposicoesFrequenciaTx: m.reposicoesFrequencia }));

import { ErroRegra } from "@/server/_shared";
import { MENSAGEM_REGRA_FORMATO_ANTIGO } from "@/server/avaliacoes/regra-conteudo";
import { regraAvaliacaoTeste, regraLegadaIlegivel, regrasLegadasPortugues } from "@/test/regra-avaliacao";
import { carregarImpactosCorrecaoAulaTx } from "./correcao-aula-impactos-tx";

function cenario(conteudo: unknown) {
  m.carregarCorrecao.mockResolvedValue({ estadoHash: "e", versaoAtual: 1, snapshot: { registros: [{ matriculaId: "mat", alunoId: "aluno" }] } });
  m.impactos.mockResolvedValue({ matriculaId: "mat", nivelId: "nivel", alocacaoFonteId: "aloc" });
  m.reposicoes.mockResolvedValue({ reposicoes: [], inventarioReposicoes: [] });
  m.comparar.mockReturnValue({ registros: [{ matriculaId: "mat", registroId: "reg", participacaoAlterada: true, antes: { participacao: "PRESENTE" }, depois: { participacao: "FALTA" } }] });
  m.frequencia.mockResolvedValue({ apuradaEm: new Date(), percentual: null });
  m.simularFrequencia.mockResolvedValue({ apuradaEm: new Date(), percentual: null });
  m.financeiro.mockResolvedValue({ exigeConferenciaFinanceira: false });
  m.reposicoesFrequencia.mockResolvedValue(new Map());
  return {
    $executeRaw: vi.fn(),
    propostaCorrecaoAula: { findUnique: vi.fn().mockResolvedValue({ id: "p", encontroId: "enc", estadoHash: "e", versao: 1, entradaHash: "h", rejeicao: null, aprovacao: null, snapshotAnterior: {}, snapshotNovo: {} }) },
    usuario: { findUniqueOrThrow: vi.fn().mockResolvedValue({ papeis: ["GERENTE_PEDAGOGICO"] }) },
    encontroAgenda: { findUniqueOrThrow: vi.fn().mockResolvedValue({ inicio: new Date("2026-10-01T12:00:00Z"), turmaId: "turma", turma: { nivelId: "nivel" } }) },
    alocacaoTurma: { findFirst: vi.fn().mockResolvedValue({ id: "aloc", turma: { regraAvaliacao: { id: "regra", conteudo } } }) },
    propostaRevisaoFinanceiraCorrecaoAula: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("#530 C3 carregarImpactosCorrecaoAulaTx com regra legada", () => {
  it.each<[string, unknown]>([["ilegível", regraLegadaIlegivel()], ...Object.entries(regrasLegadasPortugues()).map(([c, r]): [string, unknown] => [`Português ${c}`, r])])(
    "regra %s vira pendência amigável e nada é calculado", async (_n, conteudo) => {
      const tx = cenario(conteudo);
      const r = await carregarImpactosCorrecaoAulaTx(tx as never, "gestor", "p", new Date("2026-10-02T12:00:00Z"));
      expect(r.simulacoes).toEqual([{ matriculaId: "mat", nivelId: "nivel", regraId: "regra", pendencia: MENSAGEM_REGRA_FORMATO_ANTIGO, antes: null, depois: null }]);
      expect(JSON.stringify(r)).not.toContain("Required");
      expect(m.frequencia).not.toHaveBeenCalled();
      expect(m.simularFrequencia).not.toHaveBeenCalled();
      expect(m.estado).not.toHaveBeenCalled();
      expect(m.simularFechamento).not.toHaveBeenCalled();
    });

  it("ErroRegra de formato antigo no fechamento vira pendência do fechamento, sem estados calculados", async () => {
    const tx = cenario(regraAvaliacaoTeste());
    m.estado.mockRejectedValue(new ErroRegra(MENSAGEM_REGRA_FORMATO_ANTIGO));
    const r = await carregarImpactosCorrecaoAulaTx(tx as never, "gestor", "p", new Date("2026-10-02T12:00:00Z"));
    expect(r.simulacoes[0]).toMatchObject({ pendencia: null, fechamento: { pendencia: MENSAGEM_REGRA_FORMATO_ANTIGO, antes: null, depois: null } });
    expect(m.simularFechamento).not.toHaveBeenCalled();
  });

  it("erro inesperado não é engolido", async () => {
    const tx = cenario(regraAvaliacaoTeste());
    m.estado.mockRejectedValue(new Error("falha de banco"));
    await expect(carregarImpactosCorrecaoAulaTx(tx as never, "gestor", "p")).rejects.toThrow("falha de banco");
  });
});
