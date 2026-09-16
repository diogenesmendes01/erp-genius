import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/consultas", () => ({ consultarLotePreparacaoMigracao: vi.fn().mockResolvedValue({ ok: true, dado: {
  id: "lote-1", origem: "OPERACIONAL_LETICIA", chaveLote: "arquivo-1", estado: "COM_PENDENCIAS", criadoEm: new Date(), preparadoPor: { nome: "Admin" },
  conflitosEntrada: [{ linhaOrigem: "alunos!2", codigo: "LINHA_ORIGEM_DIVERGENTE", entradaHash: "hash-conflito", dadosConflitantes: { aluno: { email: "invalido" } }, criadoEm: new Date(), registradoPorNome: "Revisor", registradoEm: new Date() }],
  linhas: [{ id: "linha-1", linhaOrigem: "alunos!2", alunoOrigemId: "a-1", turmaOrigemId: null, matriculaOrigemId: null, financeiroOrigemId: null, entradaHash: "hash-original", dadosOrigem: { aluno: { email: "ana@example.test" } }, estado: "COM_PENDENCIAS", pendencias: [{ campo: "aluno.email", codigo: "EMAIL_INVALIDO", detalhe: "E-mail inválido." }], colisoes: [{ tipo: "ALUNO", identificadorOrigem: "a-1", outraLinhaOrigem: "alunos!3" }] }],
} }) }));

import Pagina from "./page";

describe("detalhe da preparação de migração", () => {
  it("mostra fotografia original, tentativa divergente, hash e pendência para Administração", async () => {
    const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ loteId: "lote-1" }) }));
    expect(html).toContain("ana@example.test");
    expect(html).toContain("invalido");
    expect(html).toContain("hash-original");
    expect(html).toContain("hash-conflito");
    expect(html).toContain("E-mail inválido.");
    expect(html).toContain("alunos!3");
  });
});
