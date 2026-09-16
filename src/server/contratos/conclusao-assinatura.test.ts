import { expect, it } from "vitest";
import { validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { hashPrevia } from "./previa-estado";
const enviada = new Date("2026-09-10T10:00:00Z"), agora = new Date("2026-09-10T12:00:00Z");
const aluno = { nome: "Aluno Teste", email: "aluno@example.test", documento: "TESTE-ALUNO" }, escola = { nome: "Escola Teste", email: "escola@example.test", documento: "TESTE-ESCOLA" };
const snapshot = { participantes: [{ papel: "ALUNO", etapa: "CLIENTE", identidade: aluno }, { papel: "REPRESENTANTE_ESCOLA", etapa: "ESCOLA", identidade: escola }] };
const entrada = () => ({ processoId: "processo", referenciaExterna: "externo", originalHash: "a".repeat(64), concluidaEm: "2026-09-10T11:30:00Z", pdfAssinado: Buffer.from("%PDF-1.7 teste"), evidencias: Buffer.from("auditoria de teste"), assinaturas: [
  { papel: "ALUNO" as const, identidadeHash: hashPrevia(aluno), referenciaAssinatura: "ass-aluno", assinadaEm: "2026-09-10T11:00:00Z" },
  { papel: "REPRESENTANTE_ESCOLA" as const, identidadeHash: hashPrevia(escola), referenciaAssinatura: "ass-escola", assinadaEm: "2026-09-10T11:20:00Z" },
] });
it("normaliza a evidência completa sem depender da ordem recebida", () => {
  const d = entrada(), a = validarConclusaoAssinatura(d,snapshot,enviada,agora);
  expect(validarConclusaoAssinatura({ ...d, assinaturas: [...d.assinaturas].reverse() },snapshot,enviada,agora).entradaHash).toBe(a.entradaHash);
  expect(a.pdfHash).toMatch(/^[a-f0-9]{64}$/);
});
it.each(["parcial", "duplicada", "identidade", "ordem", "futura", "anterior", "pdf", "auditoria"])("recusa conclusão %s", caso => {
  const d = entrada();
  if (caso === "parcial") d.assinaturas.pop();
  if (caso === "duplicada") d.assinaturas[1] = d.assinaturas[0];
  if (caso === "identidade") d.assinaturas[0].identidadeHash = "f".repeat(64);
  if (caso === "ordem") d.assinaturas[1].assinadaEm = "2026-09-10T10:30:00Z";
  if (caso === "futura") d.concluidaEm = "2026-09-10T13:00:00Z";
  if (caso === "anterior") d.assinaturas[0].assinadaEm = "2026-09-10T09:30:00Z";
  if (caso === "pdf") d.pdfAssinado = Buffer.from("documento incorreto");
  if (caso === "auditoria") d.evidencias = Buffer.alloc(0);
  expect(() => validarConclusaoAssinatura(d,snapshot,enviada,agora)).toThrow();
});
