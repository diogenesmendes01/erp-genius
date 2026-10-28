import { beforeEach, expect, it, vi } from "vitest";
import { mapearDocumentoProposta, projetarContratacao } from "./painel-oportunidades";

const m = vi.hoisted(() => ({ lead: vi.fn(async () => true), tarefas: vi.fn(async () => []) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));
vi.mock("@/server/whatsapp/escopo", () => ({ escopoAtendimentos: async () => ({}) }));
vi.mock("@/server/whatsapp/consultas-inbox", () => ({ podeVerLeadNaThread: m.lead }));
vi.mock("@/server/operacao/relogio", () => ({ carregarFusoInstitucionalTx: async () => "America/Sao_Paulo" }));
vi.mock("./painel-tarefas", () => ({ carregarTarefasDoAtendimento: m.tarefas }));

import { carregarOportunidadesPainel } from "./painel-oportunidades";
import type { Db } from "@/server/whatsapp/escopo";

const u = { id: "u481", nome: "Vendedora fictícia", papeis: ["VENDEDOR" as const] };

it("documentos ausentes no mock não quebram o filtro de proposta", () => {
  expect(mapearDocumentoProposta(undefined)).toEqual([]);
  expect(mapearDocumentoProposta(null)).toEqual([]);
  expect(mapearDocumentoProposta([
    { id: "d1", nome: "proposta.pdf", url: "/api/files/p.pdf", categoria: "PROPOSTA" },
    { id: "d2", nome: "rg.pdf", url: "/api/files/rg.pdf", categoria: "OUTRO" },
  ])).toEqual([{ id: "d1", nome: "proposta.pdf", url: "/api/files/p.pdf", categoria: "PROPOSTA" }]);
});

it("projeção da alçada distingue dentro, espera, aprovação e rejeição", () => {
  expect(projetarContratacao(null)).toEqual({ matriculaId: null, statusAlcada: null, motivoDecisao: null, taxaMatricula: null });
  expect(projetarContratacao({ id: "m1", status: "RASCUNHO", preparacaoComercial: null, cobrancas: [] }).statusAlcada).toBeNull();
  const base = { id: "prep", referencias: { alcada: { componentes: [{ resultado: "DENTRO_ALCADA" }, { resultado: "DENTRO_ALCADA" }] } }, decisaoPreco: null };
  expect(projetarContratacao({ id: "m2", status: "AGUARDANDO", preparacaoComercial: base, cobrancas: [{ id: "c1", status: "PENDENTE", linkPagamento: "https://pagar.exemplo/a" }] })).toEqual({
    matriculaId: "m2", statusAlcada: "DENTRO_ALCADA", motivoDecisao: null, taxaMatricula: { cobrancaId: "c1", status: "PENDENTE", linkPagamento: "https://pagar.exemplo/a" },
  });
  expect(projetarContratacao({ id: "m3", status: "AGUARDANDO", preparacaoComercial: { ...base, referencias: { alcada: { componentes: [{ resultado: "EXIGE_APROVACAO" }] } } }, cobrancas: [] }).statusAlcada).toBe("AGUARDANDO_APROVACAO");
  expect(projetarContratacao({ id: "m4", status: "AGUARDANDO", preparacaoComercial: { ...base, decisaoPreco: { aprovada: true, motivo: "Ok", decididaEm: new Date() } }, cobrancas: [] })).toMatchObject({ statusAlcada: "APROVADA", motivoDecisao: "Ok" });
  expect(projetarContratacao({ id: "m5", status: "AGUARDANDO", preparacaoComercial: { ...base, decisaoPreco: { aprovada: false, motivo: "Fora da política", decididaEm: new Date() } }, cobrancas: [] })).toMatchObject({ statusAlcada: "REJEITADA", motivoDecisao: "Fora da política" });
});

beforeEach(() => { vi.clearAllMocks(); m.lead.mockResolvedValue(true); });

it("carregar projeta qualificação, proposta e contratação no mesmo select", async () => {
  const oportunidade = {
    id: "op481", nome: "Curso 481", pessoaId: null, probabilidadePct: 40, previsaoFechamento: "2026-12-01", planoPrevisto: "Inglês", valorPrevisto: { toFixed: () => "10.00" },
    etapa: "PROPOSTA", temperatura: "QUENTE", motivoPerda: null, interesse: "Inglês", objetivo: "Viagem", urgencia: "Este mês", orcamento: "500", objecao: null, proximaAcao: "Enviar PDF",
    dataExperimental: null, experimentalConfirmadaEm: null, professorExperimentalId: null, pais: { moedaLocal: "BRL" }, vendedor: null, professorExperimental: null,
    documentos: [{ id: "d1", nome: "proposta.pdf", url: "/api/files/p.pdf", categoria: "PROPOSTA" }],
    matricula: { id: "m481", status: "AGUARDANDO", preparacaoComercial: { id: "prep", referencias: { alcada: { componentes: [{ resultado: "DENTRO_ALCADA" }] } }, decisaoPreco: null }, cobrancas: [{ id: "c481", status: "PENDENTE", linkPagamento: null }] },
  };
  let consulta: { select?: Record<string, unknown> } | undefined;
  const findUnique = vi.fn(async (args: { select?: Record<string, unknown> }) => { consulta = args; return oportunidade; });
  const db = { atendimentoWhatsApp: { findFirst: vi.fn(async () => ({ id: "a481", finalidade: "COMERCIAL", leadId: "op481", conversa: { contatoId: "c" } })) }, oportunidade: { findUnique, findFirst: vi.fn(async () => ({ id: "op481" })), findMany: vi.fn(async () => []) } };
  const painel = await carregarOportunidadesPainel(u, "a481", db as unknown as Db);
  expect(consulta?.select).toMatchObject({
    interesse: true, objetivo: true, urgencia: true, orcamento: true, objecao: true, proximaAcao: true, professorExperimentalId: true,
    documentos: { where: { arquivado: false, categoria: "PROPOSTA" }, orderBy: { criadoEm: "desc" } },
    matricula: { select: { cobrancas: { where: { tipo: "MATRICULA" }, take: 1 } } },
  });
  expect(painel?.atual).toMatchObject({
    interesse: "Inglês", objetivo: "Viagem", urgencia: "Este mês", orcamento: "500", objecao: null, proximaAcao: "Enviar PDF",
    documentosProposta: [{ id: "d1", nome: "proposta.pdf" }],
    contratacao: { matriculaId: "m481", statusAlcada: "DENTRO_ALCADA", taxaMatricula: { cobrancaId: "c481", status: "PENDENTE", linkPagamento: null } },
  });
});
