import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 6: os instantes impressos com toISOString() — a frase de auditoria da emissão, o histórico do
// pagador, as propostas de exceção de ingresso e o histórico dos modelos contratuais — saem no fuso de exibição
// de quem lê, com a origem dita, como as telas já migradas: "22/09/2026, 10:41 (America/Sao_Paulo; origem UTC)".
const m = vi.hoisted(() => ({
  sessao: vi.fn(), preferencia: vi.fn(), emissao: vi.fn(), telaPagador: vi.fn(), historicoPagador: vi.fn(), excecoes: vi.fn(), modelos: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: m.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: m.preferencia }));
vi.mock("@/server/secretaria/conferencia-emissao", () => ({ consultarTelaEmissao: m.emissao, conferirEEmitirEntrada: vi.fn() }));
vi.mock("@/server/secretaria/pagador-preparacao", () => ({ consultarTelaPagador: m.telaPagador, consultarHistoricoPagador: m.historicoPagador }));
vi.mock("@/server/matricula/excecao-admissao", () => ({ consultarExcecoesAdmissao: m.excecoes }));
vi.mock("@/server/contratos/modelos", () => ({ consultarModelosContratuais: m.modelos }));
vi.mock("./matriculas/[id]/emissao/ConfirmarEmissao", () => ({ ConfirmarEmissao: () => null }));
vi.mock("./matriculas/[id]/pagador/PagadorFormulario", () => ({ PagadorFormulario: () => null }));
vi.mock("./academico/admissoes/excecoes/[reservaId]/FormularioExcecao", () => ({ FormularioExcecao: () => null }));
vi.mock("./configuracao/contratos/ModeloFormulario", () => ({ ModeloFormulario: () => null }));
vi.mock("./configuracao/contratos/DecidirModelo", () => ({ DecidirModelo: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ refresh: vi.fn() }) }));

import EmissaoPage from "./matriculas/[id]/emissao/page";
import PagadorPage from "./matriculas/[id]/pagador/page";
import ExcecaoAdmissaoPage from "./academico/admissoes/excecoes/[reservaId]/page";
import ModeloPage from "./configuracao/contratos/[codigo]/page";

const ISO_CRU = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
  m.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
});

describe("instantes no fuso de exibição, com a origem (sem ISO cru)", () => {
  it("emissão: a frase de auditoria da conferência", async () => {
    m.emissao.mockResolvedValue({ ok: true, dado: { estado: "EMITIDA", particular: false, registro: {
      autor: { nome: "Ana" }, criadaEm: new Date("2026-09-22T13:41:07.482Z"), motivo: "Conferido.",
      cobrancas: [{ id: "c1", tipo: "MATRICULA", valor: "100", moeda: "BRL", vencimento: "2026-10-05" }],
    } } });
    const html = renderToStaticMarkup(await EmissaoPage({ params: Promise.resolve({ id: "m1" }) }));
    expect(html).toContain("Conferida por Ana em 22/09/2026, 10:41 (America/Sao_Paulo; origem UTC).");
    expect(html).not.toMatch(ISO_CRU);
  });

  it("emissão sem preferência: UTC, dito como fuso de exibição", async () => {
    m.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
    m.emissao.mockResolvedValue({ ok: true, dado: { estado: "EMITIDA", particular: false, registro: { autor: { nome: "Ana" }, criadaEm: new Date("2026-09-22T13:41:07.482Z"), motivo: "Conferido.", cobrancas: [] } } });
    expect(renderToStaticMarkup(await EmissaoPage({ params: Promise.resolve({ id: "m1" }) }))).toContain("em 22/09/2026, 13:41 (UTC; origem UTC).");
  });

  it("pagador: o histórico de versões", async () => {
    m.telaPagador.mockResolvedValue({ ok: true, dado: { matricula: { codigo: "M-1", aluno: { primeiroNome: "Ana", sobrenome: "Souza" } }, registro: null, impedimento: null, podeEditar: false, paises: [] } });
    m.historicoPagador.mockResolvedValue({ ok: true, dado: { temProxima: false, registros: [{
      id: "v1", versao: 1, tipo: "ALUNO", motivo: "Cadastro inicial", criadaEm: new Date("2026-09-03T15:00:00.000Z"), preparador: { nome: "Secretaria" },
      dados: { nome: "Ana Souza", documento: "", email: "", telefoneE164: "", endereco: "" },
    }] } });
    const html = renderToStaticMarkup(await PagadorPage({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Registrada em 03/09/2026, 12:00 (America/Sao_Paulo; origem UTC).");
    expect(html).not.toMatch(ISO_CRU);
  });

  it("exceção de ingresso: o histórico e o cenário preservado (reserva, prazo, encontros e limite civil)", async () => {
    const snapshot = {
      turmaId: "t", statusReserva: "ATIVA", criadaEm: "2026-09-01T03:00:00.000Z", expiraEm: "2026-09-03T15:00:00.000Z",
      janelaAtual: { limiteEntrada: "2026-09-30", fusoAdmissao: "America/Sao_Paulo" },
      identificacao: { aluno: "Ana", matricula: "M-1", turma: "T-1" },
      encontros: [{ id: "e1", inicio: "2026-10-01T12:00:00.000Z", fim: "2026-10-01T13:00:00.000Z" }],
    };
    m.excecoes.mockResolvedValue({ ok: true, dado: { pendencia: null, revisao: null, podeDecidir: false, autorId: "a", temProxima: false, historico: [{
      id: "p1", preparadorId: "x", preparador: { nome: "Secretaria" }, criadaEm: new Date("2026-09-03T15:00:00.000Z"), motivo: "Motivo", parecerViabilidade: "Parecer", snapshot, estadoHash: "h", decisao: null,
    }] } });
    const html = renderToStaticMarkup(await ExcecaoAdmissaoPage({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Secretaria, 03/09/2026, 12:00 (America/Sao_Paulo; origem UTC).");
    expect(html).toContain("Reserva criada em 01/09/2026, 00:00; prazo 03/09/2026, 12:00 (America/Sao_Paulo; origem UTC).");
    expect(html).toContain("Entrada até 30/09/2026 (America/Sao_Paulo).");
    expect(html).toContain("01/10/2026, 09:00 até 01/10/2026, 10:00");
    expect(html).not.toMatch(ISO_CRU);
  });

  it("modelo contratual: preparação e decisão", async () => {
    m.modelos.mockResolvedValue({ temProxima: false, modelos: [{
      id: "mod1", versao: 2, conteudo: null, conteudoHash: "h", motivo: "Ajuste", preparador: { id: "p", nome: "Secretaria" }, criadaEm: new Date("2026-09-22T13:41:07.482Z"),
      decisao: { aprovada: true, decisor: { nome: "Administração" }, criadaEm: new Date("2026-09-03T15:00:00.000Z"), motivo: "Ok" },
    }] });
    const html = renderToStaticMarkup(await ModeloPage({ params: Promise.resolve({ codigo: "CONTRATO_PADRAO" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Preparada por Secretaria, em 22/09/2026, 10:41 (America/Sao_Paulo; origem UTC).");
    expect(html).toContain("Publicada por Administração, em 03/09/2026, 12:00 (America/Sao_Paulo; origem UTC).");
    expect(html).not.toMatch(/\d{2}:\d{2}:\d{2} UTC/);
  });
});
