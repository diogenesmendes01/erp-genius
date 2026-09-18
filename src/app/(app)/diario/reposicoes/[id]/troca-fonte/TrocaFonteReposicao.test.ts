import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/server/gravacoes/troca-fonte-reposicao", () => ({
  proporTrocaFonteReposicaoGravacao: vi.fn(), decidirTrocaFonteReposicaoGravacao: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { TrocaFonteReposicao } from "./TrocaFonteReposicao";

it("mostra a origem e o antes/depois sem aceitar ID de arquivo, fonte ou proposta", () => {
  const tela = renderToStaticMarkup(createElement(TrocaFonteReposicao, {
    contexto: {
      reposicaoId: "reposicao-interna", materialId: "material-interno", matriculaId: "matricula-interna",
      fonteMaterialAtual: { versao: 1, revisao: "material-r1" }, fontePublicacaoAtual: { versao: 2, revisao: "aula-r2" },
      materialDisponivel: true, disponibilizacaoId: "disponibilizacao-interna", jaAdotaPublicacaoAtual: false,
    },
    propostas: [{
      id: "proposta-interna", motivo: "A publicação corrigida deve substituir a fonte do material.", criadaEm: "2026-09-18T12:00:00.000Z",
      versaoMaterialEsperada: 1, fonteMaterialAnterior: { versao: 1, driveRevisionId: "material-r1" },
      fontePublicacao: { versao: 2, driveRevisionId: "aula-r2" }, preparadorId: "gestao-a", preparador: { nome: "Gestão A" },
      podeDecidir: true, decisao: null, fonteMaterial: null,
    }],
  }));
  expect(tela).toContain("Material: versão 1, revisão fixa material-r1");
  expect(tela).toContain("publicação v2 (aula-r2)");
  expect(tela).toContain("Aprovar adoção");
  expect(tela).not.toMatch(/name="(?:arquivo|fonte|propostaId|revisao)"/);
  expect(tela).not.toContain("proposta-interna");
});

it("mantém o histórico consultável após a aprovação e não oferece nova proposta sem nova publicação", () => {
  const tela = renderToStaticMarkup(createElement(TrocaFonteReposicao, {
    contexto: {
      reposicaoId: "reposicao", materialId: "material", matriculaId: "matricula",
      fonteMaterialAtual: { versao: 2, revisao: "material-r2" }, fontePublicacaoAtual: { versao: 2, revisao: "aula-r2" },
      materialDisponivel: true, disponibilizacaoId: "disponibilizacao", jaAdotaPublicacaoAtual: true,
    },
    propostas: [{
      id: "proposta", motivo: "Adoção já aprovada.", criadaEm: "2026-09-18T12:00:00.000Z", versaoMaterialEsperada: 1,
      fonteMaterialAnterior: { versao: 1, driveRevisionId: "material-r1" }, fontePublicacao: { versao: 2, driveRevisionId: "aula-r2" },
      preparadorId: "gestao-a", preparador: { nome: "Gestão A" }, podeDecidir: false,
      decisao: { aprovada: true, motivo: "Fonte confirmada.", decididaEm: "2026-09-18T12:10:00.000Z", decisor: { nome: "Gestão B" } },
      fonteMaterial: { versao: 2, driveRevisionId: "aula-r2", origemPublicacaoId: "fonte-publicacao" },
    }],
  }));
  expect(tela).toContain("O material já adota esta publicação");
  expect(tela).toContain("Fonte MATERIAL v2 fixada");
  expect(tela).not.toContain("Preparar para decisão independente");
});
