import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), preferencia: vi.fn(), aditivos: vi.fn(), proposta: vi.fn(), originais: vi.fn(), participantes: vi.fn(), efeitos: vi.fn(), acerto: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/contratos/aditivos", () => ({ consultarAditivosContratuais: mocks.aditivos, consultarPropostaAditivo: mocks.proposta }));
vi.mock("@/server/contratos/aditivo-originais", () => ({ consultarOriginaisAditivo: mocks.originais }));
vi.mock("@/server/contratos/aditivo-participantes", () => ({ consultarConferenciasParticipantesAditivo: mocks.participantes }));
vi.mock("@/server/contratos/aditivo-efeitos-consulta", () => ({ consultarEfeitosAditivo: mocks.efeitos }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-consulta", () => ({ consultarAcertoTaxaPorProposta: mocks.acerto }));
vi.mock("./Formularios", () => ({ PrepararAditivo: () => createElement("div") }));
vi.mock("../CadastroContratualAplicado", () => ({ CadastroContratualAplicado: () => createElement("div") }));
vi.mock("./[propostaId]/EstadoCampo", () => ({ EstadoCampo: () => createElement("div") }));
vi.mock("./ImpactosPainel", () => ({ ImpactosPainel: () => createElement("div") }));
vi.mock("./ParticipantesFormulario", () => ({ ParticipantesFormulario: () => createElement("div") }));
vi.mock("./ParticipantesHistorico", () => ({ ParticipantesHistorico: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string }) => createElement("div", { "data-fuso-participantes": preferenciaFusoExibicao }) }));
vi.mock("./OriginaisPainel", () => ({ OriginaisPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string }) => createElement("div", { "data-fuso-originais": preferenciaFusoExibicao }) }));
vi.mock("./AcertoTaxaFormulario", () => ({ AcertoTaxaFormulario: () => createElement("div") }));
vi.mock("./ImpactosTaxaFormulario", () => ({ ImpactosTaxaFormulario: () => createElement("div") }));
vi.mock("./[propostaId]/Formularios", () => ({ DecidirAditivo: () => createElement("div", { "data-decisao": "preservada" }) }));

import AditivosPage from "./page";
import PropostaPage from "./[propostaId]/page";

const instante = new Date("2026-10-01T02:30:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guarda.mockResolvedValue({ id: "secretaria" });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.aditivos.mockResolvedValue({ ok: true, dado: {
    matricula: { aluno: "Ana" }, fonte: null, impedimento: "Sem fonte", modelos: [], paginaModelos: 1, maisModelos: false,
    cadastroContratual: null, propostas: [{ id: "proposta", versao: 2, preparadaPor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Correção", decisao: null }], pagina: 1, maisPropostas: false,
  } });
  mocks.proposta.mockResolvedValue({ ok: true, dado: {
    id: "proposta", versao: 2, preparadaPor: "Secretaria", criadaEm: instante, motivo: "Correção", ambiente: "SANDBOX", artefatoOriginalId: "original", conclusaoOriginalId: "conclusao", documento: { titulo: "Aditivo", secoes: [] }, impactos: [], vigenciaInicio: instante,
    alteracoes: [], decisao: { aprovada: true, decisor: { nome: "Admin" }, decididaEm: new Date("2026-10-01T03:30:00.000Z"), motivo: "Conferido" }, podeDecidir: false, propostaHash: "a".repeat(64), superada: false,
  } });
  mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, preservada: false, registros: [{ id: "original", autor: { nome: "Secretaria" }, criadoEm: instante, paginas: 2, motivo: "Arquivo" }], temProxima: false } });
  mocks.participantes.mockResolvedValue({ ok: true, dado: { registros: [{ id: "conferencia", versao: 1, autor: "Secretaria", criadaEm: instante, motivo: "Participantes", maioridade: null, participantes: [] }], maisRegistros: false } });
  mocks.efeitos.mockResolvedValue({ ok: true, dado: { vigenciaInicio: instante, primeiraMensalidade: null, acertosTaxaAplicados: 0, efeitos: [], pendencias: [], aplicacoesCampos: [], aplicado: false } });
  mocks.acerto.mockResolvedValue({ ok: true, dado: { estado: "SEM_ACERTO" } });
});

describe("históricos de aditivos no fuso pessoal", () => {
  it("formata proposta, decisão e filhos no fuso pessoal sem transformar vigência", async () => {
    const lista = renderToStaticMarkup(await AditivosPage({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));
    const proposta = renderToStaticMarkup(await PropostaPage({ params: Promise.resolve({ id: "matricula", propostaId: "proposta" }), searchParams: Promise.resolve({}) }));

    for (const html of [lista, proposta]) expect(html).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(proposta).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
    expect(proposta).toContain('data-fuso-participantes="America/Costa_Rica"');
    expect(proposta).toContain('data-fuso-originais="America/Costa_Rica"');
    expect(proposta).toContain("Vigência proposta: 2026-10-01 02:30:00 UTC.");
    expect(proposta).toContain("Vigência prevista: 2026-10-01 02:30:00 UTC.");
  });

  it("recorre a UTC e não consulta preferência ou histórico depois da guarda", async () => {
    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Indisponível" });
    const lista = renderToStaticMarkup(await AditivosPage({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));
    expect(lista).toContain("01/10/2026, 02:30 (UTC; origem UTC)");

    vi.clearAllMocks();
    mocks.guarda.mockRejectedValue(new Error("Sessão expirada"));
    await expect(PropostaPage({ params: Promise.resolve({ id: "matricula", propostaId: "proposta" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sessão expirada");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.proposta).not.toHaveBeenCalled();
  });
});
