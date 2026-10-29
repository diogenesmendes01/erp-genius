import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  avisar: vi.fn(),
  evento: vi.fn(),
  revalidar: vi.fn(),
  arquivo: vi.fn(),
  avisarAtualizado: vi.fn(),
  criarTarefa: vi.fn(),
  concluirTarefa: vi.fn(),
  reabrirTarefa: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  findFirstDoc: vi.fn(),
  createDoc: vi.fn(),
  queryRaw: vi.fn(),
  findUser: vi.fn(),
  findOp: vi.fn(),
  findAtendimentos: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/server/_shared/sessao", async (original) => ({ ...await original<typeof import("@/server/_shared/sessao")>(), exigirSessao: m.sessao }));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: m.evento }));
vi.mock("@/server/uploads/autorizacao", () => ({ exigirArquivoVinculavel: m.arquivo }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));
vi.mock("@/server/crm/tarefas", () => ({ criarTarefa: m.criarTarefa, concluirTarefa: m.concluirTarefa, reabrirTarefa: m.reabrirTarefa }));
vi.mock("./aviso", () => ({ avisarAtendimento: m.avisar }));
vi.mock("./barramento", () => ({ avisarAtendimentoAtualizado: m.avisarAtualizado }));
vi.mock("./contexto-oportunidade", () => ({
  comOportunidadeDoInboxTx: async (_tx: unknown, _sessao: unknown, _atendimentoId: string, _esperada: string, executar: (autor: { id: string; nome: string; papeis: string[] }, leadId: string) => Promise<unknown>) => executar({ id: "u481", nome: "Vendedora", papeis: ["VENDEDOR"] }, "op481"),
}));

const tx = {
  oportunidade: { findUniqueOrThrow: m.findUniqueOrThrow, update: m.update, findFirst: m.findOp },
  documento: { findFirst: m.findFirstDoc, create: m.createDoc },
  usuario: { findUnique: m.findUser },
  atendimentoWhatsApp: { findMany: m.findAtendimentos },
  $queryRaw: m.queryRaw,
};
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx) } }));

import {
  anexarDocumentoPropostaNoInbox,
  atualizarResumoNoInbox,
  definirPrevisaoOportunidade,
  definirTemperaturaNoInbox,
  enviarPropostaNoInbox,
} from "./acoes-fechamento-painel";

const autor = { id: "u481", nome: "Vendedora", papeis: ["VENDEDOR" as const], permissoes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue(autor);
  m.findUniqueOrThrow.mockResolvedValue({ etapa: "QUALIFICADO", temperatura: "MORNO", professorExperimentalId: null, dataExperimental: null, experimentalConfirmadaEm: null });
  m.update.mockResolvedValue({});
  m.findFirstDoc.mockResolvedValue(null);
  m.queryRaw.mockResolvedValue([{ id: "op481" }]);
  m.findUser.mockResolvedValue({ ...autor, ativo: true });
  m.findOp.mockResolvedValue({ id: "op481", etapa: "QUALIFICADO", probabilidadePct: 10, previsaoFechamento: null });
  m.findAtendimentos.mockResolvedValue([{ id: "a481", conversaId: "c481" }]);
  m.criarTarefa.mockResolvedValue({ ok: true, dado: { id: "t481" } });
});

it("temperatura igual não grava; mudança registra LeadEditado e avisa o atendimento", async () => {
  expect((await definirTemperaturaNoInbox("a481", "op481", "MORNO")).ok).toBe(true);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.avisar).not.toHaveBeenCalled();
  expect((await definirTemperaturaNoInbox("a481", "op481", "QUENTE")).ok).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "op481" }, data: { temperatura: "QUENTE" } });
  expect(m.evento).toHaveBeenCalledWith(tx, expect.objectContaining({ tipo: "LeadEditado", payload: expect.objectContaining({ campo: "temperatura", de: "MORNO", temperatura: "QUENTE" }) }));
  expect(m.avisar).toHaveBeenCalledWith(tx, "a481");
  expect(m.revalidar).toHaveBeenCalledWith("/funil");
  expect(m.revalidar).toHaveBeenCalledWith("/inbox");
  expect(m.revalidar).toHaveBeenCalledWith("/home");
});

it("resumo grava os seis campos e oportunidade encerrada é recusada", async () => {
  expect((await atualizarResumoNoInbox("a481", "op481", { interesse: "Inglês", objetivo: "", urgencia: "Agora", orcamento: "500", objecao: "Preço", proximaAcao: "Ligar" })).ok).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "op481" }, data: { interesse: "Inglês", objetivo: null, urgencia: "Agora", orcamento: "500", objecao: "Preço", proximaAcao: "Ligar" } });
  expect(m.evento).toHaveBeenCalledWith(tx, expect.objectContaining({ tipo: "ResumoAtualizado" }));
  m.findUniqueOrThrow.mockResolvedValueOnce({ etapa: "PERDIDO" });
  expect(await atualizarResumoNoInbox("a481", "op481", { interesse: "X" })).toMatchObject({ ok: false, erro: expect.stringContaining("encerrada") });
});

