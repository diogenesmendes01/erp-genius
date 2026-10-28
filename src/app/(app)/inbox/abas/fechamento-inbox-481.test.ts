import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { OportunidadeAtualPainel } from "@/server/inbox/painel-oportunidades";

const acoes = vi.hoisted(() => ({
  temperatura: vi.fn(async () => ({ ok: true as const })),
  resumo: vi.fn(async () => ({ ok: true as const })),
  proposta: vi.fn(async () => ({ ok: true as const })),
  anexo: vi.fn(async () => ({ ok: true as const })),
  agendar: vi.fn(async () => ({ ok: true as const })),
  confirmar: vi.fn(async () => ({ ok: true as const })),
  professores: vi.fn(async () => ({ ok: true as const, dado: [{ id: "p1", nome: "Helena" }] })),
  link: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@tabler/icons-react", () => ({ IconUpload: () => createElement("span") }));
vi.mock("@/server/inbox/acoes-fechamento-painel", () => ({
  definirTemperaturaNoInbox: acoes.temperatura,
  atualizarResumoNoInbox: acoes.resumo,
  enviarPropostaNoInbox: acoes.proposta,
  anexarDocumentoPropostaNoInbox: acoes.anexo,
  agendarExperimentalNoInbox: acoes.agendar,
  confirmarExperimentalNoInbox: acoes.confirmar,
  professoresParaExperimental: acoes.professores,
}));
vi.mock("@/server/matricula/acoes", () => ({ registrarLinkPagamento: acoes.link }));

import { QualificacaoOportunidadeInbox } from "./QualificacaoOportunidadeInbox";
import { AcoesFechamentoOportunidade } from "./AcoesFechamentoOportunidade";

const oportunidade: OportunidadeAtualPainel = {
  id: "op481", titulo: "Curso", produto: null, valor: null, moeda: null, etapa: "QUALIFICADO", temperatura: "MORNO",
  responsavel: null, dataExperimental: null, experimentalConfirmada: false, professorExperimental: null, professorExperimentalId: null,
  probabilidadePct: null, previsaoFechamento: null, podeEditarPrevisao: false, motivoPerda: null,
  interesse: "Inglês", objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: "Ligar",
  documentosProposta: [], contratacao: { matriculaId: null, statusAlcada: null, motivoDecisao: null, taxaMatricula: null },
};

let root: Root;
let host: Elemento;
function handler(e: Elemento, nome: string) {
  const k = Object.keys(e).find((chave) => chave.startsWith("__reactProps"))!;
  return (e as unknown as Record<string, Record<string, (ev?: unknown) => unknown>>)[k][nome];
}
beforeEach(async () => {
  vi.clearAllMocks();
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento);
  vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const escrever = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { userAgent: "vitest", clipboard: { writeText: escrever } });
  host = dom.documento.createElement("div");
  dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

it("qualificação somente leitura mostra temperatura e BANT sem chips", () => {
  const html = renderToStaticMarkup(createElement(QualificacaoOportunidadeInbox, {
    atendimentoId: "a", oportunidadeId: "op481", temperatura: "FRIO", etapa: "MATRICULADO", podeEditar: false,
    resumo: { interesse: "Inglês", objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: "Ligar" }, aoMudar() {},
  }));
  expect(html).toContain("Temperatura");
  expect(html).toContain("Frio");
  expect(html).toContain("Interesse");
  expect(html).toContain("Inglês");
  expect(html).not.toContain("aria-pressed");
});

it("chip de temperatura salva em um clique e a qualificação abre o formulário", async () => {
  const mudar = vi.fn();
  await act(async () => root.render(createElement(QualificacaoOportunidadeInbox, {
    atendimentoId: "a481", oportunidadeId: "op481", temperatura: "MORNO", etapa: "QUALIFICADO", podeEditar: true,
    resumo: { interesse: "Inglês", objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: null }, aoMudar: mudar,
  })));
  const quente = host.querySelectorAll("button").find((b) => b.textContent === "Quente")!;
  await act(async () => { handler(quente, "onClick")(); });
  expect(acoes.temperatura).toHaveBeenCalledWith("a481", "op481", "QUENTE");
  expect(mudar).toHaveBeenCalledOnce();
  const abrir = host.querySelectorAll("button").find((b) => b.textContent === "Qualificação e próximo passo")!;
  await act(async () => { handler(abrir, "onClick")(); });
  const form = host.querySelector("form")!;
  await act(async () => { handler(form, "onSubmit")({ preventDefault() {} }); });
  expect(acoes.resumo).toHaveBeenCalledWith("a481", "op481", expect.objectContaining({ interesse: "Inglês" }));
});

it("proposta, contratação e cópia do link acontecem na inbox", async () => {
  const comTaxa: OportunidadeAtualPainel = {
    ...oportunidade,
    etapa: "AGUARDANDO_MATRICULA",
    contratacao: {
      matriculaId: "m481",
      statusAlcada: "REJEITADA",
      motivoDecisao: "Desconto acima da alçada",
      taxaMatricula: { cobrancaId: "c481", status: "PENDENTE", linkPagamento: "https://pagar.exemplo/481" },
    },
  };
  const mudar = vi.fn();
  await act(async () => root.render(createElement(AcoesFechamentoOportunidade, {
    atendimentoId: "a481", oportunidade: { ...oportunidade, documentosProposta: [{ id: "d1", nome: "proposta.pdf", url: "/api/files/p.pdf", categoria: "PROPOSTA" }] },
    fuso: "America/Sao_Paulo", podeAgir: true, secao: "enviarProposta", aoMudar: mudar,
  })));
  const enviar = host.querySelectorAll("button").find((b) => b.textContent === "Confirmar envio de proposta")!;
  await act(async () => { handler(enviar, "onClick")(); });
  expect(acoes.proposta).toHaveBeenCalledWith("a481", "op481");
  expect(host.textContent).toContain("proposta.pdf");
  await act(async () => root.render(createElement(AcoesFechamentoOportunidade, {
    atendimentoId: "a481", oportunidade: comTaxa, fuso: "America/Sao_Paulo", podeAgir: true, secao: "prepararContratacao", aoMudar: mudar,
  })));
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/matriculas/m481/preparacao");
  expect(host.textContent).toContain("Exceção rejeitada");
  expect(host.textContent).toContain("Desconto acima da alçada");
  const copiar = host.querySelectorAll("button").find((b) => b.textContent === "Copiar link")!;
  await act(async () => { handler(copiar, "onClick")(); });
  expect(host.textContent).toContain("Link copiado!");
  await act(async () => root.render(createElement(AcoesFechamentoOportunidade, {
    atendimentoId: "a481", oportunidade, fuso: "America/Sao_Paulo", podeAgir: true, secao: null, aoMudar: mudar,
  })));
  expect(host.textContent).toBe("");
});
