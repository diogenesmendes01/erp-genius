import { expect, it } from "vitest";
import { DecidirSubstituicaoContratualSchema, PrepararSubstituicaoContratualSchema } from "./substituicao-schema";

const preparo = {
  processoFonteId: "processo", conferenciaSubstitutoId: "conferencia",
  revisaoFonteEsperada: "a".repeat(64), revisaoSubstitutoEsperada: "b".repeat(64),
  motivo: "Correção cadastral conferida", chaveIdempotencia: "preparo-0001",
};
const decisao = { propostaId: "proposta", propostaHashEsperado: "c".repeat(64), aprovada: true, motivo: "Alterações conferidas" };

it("recusa autoria, decisão e snapshot fornecidos no preparo pelo cliente", () => {
  for (const extra of [{ preparadaPorId: "admin" }, { aprovada: true }, { snapshot: {} }, { diferencas: {} }, { versao: 1 }]) {
    expect(PrepararSubstituicaoContratualSchema.safeParse({ ...preparo, ...extra }).success).toBe(false);
  }
});

it("exige as duas revisões e chave idempotente para preparar", () => {
  for (const alteracao of [{ revisaoFonteEsperada: "" }, { revisaoSubstitutoEsperada: "v1" }, { chaveIdempotencia: "   " }, { conferenciaSubstitutoId: " " }]) {
    expect(PrepararSubstituicaoContratualSchema.safeParse({ ...preparo, ...alteracao }).success).toBe(false);
  }
  expect(PrepararSubstituicaoContratualSchema.parse(preparo)).toEqual(preparo);
});

it("exige decisão booleana explícita e impede indicação do aprovador", () => {
  for (const alteracao of [{ aprovada: "false" }, { aprovada: 1 }, { aprovada: undefined }, { decisorId: "admin" }, { propostaHashEsperado: "" }]) {
    expect(DecidirSubstituicaoContratualSchema.safeParse({ ...decisao, ...alteracao }).success).toBe(false);
  }
  expect(DecidirSubstituicaoContratualSchema.parse({ ...decisao, aprovada: false }).aprovada).toBe(false);
});

it("normaliza motivo e recusa justificativa vazia ou excessiva em ambos os comandos", () => {
  expect(PrepararSubstituicaoContratualSchema.parse({ ...preparo, motivo: "  Dados corrigidos  " }).motivo).toBe("Dados corrigidos");
  for (const motivo of ["    ", "x".repeat(4001)]) {
    expect(PrepararSubstituicaoContratualSchema.safeParse({ ...preparo, motivo }).success).toBe(false);
    expect(DecidirSubstituicaoContratualSchema.safeParse({ ...decisao, motivo }).success).toBe(false);
  }
});
