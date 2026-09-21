import { expect, it } from "vitest";
import { gerarPdfPrevia, gerarPdfOriginal } from "./pdf-previa";
const entrada = { previaId: "teste-pdf", criadaEm: new Date("2026-09-12T12:00:00Z"), conteudoHash: "a".repeat(64), snapshot: {
  modeloCodigo: "TESTE", modeloVersao: 1, condicoesVersao: 1, aplicacao: "Teste automatizado",
  documento: { titulo: "João e María", campos: [], secoes: [{ titulo: "Seção", texto: "Texto com acentuação." }] },
} };
it("gera bytes PDF idênticos para o mesmo registro preservado", async () => {
  const a = await gerarPdfPrevia(entrada), b = await gerarPdfPrevia(entrada);
  expect(a.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(a.paginas).toBe(1); expect(a.bytes.equals(b.bytes)).toBe(true); expect(a.sha256).toBe(b.sha256);
});
it("não substitui caractere sem suporte por glifo vazio e limita geração excessiva", async () => {
  await expect(gerarPdfPrevia({ ...entrada, snapshot: { ...entrada.snapshot, documento: { ...entrada.snapshot.documento, titulo: "Nome 🦄" } } })).rejects.toThrow("não suporta");
  await expect(gerarPdfPrevia({ ...entrada, snapshot: { ...entrada.snapshot, documento: { ...entrada.snapshot.documento, secoes: [{ titulo: "Texto", texto: "a".repeat(250001) }] } } })).rejects.toThrow("limite");
});
it("original registra gerador e fontes e não reutiliza os bytes identificados como prévia", async () => {
  const original = await gerarPdfOriginal(entrada), repetido = await gerarPdfOriginal(entrada), previa = await gerarPdfPrevia(entrada);
  expect(original.bytes.equals(repetido.bytes)).toBe(true);
  expect(original.bytes.equals(previa.bytes)).toBe(false);
  expect(original.gerador.fontes).toHaveLength(2);
  for (const fonte of original.gerador.fontes) expect(fonte.sha256).toMatch(/^[a-f0-9]{64}$/);
});
