import { expect, it } from "vitest";
import {
  aprovarSubstituicao,
  autorizarInicioCancelamentoSubstituicao,
  confirmarCancelamentoParaSubstituicao,
  prepararSubstituicao,
  type AtorSubstituicao,
  type ProcessoFonteSubstituicao,
  type PropostaSubstituicao,
} from "./substituicao-regras";

const secretaria: AtorSubstituicao = { id: "secretaria", ativo: true, papeis: ["SECRETARIA_ACADEMICA"] };
const administrador: AtorSubstituicao = { id: "administrador", ativo: true, papeis: ["ADMINISTRADOR"] };
const fonte: ProcessoFonteSubstituicao = {
  id: "processo-fonte",
  matriculaId: "matricula-fonte",
  artefatoId: "artefato-fonte",
  estado: "ENVIADO",
  revisaoHash: "fonte-v1",
  referenciaExterna: "referencia-fonte",
};
const contexto = {
  processoFonte: fonte,
  conclusaoFonte: null,
  revisaoFonteAtual: "fonte-v1",
  revisaoSubstitutoAtual: "substituto-v1",
} as const;

function proposta(): PropostaSubstituicao {
  return prepararSubstituicao({
    propostaId: "proposta-1",
    preparador: secretaria,
    ...contexto,
    matriculaSubstitutoId: fonte.matriculaId,
    artefatoSubstitutoId: "artefato-substituto",
  });
}

function aprovada(): PropostaSubstituicao {
  return aprovarSubstituicao({ proposta: proposta(), aprovador: administrador, ...contexto });
}

function autorizacao() {
  return autorizarInicioCancelamentoSubstituicao({
    proposta: aprovada(),
    executor: secretaria,
    tentativaId: "tentativa-autorizada",
    ...contexto,
  });
}

function prova() {
  return {
    resultado: "CONFIRMADO" as const,
    propostaId: "proposta-1",
    processoFonteId: fonte.id,
    tentativaId: "tentativa-autorizada",
    referenciaExterna: fonte.referenciaExterna,
    evidenciaHash: "b".repeat(64),
  };
}

it("rejeita proposta persistida cujo substituto aponta para outra matrícula", () => {
  const adulterada = { ...proposta(), matriculaSubstitutoId: "matricula-estranha" };

  expect(() => aprovarSubstituicao({ proposta: adulterada, aprovador: administrador, ...contexto })).toThrow(/mesma matrícula/i);
});

it.each([
  { matriculaSubstitutoId: "outra-matricula" },
  { artefatoSubstitutoId: fonte.artefatoId },
  { artefatoSubstitutoId: "" },
])("revalida a identidade do substituto em cada transição: %j", (alteracao) => {
  expect(() => aprovarSubstituicao({ proposta: { ...proposta(), ...alteracao }, aprovador: administrador, ...contexto })).toThrow();
  const alterada = { ...aprovada(), ...alteracao };
  expect(() => autorizarInicioCancelamentoSubstituicao({ proposta: alterada, executor: secretaria, tentativaId: "tentativa-autorizada", ...contexto })).toThrow();
  expect(() => confirmarCancelamentoParaSubstituicao({ proposta: alterada, autorizacao: { ...autorizacao(), artefatoSubstitutoId: alterada.artefatoSubstitutoId }, ...contexto, prova: prova() })).toThrow();
});

it("rejeita aprovação quando a revisão da fonte ficou obsoleta após a preparação", () => {
  const fonteRevisada = { ...fonte, revisaoHash: "fonte-v2" };

  expect(() => aprovarSubstituicao({
    proposta: proposta(),
    aprovador: administrador,
    ...contexto,
    processoFonte: fonteRevisada,
    revisaoFonteAtual: "fonte-v2",
  })).toThrow(/revisão atual da fonte/i);
});

it("rejeita autoaprovação mesmo quando a proposta vem de armazenamento", () => {
  const armazenada = { ...proposta(), preparadaPorId: administrador.id };

  expect(() => aprovarSubstituicao({ proposta: armazenada, aprovador: administrador, ...contexto })).toThrow(/outro administrador/i);
});

it("não autoriza cancelamento quando a conclusão total apareceu após a aprovação", () => {
  expect(() => autorizarInicioCancelamentoSubstituicao({
    proposta: aprovada(),
    executor: secretaria,
    tentativaId: "tentativa-autorizada",
    ...contexto,
    conclusaoFonte: { processoId: fonte.id, matriculaId: fonte.matriculaId, artefatoId: fonte.artefatoId },
  })).toThrow(/Q117/);
});

it("rejeita confirmação vinculada a outra tentativa, ainda que proposta e processo coincidam", () => {
  const outraTentativa = { ...autorizacao(), tentativaId: "tentativa-estranha" };

  expect(() => confirmarCancelamentoParaSubstituicao({
    proposta: aprovada(),
    autorizacao: outraTentativa,
    ...contexto,
    prova: prova(),
  })).toThrow(/tentativa/i);
});
