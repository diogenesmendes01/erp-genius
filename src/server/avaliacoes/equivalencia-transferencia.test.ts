import { expect, it } from "vitest";
import { projetarEquivalenciaTransferencia } from "./equivalencia-transferencia";

const hash = "a".repeat(64);
const contexto = {
  matriculaId: "matricula-1", nivelOrigemId: "nivel-a1", nivelDestinoId: "nivel-a1",
  alocacaoOrigemId: "alocacao-origem", turmaOrigemId: "turma-origem", turmaDestinoId: "turma-destino",
  regraOrigemId: "regra-origem", regraDestinoId: "regra-destino",
};
const fonte = {
  referenciaId: "fonte-fala", matriculaId: contexto.matriculaId, nivelId: contexto.nivelOrigemId,
  alocacaoId: contexto.alocacaoOrigemId, turmaId: contexto.turmaOrigemId, regraId: contexto.regraOrigemId,
  codigoAvaliacao: "ORIGEM-I1", habilidade: "FALA" as const, nota: "8.5", oficial: true as const,
  registroId: "registro-1", lancamentoId: "lancamento-1", decisaoLancamentoId: "decisao-lancamento-1", autorLancamentoId: "professor-1", realizadaPorId: "professor-1",
  versaoLancamento: 2, correcaoId: "correcao-1", decisaoCorrecaoId: "decisao-correcao-1", versaoCorrecao: 1, fonteHash: hash,
};
const requisitos = [
  { codigoAvaliacao: "DESTINO-I1", habilidade: "FALA" as const, pesoAvaliacao: "1" },
  { codigoAvaliacao: "DESTINO-F1", habilidade: "FALA" as const, pesoAvaliacao: "2" },
  { codigoAvaliacao: "DESTINO-F1", habilidade: "LEITURA" as const, pesoAvaliacao: "2" },
];

it("projeta referências oficiais sem copiar nota e explicita pendências", () => {
  const resultado = projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte], requisitosDestino: requisitos,
    mapeamentos: [{ referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "DESTINO-I1", habilidadeDestino: "FALA" }],
  });
  expect(resultado.itens).toMatchObject([
    { codigoAvaliacao: "DESTINO-I1", habilidade: "FALA", situacao: "APROVEITADO", fonte: { lancamentoId: "lancamento-1", correcaoId: "correcao-1", versaoLancamento: 2 } },
    { codigoAvaliacao: "DESTINO-F1", habilidade: "FALA", situacao: "PENDENTE", fonte: null },
    { codigoAvaliacao: "DESTINO-F1", habilidade: "LEITURA", situacao: "PENDENTE", fonte: null },
  ]);
  expect(JSON.stringify(resultado)).not.toContain('"nota"');
  expect(resultado.pendencias).toEqual([
    { codigoAvaliacao: "DESTINO-F1", habilidade: "FALA", motivo: "SEM_FONTE_EQUIVALENTE" },
    { codigoAvaliacao: "DESTINO-F1", habilidade: "LEITURA", motivo: "SEM_FONTE_EQUIVALENTE" },
  ]);
});

it("rejeita duplicidade por requisito destino", () => {
  const outra = { ...fonte, referenciaId: "fonte-fala-2", lancamentoId: "lancamento-2" };
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte, outra], requisitosDestino: requisitos,
    mapeamentos: [
      { referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "DESTINO-I1", habilidadeDestino: "FALA" },
      { referenciaFonteId: outra.referenciaId, codigoAvaliacaoDestino: "DESTINO-I1", habilidadeDestino: "FALA" },
    ],
  })).toThrow(/mais de uma fonte/);
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte], requisitosDestino: [requisitos[0], requisitos[0]], mapeamentos: [],
  })).toThrow(/informado mais de uma vez/);
});