it("enviar proposta segue a transição do funil e registra PropostaEnviada", async () => {
  m.findUniqueOrThrow.mockResolvedValueOnce({ etapa: "PERDIDO" });
  expect(await enviarPropostaNoInbox("a481", "op481")).toMatchObject({ ok: false, erro: "Oportunidade encerrada não volta ao funil." });
  expect(m.update).not.toHaveBeenCalled();
  m.findUniqueOrThrow.mockResolvedValueOnce({ etapa: "QUALIFICADO" });
  expect((await enviarPropostaNoInbox("a481", "op481")).ok).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "op481" }, data: { etapa: "PROPOSTA", dataProposta: expect.any(Date) } });
  expect(m.evento).toHaveBeenCalledWith(tx, expect.objectContaining({ tipo: "PropostaEnviada", agregadoTipo: "Lead", agregadoId: "op481" }));
  expect(m.avisar).toHaveBeenCalledWith(tx, "a481");
});

it("anexo de proposta grava Documento com categoria PROPOSTA", async () => {
  expect((await anexarDocumentoPropostaNoInbox("a481", "op481", { nome: "proposta.pdf", url: "/api/files/p.pdf" })).ok).toBe(true);
  expect(m.arquivo).toHaveBeenCalledWith(expect.objectContaining({ id: "u481" }), "/api/files/p.pdf", { leadId: "op481", categoriaDocumento: "PROPOSTA" }, tx);
  expect(m.createDoc).toHaveBeenCalledWith({ data: { leadId: "op481", categoria: "PROPOSTA", nome: "proposta.pdf", url: "/api/files/p.pdf" } });
  expect(m.evento).toHaveBeenCalledWith(tx, expect.objectContaining({ tipo: "DocumentoAnexado", payload: { categoria: "PROPOSTA", nome: "proposta.pdf" } }));
  expect((await anexarDocumentoPropostaNoInbox("a481", "op481", { nome: "", url: "" })).ok).toBe(false);
  expect(m.createDoc).toHaveBeenCalledOnce();
});

it("previsão direta trava o lead, respeita o esperado e avisa atendimento aberto", async () => {
  expect((await definirPrevisaoOportunidade("op481", { esperado: { probabilidadePct: 10, previsaoFechamento: null }, alteracoes: { probabilidadePct: 80 } })).ok).toBe(true);
  expect(m.queryRaw.mock.calls[0][0].join(" ")).toContain("FOR UPDATE NOWAIT");
  expect(m.update).toHaveBeenCalledWith({ where: { id: "op481" }, data: { probabilidadePct: 80 } });
  expect(m.avisarAtualizado).toHaveBeenCalledWith(tx, { id: "a481", conversaId: "c481" });
  expect(m.revalidar).toHaveBeenCalledWith("/funil");
  m.findOp.mockResolvedValueOnce({ id: "op481", probabilidadePct: 40, previsaoFechamento: null });
  expect(await definirPrevisaoOportunidade("op481", { esperado: { probabilidadePct: 10, previsaoFechamento: null }, alteracoes: { probabilidadePct: 80 } })).toMatchObject({ ok: false, erro: expect.stringContaining("previsão mudou") });
});

it("previsão de oportunidade encerrada é recusada", async () => {
  for (const etapa of ["PERDIDO", "MATRICULADO"] as const) {
    m.findOp.mockResolvedValueOnce({ id: "op481", etapa, probabilidadePct: 10, previsaoFechamento: null });
    expect(await definirPrevisaoOportunidade("op481", { esperado: { probabilidadePct: 10, previsaoFechamento: null }, alteracoes: { probabilidadePct: 80 } })).toEqual({ ok: false, erro: "Oportunidade encerrada não pode ser alterada." });
  }
  expect(m.update).not.toHaveBeenCalled();
});

it("lock NOWAIT ocupado vira recusa sem repetir a transação", async () => {
  m.queryRaw.mockRejectedValueOnce({ code: "P2010", meta: { code: "55P03" } });
  expect(await definirPrevisaoOportunidade("op481", { esperado: { probabilidadePct: 10, previsaoFechamento: null }, alteracoes: { probabilidadePct: 20 } })).toMatchObject({ ok: false, erro: expect.stringContaining("atualizada") });
  expect(m.update).not.toHaveBeenCalled();
});
