import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/server/gravacoes/regularizacao-fonte", () => ({ proporRegularizacaoFonteGravacao: vi.fn(), decidirRegularizacaoFonteGravacao: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { RegularizacoesGravacao } from "./RegularizacoesGravacao";

it("apresenta fontes e decisões sem pedir identificador de proposta", () => {
  const tela = renderToStaticMarkup(createElement(RegularizacoesGravacao, {
    fontes: [{ id: "PUBLICACAO_AULA:publicacao-1", rotulo: "Publicação da aula encontro-1", versao: null }],
    propostas: [{ id: "proposta-interna", destino: "Aula turma-1", podeDecidir: true, alvo: "PUBLICACAO_AULA", arquivoOficialId: "arquivo-oficial-1", driveRevisionId: "revisao-1", motivo: "Regularizar fonte legada", versaoEsperada: 0, criadaEm: new Date("2026-09-16T12:00:00Z"), preparador: { nome: "Gestora" }, decisao: null }],
  }));
  expect(tela).toContain("Publicação da aula encontro-1");
  expect(tela).toContain("Regularizar fonte legada");
  expect(tela).toContain("Aprovar fonte");
  expect(tela).not.toMatch(/name=\"propostaId\"/);
  expect(tela).not.toContain("proposta-interna");
});
