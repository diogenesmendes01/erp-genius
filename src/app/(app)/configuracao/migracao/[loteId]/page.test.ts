import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/consultas", () => ({ consultarLotePreparacaoMigracao: vi.fn().mockResolvedValue({ ok: true, dado: {
  id: "lote-1", origem: "OPERACIONAL_LETICIA", chaveLote: "arquivo-1", estado: "COM_PENDENCIAS", criadoEm: new Date(), preparadoPor: { nome: "Admin" },
  conflitosEntrada: [{ linhaOrigem: "alunos!2", codigo: "LINHA_ORIGEM_DIVERGENTE", entradaHash: "hash-conflito", dadosConflitantes: { aluno: { email: "invalido" } }, criadoEm: new Date(), registradoPorNome: "Revisor", registradoEm: new Date() }],
  destinosVinculo: { produtos: [{ produtoId: "produto-1", paisId: "pais-1", moeda: "BRL", rotulo: "Inglês · Regular · Brasil (BR, BRL)" }], turmas: [{ id: "turma-1", rotulo: "T-1 · Turma A · Inglês A1" }] },
  linhas: [{ id: "linha-1", linhaOrigem: "alunos!2", tipoEntrada: "CADASTRO", alunoOrigemId: "a-1", turmaOrigemId: null, matriculaOrigemId: null, financeiroOrigemId: null, entradaHash: "hash-original", dadosOrigem: { aluno: { email: "ana@example.test" } }, estado: "COM_PENDENCIAS", aplicacoesCadastro: [{ situacao: "APLICADO", alunoId: "destino-1", detalhe: "Cadastro criado", criadoEm: new Date(), executadoPor: { nome: "Admin" } }], ensaiosVinculo: [], pendencias: [{ campo: "aluno.email", codigo: "EMAIL_INVALIDO", detalhe: "E-mail inválido." }], colisoes: [{ tipo: "ALUNO", identificadorOrigem: "a-1", outraLinhaOrigem: "alunos!3" }] }, { id: "linha-vinculo", linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", alunoOrigemId: "a-2", turmaOrigemId: "turma-origem", matriculaOrigemId: "m-2", financeiroOrigemId: null, entradaHash: "hash-vinculo", dadosOrigem: {}, origemVinculo: { produtoOrigemId: "produto-origem", statusOrigem: "ATIVA" }, estado: "COM_PENDENCIAS", aplicacoesCadastro: [], ensaiosVinculo: [{ resultado: "REQUISITO_AUSENTE", requisitos: ["MAPA_ALUNO_AUSENTE"], criadoEm: new Date("2026-09-16T12:00:00Z"), ensaiadoPor: { nome: "Ana Administradora" } }], pendencias: [], colisoes: [] }],
} }) }));
vi.mock("./AplicarCadastroMigracao", () => ({ AplicarCadastroMigracao: () => null }));

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
    expect(html).toContain("destino-1");
    expect(html).toContain("Histórico de ensaios");
    expect(html).toContain("Ana Administradora");
    expect(html).toContain("Produto da origem: produto-origem");
  });
});
