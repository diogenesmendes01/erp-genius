import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/migracao/ensaio-vinculo", () => ({ ensaiarVinculoMigracao: vi.fn(), revisarCorrespondenciaProdutoMigracao: vi.fn(), revisarCorrespondenciaStatusMatriculaMigracao: vi.fn(), revisarCorrespondenciaTurmaMigracao: vi.fn() }));
vi.mock("@/server/migracao/aplicar-vinculo", () => ({ aplicarVinculoMigracao: vi.fn() }));

import { AplicarVinculoMigracao } from "./AplicarVinculoMigracao";
import { EnsaioVinculoMigracao } from "./EnsaioVinculoMigracao";

const ensaio = { id: "ensaio", entradaHash: "a".repeat(64), contextoHash: "b".repeat(64), resultado: "PRONTO_PARA_REVISAO" as const, requisitos: [], vigente: true, criadoEm: new Date("2026-09-16T00:30:00Z"), ensaiadoPor: { nome: "Admin" } };

describe("históricos administrativos da migração", () => {
  it("mostra ensaio e aplicação no fuso preferido sem modificar os campos civis do formulário", () => {
    const ensaioHtml = renderToStaticMarkup(createElement(EnsaioVinculoMigracao, {
      linhaId: "linha", origem: "LEGADO", produtoOrigemId: null, turmaOrigemId: null, statusOrigem: null,
      produtoAtual: null, turmaAtual: null, statusAtual: null, ofertasProduto: [], turmas: [], ensaios: [ensaio], preferenciaFusoExibicao: "America/Adak",
    }));
    const aplicarHtml = renderToStaticMarkup(createElement(AplicarVinculoMigracao, {
      linhaId: "linha", entradaHash: ensaio.entradaHash, origem: "LEGADO", dadosOrigem: {}, produtoDestino: "Produto", turmaDestino: "Turma", statusDestino: "ATIVA", ensaios: [ensaio], preferenciaFusoExibicao: "America/Adak",
    }));
    for (const html of [ensaioHtml, aplicarHtml]) {
      expect(html).toContain("15/09/2026");
      expect(html).toContain("America/Adak");
      expect(html).toContain("origem UTC");
    }
    expect(aplicarHtml).toContain('type="date"');
    expect(aplicarHtml).toContain('value=""');
  });

  it("usa UTC quando não há preferência", () => {
    const html = renderToStaticMarkup(createElement(EnsaioVinculoMigracao, {
      linhaId: "linha", origem: "LEGADO", produtoOrigemId: null, turmaOrigemId: null, statusOrigem: null,
      produtoAtual: null, turmaAtual: null, statusAtual: null, ofertasProduto: [], turmas: [], ensaios: [ensaio],
    }));
    expect(html).toContain("16/09/2026");
    expect(html).toContain("horário exibido em UTC");
  });
});
