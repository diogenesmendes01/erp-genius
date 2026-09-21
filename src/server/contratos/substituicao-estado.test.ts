import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const { revisar, bloquear } = vi.hoisted(() => ({ revisar: vi.fn(), bloquear: vi.fn() }));
vi.mock("./assinatura-estado", () => ({ carregarRevisaoAssinatura: revisar }));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: bloquear }));
import { carregarContextoSubstituicaoTx, hashSubstituicao } from "./substituicao-estado";

const entrada = { processoFonteId: "processo", conferenciaSubstitutoId: "conferencia-nova", revisaoFonteEsperada: "a".repeat(64), revisaoSubstitutoEsperada: "b".repeat(64), motivo: "Correção conferida", chaveIdempotencia: "preparo-0001" };
const pdf = Buffer.from("%PDF-original preservado");
function fixture() {
  const fonte = {
    id: "processo", matriculaId: "matricula", artefatoId: "original", estado: "ENVIADO", referenciaExterna: "referencia",
    conclusao: null as null | { id: string },
    conferencia: { artefatoId: "original", revisaoHash: entrada.revisaoFonteEsperada, snapshot: { nome: "Nome anterior" } },
    artefato: { pdf, pdfHash: createHash("sha256").update(pdf).digest("hex"), previa: { matriculaId: "matricula" } },
  };
  const conferencia = { id: "conferencia-nova", artefatoId: "substituto", revisaoHash: entrada.revisaoSubstitutoEsperada,
    artefato: { pdfHash: "c".repeat(64), previa: { matriculaId: "matricula" } } };
  const tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
    processoAssinaturaContratual: { findUnique: vi.fn().mockResolvedValue({ matriculaId: "matricula" }), findUniqueOrThrow: vi.fn().mockResolvedValue(fonte) },
    conferenciaAssinaturaContratual: { findUnique: vi.fn().mockResolvedValue(conferencia) },
  };
  return { fonte, conferencia, tx: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => { vi.clearAllMocks(); revisar.mockResolvedValue({ revisaoHash: entrada.revisaoSubstitutoEsperada, snapshot: { nome: "Nome corrigido" } }); });

it("preserva a revisão antiga e revalida somente as condições atuais do substituto", async () => {
  const { tx } = fixture();
  const contexto = await carregarContextoSubstituicaoTx(tx, entrada);
  expect(revisar).toHaveBeenCalledExactlyOnceWith(tx, "matricula", "substituto");
  expect(bloquear).toHaveBeenCalledWith(tx, ["matricula"]);
  expect(contexto.diferencas.fonte.revisao).toEqual({ nome: "Nome anterior" });
  expect(contexto.diferencas.substituto.revisao).toEqual({ nome: "Nome corrigido" });
  expect(contexto).not.toHaveProperty("pdf");
});

it("recusa contrato com conclusão total mesmo ainda no estado ENVIADO", async () => {
  const { tx, fonte } = fixture(); fonte.conclusao = { id: "assinatura-total" };
  await expect(carregarContextoSubstituicaoTx(tx, entrada)).rejects.toThrow("Q117");
  expect(revisar).not.toHaveBeenCalled();
});

it("recusa referência incerta e integridade corrompida da fonte", async () => {
  const primeiro = fixture(); primeiro.fonte.estado = "ENVIO_INCERTO";
  await expect(carregarContextoSubstituicaoTx(primeiro.tx, entrada)).rejects.toThrow("envio confirmado");
  const segundo = fixture(); segundo.fonte.artefato.pdf = Buffer.from("outro arquivo");
  await expect(carregarContextoSubstituicaoTx(segundo.tx, entrada)).rejects.toThrow("Integridade");
});

it("recusa substituto de outra matrícula ou o mesmo original", async () => {
  const primeiro = fixture(); primeiro.conferencia.artefato.previa.matriculaId = "outra";
  await expect(carregarContextoSubstituicaoTx(primeiro.tx, entrada)).rejects.toThrow("mesma matrícula");
  const segundo = fixture(); segundo.conferencia.artefatoId = "original";
  await expect(carregarContextoSubstituicaoTx(segundo.tx, entrada)).rejects.toThrow("original diferente");
  expect(revisar).not.toHaveBeenCalled();
});

it("recusa revisões esperadas diferentes das conferências preservadas", async () => {
  const { tx } = fixture();
  await expect(carregarContextoSubstituicaoTx(tx, { ...entrada, revisaoFonteEsperada: "d".repeat(64) })).rejects.toThrow("revisão preservada");
  await expect(carregarContextoSubstituicaoTx(tx, { ...entrada, revisaoSubstitutoEsperada: "d".repeat(64) })).rejects.toThrow("revisão esperada");
});

it("recusa mudança atual do substituto após a conferência", async () => {
  const { tx } = fixture(); revisar.mockResolvedValue({ revisaoHash: "e".repeat(64), snapshot: {} });
  await expect(carregarContextoSubstituicaoTx(tx, entrada)).rejects.toThrow("condições do substituto mudaram");
});

it("hash da proposta sobrevive à reordenação JSONB sem ignorar mudanças de conteúdo ou sequência", () => {
  const original = { z: [{ b: 2, a: 1 }, 3], a: null };
  expect(hashSubstituicao(original)).toBe(hashSubstituicao({ a: null, z: [{ a: 1, b: 2 }, 3] }));
  expect(hashSubstituicao(original)).not.toBe(hashSubstituicao({ a: null, z: [3, { a: 1, b: 2 }] }));
  expect(hashSubstituicao(original)).not.toBe(hashSubstituicao({ a: null, z: [{ a: 1, b: 4 }, 3] }));
});
