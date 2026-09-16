import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { gerarPdfPreviaAditivo, gerarPdfOriginalAditivo } from "./pdf-previa";

const entrada = {
  propostaId: "aditivo-proposta-1", criadaEm: new Date("2026-09-15T10:00:00.000Z"), propostaHash: "a".repeat(64),
  modeloCodigo: "ADITIVO_ESCOLA", modeloVersao: 3, versaoProposta: 2, ambiente: "SANDBOX" as const,
  documento: { titulo: "Aditivo ao contrato", campos: [], secoes: [
    { titulo: "Referência", texto: `Original original-1 — SHA-256 ${"b".repeat(64)}\nAditivo anterior-1 — SHA-256 ${"c".repeat(64)}` },
    { titulo: "Vigência e alteração", texto: "Vigência: 2026-10-01T03:00:00.000Z\nCondição anterior: BRL 500,00\nNova condição: BRL 450,00" },
  ] },
};

it("original do aditivo é determinístico, distinto da prévia e vinculado à conferência", async () => {
  const dados = { ...entrada, conferenciaId: "conferencia-1", conferenciaHash: "e".repeat(64) };
  const original = await gerarPdfOriginalAditivo(dados), repetido = await gerarPdfOriginalAditivo(dados);
  expect(original.bytes.equals(repetido.bytes)).toBe(true);
  expect(original.sha256).toBe(createHash("sha256").update(original.bytes).digest("hex"));
  expect(original.sha256).not.toBe((await gerarPdfPreviaAditivo(entrada)).sha256);
  expect(original.gerador).toMatchObject({ versao: "aditivo-original-1", fontes: [{ sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }, { sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }] });
  expect((await gerarPdfOriginalAditivo({ ...dados, conferenciaHash: "f".repeat(64) })).sha256).not.toBe(original.sha256);
  expect((await gerarPdfOriginalAditivo({ ...dados, ambiente: "PRODUCAO" })).sha256).not.toBe(original.sha256);
  await expect(gerarPdfOriginalAditivo({ ...dados, conferenciaHash: "invalido" })).rejects.toThrow();
});

it("gera prévia determinística, com hash de integridade e referências e versões preservadas", async () => {
  const a = await gerarPdfPreviaAditivo(entrada), b = await gerarPdfPreviaAditivo(entrada);
  expect(a.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(a.bytes.equals(b.bytes)).toBe(true); expect(a.sha256).toBe(b.sha256);
  expect(a.sha256).toBe(createHash("sha256").update(a.bytes).digest("hex"));
  const outraVersao = await gerarPdfPreviaAditivo({ ...entrada, modeloVersao: 4, versaoProposta: 3, propostaHash: "d".repeat(64) });
  expect(outraVersao.sha256).not.toBe(a.sha256);
});

it("marca o ambiente de teste e nunca produz o mesmo PDF de uma referência de produção", async () => {
  const sandbox = await gerarPdfPreviaAditivo(entrada);
  const producao = await gerarPdfPreviaAditivo({ ...entrada, ambiente: "PRODUCAO" });
  expect(sandbox.bytes.equals(producao.bytes)).toBe(false);
  expect(sandbox.sha256).not.toBe(producao.sha256);
});

it("recusa entrada sem versão ou ambiente válido e caracteres sem fonte", async () => {
  await expect(gerarPdfPreviaAditivo({ ...entrada, modeloVersao: 0 })).rejects.toThrow();
  await expect(gerarPdfPreviaAditivo({ ...entrada, ambiente: undefined } as never)).rejects.toThrow();
  await expect(gerarPdfPreviaAditivo({ ...entrada, documento: { ...entrada.documento, titulo: "Aditivo 🦄" } })).rejects.toThrow("não suporta");
});

it("pagina documento longo sem perder a renderização determinística", async () => {
  const longa = { ...entrada, documento: { ...entrada.documento, secoes: [{ titulo: "Condições extensas", texto: "Condição preservada. ".repeat(8000) }] } };
  const pdf = await gerarPdfPreviaAditivo(longa), repetido = await gerarPdfPreviaAditivo(longa);
  expect(pdf.paginas).toBeGreaterThan(1); expect(pdf.bytes.equals(repetido.bytes)).toBe(true);
});
