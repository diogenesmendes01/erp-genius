import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DetalheOportunidade } from "@/server/crm/historico";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/inbox/acoes-fechamento-painel", () => ({
  definirPrevisaoOportunidade: vi.fn(),
  criarTarefaOportunidade: vi.fn(),
  concluirTarefaOportunidade: vi.fn(),
  reabrirTarefaOportunidade: vi.fn(),
}));

import { SecoesParidadeFunil } from "./SecoesParidadeFunil";

const oportunidade: DetalheOportunidade = {
  id: "op481", codigo: null, nome: "Empresa fictícia", b2b: true, etapa: "QUALIFICADO", temperatura: "QUENTE",
  probabilidadePct: 70, previsaoFechamento: "2026-12-15", valorPrevisto: null, moeda: null, pais: null, dono: null,
  proximaAcao: null, proximoFollowUp: null, dataExperimental: null, professorExperimental: null, experimentalConfirmadaEm: null, motivoPerda: null, criadoEm: new Date("2026-10-01T00:00:00Z"),
  pessoaId: null, interesse: null, objetivo: null, urgencia: null, orcamento: null, objecao: null, telefoneE164: null,
  paisId: null, segmento: "EMPRESA", origemCampanha: null, origemConjunto: null, origemAnuncio: null, origemPalavra: null,
  planoPrevisto: null, comissaoPrevista: null, dataProposta: null, documentos: [], taxaMatricula: null,
  b2bDetalhes: {
    empresa: { id: "e481", nome: "Acme fictícia" },
    participantes: [{ pessoaId: "p481", nome: "Lia", papel: "DECISOR", cargo: "Diretora", naConversa: false, hrefConversa: "/inbox?c=a481" }],
    decisor: true,
  },
  tarefas: [{ id: "t481", versao: 2, titulo: "Retornar proposta", status: "ABERTA", podeAgir: true }],
};

it("drawer mostra previsão, tarefa da oportunidade e bloco B2B", () => {
  const html = renderToStaticMarkup(createElement(SecoesParidadeFunil, {
    oportunidade, podeEditarPrevisao: true, podeTarefas: true, podeVerEmpresa: true,
  }));
  expect(html).toContain("Probabilidade");
  expect(html).toContain("70%");
  expect(html).toContain("Editar previsão");
  expect(html).toContain("Tarefas da oportunidade");
  expect(html).toContain("Retornar proposta");
  expect(html).toContain("Criar tarefa");
  expect(html).toContain("Acme fictícia");
  expect(html).toContain("Ver empresa");
  expect(html).toContain('href="/empresas/e481"');
  expect(html).toContain('href="/inbox?c=a481"');
  expect(html).toContain("Falar com");
});

it("tarefa concluída sem permissão de agir não oferece reabrir", () => {
  const html = renderToStaticMarkup(createElement(SecoesParidadeFunil, {
    oportunidade: { ...oportunidade, tarefas: [{ id: "t2", versao: 3, titulo: "Fechar contrato", status: "CONCLUIDA", podeAgir: false }] },
    podeEditarPrevisao: false, podeTarefas: true, podeVerEmpresa: false,
  }));
  expect(html).toContain("Fechar contrato");
  expect(html).not.toContain("Reabrir Fechar contrato");
  expect(html).not.toContain("checkbox");
});

it("tarefa concluída de quem pode agir oferece reabrir", () => {
  const html = renderToStaticMarkup(createElement(SecoesParidadeFunil, {
    oportunidade: { ...oportunidade, tarefas: [{ id: "t3", versao: 4, titulo: "Ligar de novo", status: "CONCLUIDA", podeAgir: true }] },
    podeEditarPrevisao: false, podeTarefas: true, podeVerEmpresa: false,
  }));
  expect(html).toContain('aria-label="Reabrir Ligar de novo"');
});

it("sem permissão a previsão e as tarefas ficam somente leitura", () => {
  const html = renderToStaticMarkup(createElement(SecoesParidadeFunil, {
    oportunidade: { ...oportunidade, b2bDetalhes: null, tarefas: [] }, podeEditarPrevisao: false, podeTarefas: false, podeVerEmpresa: false,
  }));
  expect(html).not.toContain("Editar previsão");
  expect(html).not.toContain("Criar tarefa");
  expect(html).toContain("Nenhuma tarefa para esta oportunidade.");
  expect(html).not.toContain("Acme fictícia");
});
