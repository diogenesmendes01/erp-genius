import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: mocks.sessao,
  temPapel: (usuario: { papeis: string[] }, papel: string) => usuario.papeis.includes(papel),
}));
vi.mock("@/server/avaliacoes/segunda-chamada", () => ({ consultarSegundasChamadas: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/avaliacoes/segunda-chamada-disponibilizacao", () => ({ disponibilizarSegundaChamada: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-ocorrencia-local", () => ({ registrarOcorrenciaSegundaChamadaLocal: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

const renderizar = async () => renderToStaticMarkup(await Page({
  params: Promise.resolve({ alocacaoId: "alocacao", codigoAvaliacao: "final" }),
  searchParams: Promise.resolve({}),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessao.mockResolvedValue({ papeis: [Papel.GERENTE_PEDAGOGICO] });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.consulta.mockResolvedValue({ ok: true, dado: {
    fusoExibicao: "UTC", proximoId: null,
    estado: { limiteBase: 2, extrasAprovados: 0, reservasOcupadas: 1, saldo: 1, ativa: true, statusMatricula: "ATIVA" },
    itens: [{ id: "proposta", motivo: "Avaliação pendente", evidencias: "Pedido documentado", criadaEm: "2026-01-01T02:30:00Z",
      decisao: { aprovada: true, motivo: "Autorizada" }, podeDecidir: false, propostaHash: "hash",
      disponibilizacao: { id: "disponivel", prazoAte: "2026-01-02T02:30:00Z" },
      reserva: { id: "reserva", status: "RESERVADA", encontroId: null }, podeOperar: true }],
  } });
});

it("converte instantes sem remover navegação da gestão ou mudar o fuso de entrada", async () => {
  const html = await renderizar();
  expect(html).toContain("31/12/2025, 20:30");
  expect(html).toContain("America/Costa_Rica; origem UTC");
  expect(html).toContain('href="/academico/segundas-chamadas/alocacao/final/historico"');
  expect(html).toContain('href="/academico/segundas-chamadas/alocacao/final/autorizacoes"');
  expect(html).toContain('href="/academico/avaliacoes/alocacao/final/designacao"');
  expect(html).toMatch(/<input[^>]*name="fuso"[^>]*value="UTC"/);
});

it("não exibe os links exclusivos da gestão para professor", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
  const html = await renderizar();
  expect(html).not.toContain('href="/academico/segundas-chamadas/alocacao/final/historico"');
  expect(html).not.toContain('href="/academico/segundas-chamadas/alocacao/final/autorizacoes"');
  expect(html).not.toContain('href="/academico/avaliacoes/alocacao/final/designacao"');
  expect(html).toContain("31/12/2025, 20:30");
});

it("consulta dados e preferência somente após a guarda da página", async () => {
  mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
  await expect(renderizar()).rejects.toThrow("Sem sessão");
  expect(mocks.consulta).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});

// docs/42 L1670 (docs/43 §6 item 7): o formulário sumia sem explicar quando a matrícula não estava ativa.
const comEstado = (estado: Record<string, unknown>) => mocks.consulta.mockResolvedValue({ ok: true, dado: {
  fusoExibicao: "UTC", proximoId: null,
  estado: { limiteBase: 2, extrasAprovados: 0, reservasOcupadas: 0, saldo: 2, ativa: true, statusMatricula: "ATIVA", ...estado },
  itens: [],
} });

it("matrícula pausada: no lugar do formulário, o motivo e o link da autorização para a gestão", async () => {
  comEstado({ statusMatricula: "PAUSADA" });
  const html = await renderizar();
  expect(html).not.toContain("Propor segunda chamada");
  expect(html).toContain("Nova proposta indisponível");
  expect(html).toContain("A matrícula está pausada. Uma nova realização exige autorização específica.");
  expect(html).toContain('<a class="underline" href="/academico/segundas-chamadas/alocacao/final/autorizacoes">Registrar a autorização específica</a>');
});

it("matrícula encerrada para professor: o motivo e a quem pedir (sem link da gestão)", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
  comEstado({ statusMatricula: "ENCERRADA" });
  const html = await renderizar();
  expect(html).not.toContain("Propor segunda chamada");
  expect(html).toContain("A matrícula está encerrada.");
  expect(html).toContain("Peça a autorização à Gestão Pedagógica.");
  expect(html).not.toContain("/autorizacoes");
});

it("vínculo inativo também explica no lugar do formulário; matrícula ativa mostra o formulário e nenhum motivo", async () => {
  comEstado({ ativa: false });
  const inativo = await renderizar();
  expect(inativo).toContain("O vínculo com a turma está inativo. Uma nova realização exige autorização específica.");
  expect(inativo).not.toContain("Propor segunda chamada");
  comEstado({});
  const ativo = await renderizar();
  expect(ativo).toContain("Propor segunda chamada");
  expect(ativo).not.toContain("Nova proposta indisponível");
});

it("o encontro vinculado à reserva não aparece como id", async () => {
  mocks.consulta.mockResolvedValue({ ok: true, dado: {
    fusoExibicao: "UTC", proximoId: null,
    estado: { limiteBase: 2, extrasAprovados: 0, reservasOcupadas: 1, saldo: 1, ativa: true, statusMatricula: "ATIVA" },
    itens: [{ id: "proposta", motivo: "Avaliação pendente", evidencias: "Pedido documentado", criadaEm: "2026-01-01T02:30:00Z",
      decisao: { aprovada: true, motivo: "Autorizada" }, podeDecidir: false, propostaHash: "hash",
      disponibilizacao: { id: "disponivel", prazoAte: "2026-01-02T02:30:00Z" },
      reserva: { id: "reserva", status: "RESERVADA", encontroId: "encontro-interno" }, podeOperar: true }],
  } });
  const html = await renderizar();
  expect(html).toContain("Encontro vinculado: registrado na agenda.");
  expect(html).not.toContain("encontro-interno");
});
