import { describe, expect, it } from "vitest";
import {
  chaveRequisitoAproveitamento,
  projetarAproveitamentoAplicado,
  type ContextoAproveitamentoAplicado,
} from "./aproveitamento-aplicado-tx";
import type { FonteOficialEquivalencia } from "./equivalencia-transferencia";

const hash = "a".repeat(64);
const contexto: ContextoAproveitamentoAplicado = {
  matriculaId: "matricula-1", alocacaoDestinoId: "alocacao-b", turmaDestinoId: "turma-b",
  nivelDestinoId: "nivel-1", regraDestinoId: "regra-b",
};
const aplicacao = {
  id: "aplicacao-1", aplicacaoHash: "b".repeat(64),
  alocacaoOrigemId: "alocacao-a", alocacaoDestinoId: "alocacao-b",
};
const fonte: FonteOficialEquivalencia = {
  tipoFonte: "REGULAR", referenciaId: "lancamento-a:FALA", matriculaId: "matricula-1",
  nivelId: "nivel-1", alocacaoId: "alocacao-a", turmaId: "turma-a", regraId: "regra-a",
  codigoAvaliacao: "A1", habilidade: "FALA", nota: "8", oficial: true, fonteHash: hash,
  registroId: "registro-a", lancamentoId: "lancamento-a", decisaoLancamentoId: "decisao-a",
  autorLancamentoId: "autor-a", versaoLancamento: 1,
  correcaoId: null, decisaoCorrecaoId: null, versaoCorrecao: null,
};
const requisitos = [
  { codigoAvaliacao: "B1", habilidade: "FALA" as const },
  { codigoAvaliacao: "B1", habilidade: "ESCRITA" as const },
];
const mapeamentos = [{ referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "B1", habilidadeDestino: "FALA" as const }];

function projetar(overrides: Partial<Parameters<typeof projetarAproveitamentoAplicado>[0]> = {}) {
  return projetarAproveitamentoAplicado({
    contexto, aplicacao, requisitos, mapeamentos, fontesSnapshot: [fonte], fontesAtuais: [fonte], chavesLocais: new Set(),
    ...overrides,
  });
}

describe("projetarAproveitamentoAplicado", () => {
  it("usa a nota aplicada somente no requisito sem lançamento local e preserva a cadeia", () => {
    const resultado = projetar();
    expect(resultado.itens).toMatchObject([
      { codigoAvaliacao: "B1", habilidade: "FALA", situacao: "APROVEITADO", notaParaConsolidado: "8" },
      { codigoAvaliacao: "B1", habilidade: "ESCRITA", situacao: "PENDENTE_SEM_FONTE", notaParaConsolidado: null },
    ]);
    expect(resultado.itens[0]?.fonte).toMatchObject({
      tipoFonte: "APROVEITAMENTO", escopoFonte: "REQUISITO_DESTINO", codigoAvaliacao: "B1",
      aplicacaoId: "aplicacao-1", referenciaFonteAplicadaId: fonte.referenciaId, fonteAplicadaHash: hash,
    });
    expect(resultado.pendencias).toEqual([{ codigoAvaliacao: "B1", habilidade: "ESCRITA", situacao: "PENDENTE_SEM_FONTE", referenciaFonteAplicadaId: null }]);
  });

  it("não reaproveita silenciosamente uma fonte cuja cadeia mudou", () => {
    const alterada = { ...fonte, fonteHash: "c".repeat(64), nota: "9" } as FonteOficialEquivalencia;
    const resultado = projetar({ fontesAtuais: [alterada] });
    expect(resultado.itens[0]).toMatchObject({ situacao: "PENDENTE_FONTE_ALTERADA", notaParaConsolidado: null, fonte: null });
    expect(resultado.pendencias).toEqual([{ codigoAvaliacao: "B1", habilidade: "FALA", situacao: "PENDENTE_FONTE_ALTERADA", referenciaFonteAplicadaId: fonte.referenciaId },
      { codigoAvaliacao: "B1", habilidade: "ESCRITA", situacao: "PENDENTE_SEM_FONTE", referenciaFonteAplicadaId: null }]);
  });

  it("declara conflito e deixa a nota local oficial prevalecer", () => {
    const resultado = projetar({
      fontesAtuais: [{ ...fonte, fonteHash: "c".repeat(64) }],
      chavesLocais: new Set([chaveRequisitoAproveitamento("B1", "FALA")]),
    });
    expect(resultado.itens[0]).toMatchObject({ situacao: "LOCAL_OFICIAL_PREVALECE", notaParaConsolidado: null });
    expect(resultado.conflitosLocais).toEqual([{ codigoAvaliacao: "B1", habilidade: "FALA", referenciaFonteAplicadaId: fonte.referenciaId }]);
    expect(resultado.fontesAproveitadas).toHaveLength(0);
    expect(resultado.pendencias).not.toContainEqual(expect.objectContaining({ habilidade: "FALA" }));
    const semMapa = projetar({
      mapeamentos: [],
      chavesLocais: new Set([chaveRequisitoAproveitamento("B1", "FALA")]),
    });
    expect(semMapa.itens[0]).toMatchObject({ situacao: "LOCAL_OFICIAL_PREVALECE", referenciaFonteAplicadaId: null });
    expect(semMapa.pendencias).not.toContainEqual(expect.objectContaining({ habilidade: "FALA" }));
  });

  it("mantém a referência aplicada dentro do limite com código de avaliação máximo", () => {
    const codigo = "A".repeat(100);
    const resultado = projetar({
      requisitos: [{ codigoAvaliacao: codigo, habilidade: "FALA" }],
      mapeamentos: [{ referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: codigo, habilidadeDestino: "FALA" }],
    });
    expect(resultado.itens[0]?.fonte?.referenciaId).toMatch(/^aproveitamento:[a-f0-9]{64}$/);
    expect(resultado.itens[0]?.fonte?.referenciaId.length).toBeLessThanOrEqual(100);
  });
});
