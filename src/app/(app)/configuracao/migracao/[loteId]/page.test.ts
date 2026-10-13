import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), preferencia: vi.fn(), consultar: vi.fn() }));
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/consultas", () => ({ consultarLotePreparacaoMigracao: mocks.consultar }));
const LOTE = {
  id: "lote-1", origem: "OPERACIONAL_LETICIA", chaveLote: "arquivo-1", estado: "COM_PENDENCIAS", criadoEm: new Date("2026-09-16T00:30:00Z"), preparadoPor: { nome: "Admin" },
  pagina: 1, porPagina: 25, temProxima: false, totalLinhas: 3,
  conflitosEntrada: [{ linhaOrigem: "alunos!2", codigo: "LINHA_ORIGEM_DIVERGENTE", entradaHash: "hash-conflito", dadosConflitantes: { aluno: { email: "invalido" } }, criadoEm: new Date("2026-09-16T00:30:00Z"), registradoPorNome: "Revisor", registradoEm: new Date("2026-09-16T00:30:00Z") }],
  destinosVinculo: { produtos: [{ produtoId: "produto-1", paisId: "pais-1", moeda: "BRL", rotulo: "Inglês · Regular · Brasil (BR, BRL)" }], turmas: [{ id: "turma-1", rotulo: "T-1 · Turma A · Inglês A1" }] },
  linhas: [{ id: "linha-1", linhaOrigem: "alunos!2", tipoEntrada: "CADASTRO", alunoOrigemId: "a-1", turmaOrigemId: null, matriculaOrigemId: null, financeiroOrigemId: null, entradaHash: "hash-original", dadosOrigem: { aluno: { email: "ana@example.test" } }, estado: "COM_PENDENCIAS", aplicacoesCadastro: [{ situacao: "APLICADO", alunoId: "destino-1", detalhe: "Cadastro criado", criadoEm: new Date("2026-09-16T00:30:00Z"), executadoPor: { nome: "Admin" } }], ensaiosVinculo: [], pendencias: [{ campo: "aluno.email", codigo: "EMAIL_INVALIDO", detalhe: "E-mail inválido." }], colisoes: [{ tipo: "ALUNO", identificadorOrigem: "a-1", outraLinhaOrigem: "alunos!3" }] }, { id: "linha-vinculo", linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", alunoOrigemId: "a-2", turmaOrigemId: "turma-origem", matriculaOrigemId: "m-2", financeiroOrigemId: null, entradaHash: "hash-vinculo", dadosOrigem: {}, origemVinculo: { produtoOrigemId: "produto-origem", statusOrigem: "ATIVA", turmaAtual: { id: "correspondencia-vigente", turmaId: "turma-can\u00f4nica", versao: 2, ativa: true, rotulo: "Turma can\u00f4nica" } }, estado: "COM_PENDENCIAS", aplicacoesCadastro: [], ensaiosVinculo: [{ id: "ensaio-a", entradaHash: "hash-vinculo", contextoHash: "contexto", vigente: false, aplicacoes: [], resultado: "REQUISITO_AUSENTE", requisitos: ["MAPA_ALUNO_AUSENTE"], criadoEm: new Date("2026-09-16T12:00:00Z"), ensaiadoPor: { nome: "Ana Administradora" } }], pendencias: [], colisoes: [] }, { id: "linha-vinculo-inativa", linhaOrigem: "vinculos!3", tipoEntrada: "VINCULO_MATRICULA", alunoOrigemId: "a-3", turmaOrigemId: "turma-origem-inativa", matriculaOrigemId: "m-3", financeiroOrigemId: null, entradaHash: "hash-vinculo-inativa", dadosOrigem: {}, origemVinculo: { produtoOrigemId: "produto-inativo", statusOrigem: "ATIVA", turmaAtual: { id: "correspondencia-inativa", turmaId: "turma-n\u00e3o-usar", versao: 1, ativa: false, rotulo: "Turma inativa" } }, estado: "COM_PENDENCIAS", aplicacoesCadastro: [], ensaiosVinculo: [], pendencias: [], colisoes: [] }],
};
vi.mock("./AplicarCadastroMigracao", () => ({ AplicarCadastroMigracao: () => null }));

import Pagina from "./page";

describe("detalhe da preparação de migração", () => {
  beforeEach(() => {
    mocks.guarda.mockReset().mockResolvedValue(undefined);
    mocks.preferencia.mockReset().mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Adak" } });
    mocks.consultar.mockReset().mockResolvedValue({ ok: true, dado: LOTE });
  });
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
    expect(html).toContain("America/Adak");
    expect(html).toContain("15/09/2026");
    expect(html).toContain("Produto da origem: produto-origem");
    expect(html).toContain("Aplicar vínculo migrado");
    expect(html).toContain("Conferir regra histórica da turma mapeada");
    expect(html).toContain("/academico/regras/turmas/turma-can%C3%B4nica/historica");
    expect(html).not.toContain("turma-origem/historica");
    expect(html).not.toContain("turma-n%C3%A3o-usar/historica");
  });

  it("item 9 (docs/42 L2483): o JSON da origem e o da tentativa divergente ficam em <details> fechado; a linha mostra os identificadores", async () => {
    const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ loteId: "lote-1" }) }));
    // Nenhum <pre> fora de um <details>, e nenhum <details> aberto por padrão.
    const semDetalhes = html.replace(/<details[\s\S]*?<\/details>/g, "");
    expect(semDetalhes).not.toContain("<pre");
    // Uma por linha (3) e uma por tentativa divergente (1); o AplicarVinculoMigracao já tinha a sua.
    expect((html.match(/<summary[^>]*>Fotografia de origem/g) ?? []).length).toBe(3);
    expect((html.match(/<summary[^>]*>Dados da tentativa divergente/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/<summary[^>]*>Fotografia de origem · hash hash-original<\/summary>/);
    expect(html).toMatch(/<summary[^>]*>Dados da tentativa divergente<\/summary>/);
    expect(semDetalhes).toContain("Aluno: a-1");
    expect(semDetalhes).toContain("E-mail inválido.");
  });

  it("linhas paginadas: a página da URL vai à consulta, com a faixa e a navegação nos dois sentidos", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...LOTE, pagina: 2, temProxima: true, totalLinhas: 80 } });
    const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ loteId: "lote-1" }), searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(mocks.consultar).toHaveBeenCalledWith("lote-1", { pagina: 2 });
    expect(html).toContain("Linhas 26–28 de 80");
    expect(html).toContain('aria-label="Páginas de linhas do lote"');
    expect(html).toContain('href="/configuracao/migracao/lote-1">← Anterior');
    expect(html).toContain('href="/configuracao/migracao/lote-1?pagina=3">Próxima →');
    // Sem parâmetro (ou com página inválida), a primeira.
    await Pagina({ params: Promise.resolve({ loteId: "lote-1" }), searchParams: Promise.resolve({ pagina: "abc" }) });
    expect(mocks.consultar).toHaveBeenLastCalledWith("lote-1", { pagina: 1 });
  });

  it("página além do fim: estado vazio com a volta ao início do lote, sem a lista", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...LOTE, linhas: [], pagina: 9, temProxima: false, totalLinhas: 3 } });
    const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ loteId: "lote-1" }), searchParams: Promise.resolve({ pagina: "9" }) }));
    expect(html).toContain("Nenhuma linha neste trecho do lote");
    expect(html).toContain('href="/configuracao/migracao/lote-1">Ir para a primeira página');
    expect(html).not.toContain("nesta página");
  });

  it("não lê a preferência quando a guarda administrativa falha", async () => {
    mocks.guarda.mockRejectedValueOnce(new Error("negado"));
    await expect(Pagina({ params: Promise.resolve({ loteId: "lote-1" }) })).rejects.toThrow("negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