it("rejeita peso inválido ou inconsistente e habilidade de origem diferente", () => {
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte],
    requisitosDestino: [{ ...requisitos[0], pesoAvaliacao: "0" }],
    mapeamentos: [],
  })).toThrow(/Peso de avaliação/);
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte],
    requisitosDestino: [
      { codigoAvaliacao: "DESTINO-I1", habilidade: "FALA", pesoAvaliacao: "1" },
      { codigoAvaliacao: "DESTINO-I1", habilidade: "LEITURA", pesoAvaliacao: "2" },
    ],
    mapeamentos: [],
  })).toThrow(/mesmo peso/);
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte], requisitosDestino: requisitos,
    mapeamentos: [{ referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "DESTINO-F1", habilidadeDestino: "LEITURA" }],
  })).toThrow(/não pode suprir/);
});

it("permite fonte em requisitos distintos e torna o reaproveitamento auditável", () => {
  const resultado = projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte], requisitosDestino: requisitos,
    mapeamentos: [
      { referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "DESTINO-I1", habilidadeDestino: "FALA" },
      { referenciaFonteId: fonte.referenciaId, codigoAvaliacaoDestino: "DESTINO-F1", habilidadeDestino: "FALA" },
    ],
  });
  expect(resultado.fontesReutilizadas).toEqual([{
    referenciaFonteId: "fonte-fala",
    requisitosDestino: [
      { codigoAvaliacao: "DESTINO-I1", habilidade: "FALA" },
      { codigoAvaliacao: "DESTINO-F1", habilidade: "FALA" },
    ],
  }]);
});

it("recusa fonte fora da matrícula, vínculo ou nível", () => {
  expect(() => projetarEquivalenciaTransferencia({
    contexto: { ...contexto, nivelDestinoId: "nivel-a2" }, fontesOficiais: [fonte], requisitosDestino: requisitos, mapeamentos: [],
  })).toThrow(/mesmo nível/);
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [{ ...fonte, matriculaId: "outra-matricula" }], requisitosDestino: requisitos, mapeamentos: [],
  })).toThrow(/não pertence/);
  expect(() => projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte], requisitosDestino: [{ ...requisitos[0], codigoAvaliacao: "DESTINO\u0000I1" }], mapeamentos: [],
  })).toThrow(/NUL/);
});


it("aceita recuperação de escopo por habilidade apenas por mapeamento explícito", () => {
  const recuperacao = {
    referenciaId: "recuperacao-nota-1:FALA", matriculaId: contexto.matriculaId, nivelId: contexto.nivelOrigemId,
    alocacaoId: contexto.alocacaoOrigemId, turmaId: contexto.turmaOrigemId, regraId: contexto.regraOrigemId,
    tipoFonte: "RECUPERACAO" as const, escopoFonte: "HABILIDADE" as const, codigoAvaliacao: null,
    habilidade: "FALA" as const, nota: "8", oficial: true as const,
    realizacaoId: "realizacao-1", itemReservaId: "item-1", reservaId: "reserva-1", planoId: "plano-1", decisaoPlanoId: "decisao-plano-1",
    notaRecuperacaoId: "nota-recuperacao-1", decisaoNotaRecuperacaoId: "decisao-nota-1", autorNotaRecuperacaoId: "professor-1",
    professorRealizacaoId: "professor-1", registradaPorId: null, versaoNotaRecuperacao: 1,
    correcaoRecuperacaoId: "correcao-recuperacao-1", decisaoCorrecaoRecuperacaoId: "decisao-correcao-recuperacao-1",
    versaoCorrecaoRecuperacao: 1, fonteHash: hash,
  };
  const resultado = projetarEquivalenciaTransferencia({
    contexto, fontesOficiais: [fonte, recuperacao], requisitosDestino: requisitos,
    mapeamentos: [{ referenciaFonteId: recuperacao.referenciaId, codigoAvaliacaoDestino: "DESTINO-I1", habilidadeDestino: "FALA" }],
  });
  expect(resultado.itens[0]).toMatchObject({
    situacao: "APROVEITADO", fonte: {
      tipoFonte: "RECUPERACAO", escopoFonte: "HABILIDADE", codigoAvaliacaoOrigem: null,
      realizacaoId: "realizacao-1", planoId: "plano-1", notaRecuperacaoId: "nota-recuperacao-1",
      correcaoRecuperacaoId: "correcao-recuperacao-1",
    },
  });
  expect(JSON.stringify(resultado)).not.toContain('"nota"');
});
