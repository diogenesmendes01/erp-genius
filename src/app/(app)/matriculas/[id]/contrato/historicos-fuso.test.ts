import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(), preferencia: vi.fn(), painel: vi.fn(), previa: vi.fn(), originais: vi.fn(),
  formulario: vi.fn(), conferencias: vi.fn(), conferenciaAssinatura: vi.fn(), conclusao: vi.fn(), aceite: vi.fn(), notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/contratos/previas", () => ({ consultarPainelPrevias: mocks.painel, consultarPreenchimentoContratual: vi.fn(), consultarPreviaContratual: mocks.previa }));
vi.mock("@/server/contratos/originais", () => ({ consultarOriginaisContratuais: mocks.originais }));
vi.mock("@/server/contratos/participantes", () => ({ consultarFormularioParticipantes: mocks.formulario, consultarConferenciasParticipantes: mocks.conferencias }));
vi.mock("@/server/contratos/assinatura-conferencia", () => ({ consultarConferenciaAssinatura: mocks.conferenciaAssinatura }));
vi.mock("@/server/contratos/conclusao-consulta", () => ({ consultarConclusaoContratual: mocks.conclusao }));
vi.mock("@/server/contratos/aceite", () => ({ consultarAceiteOriginal: mocks.aceite }));
vi.mock("@/server/contratos/envio", () => ({ consultarIntegracaoAssinatura: vi.fn().mockResolvedValue({ ok: true, dado: null }), enviarContratoParaAssinatura: vi.fn(), conciliarEnvioAssinatura: vi.fn() }));

import ContratoPage from "./page";
import PreviaPage from "./previas/[previaId]/page";
import ParticipantesPage from "./previas/[previaId]/participantes/page";
import OriginalPage from "./originais/[artefatoId]/page";

const instante = new Date("2026-01-01T02:30:00.000Z");

beforeEach(() => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.SECRETARIA_ACADEMICA] });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.painel.mockResolvedValue({ ok: true, dado: {
    matricula: { aluno: "Ana Silva", codigo: "MAT-1" }, podePreparar: false, modelos: [], paginaModelos: 1, maisModelos: false,
    historico: [{ id: "previa", modelo: { codigo: "CTR", versao: 1 }, criadaEm: instante, autor: { nome: "Secretaria" }, motivo: "Texto revisado" }],
    paginaHistorico: 1, maisHistorico: false,
  } });
  mocks.previa.mockResolvedValue({ ok: true, dado: { matriculaId: "matricula", autor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Texto revisado", snapshot: {} } });
  mocks.originais.mockResolvedValue({ ok: true, dado: { conferencia: null, conferenciaJaPreservada: false, registros: [{ id: "original", criadoEm: instante, paginas: 2, motivo: "Arquivo preservado" }], temProxima: false } });
  mocks.formulario.mockResolvedValue({ ok: false, erro: "Conferência indisponível." });
  mocks.conferencias.mockResolvedValue({ ok: true, dado: { registros: [{ id: "conferencia", versao: 1, autor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Participantes conferidos", snapshot: {} }], temProxima: false } });
  mocks.conferenciaAssinatura.mockResolvedValue({ ok: true, dado: { revisao: null, pendencia: null, historico: [{ id: "conferencia", autor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Documento conferido", revisaoHash: "hash" }], temProxima: false } });
  mocks.conclusao.mockResolvedValue({ ok: true, dado: { fornecedor: "Fornecedor", ambiente: "SANDBOX", estadoEnvio: "CONCLUIDO", conclusao: { id: "conclusao", concluidaEm: "2026-01-01T03:30:00.000Z", assinaturas: [{ nome: "Ana Silva", papel: "ALUNO", assinadaEm: "2026-01-01T04:30:00.000Z" }] } } });
  mocks.aceite.mockResolvedValue({ ok: true, dado: { aceite: { autor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Aceite conferido" }, pendencia: null, revisao: null } });
});

afterEach(() => vi.clearAllMocks());

describe("históricos contratuais no fuso pessoal", () => {
  it("formata criação, aceite e conferência na preferência sem converter conteúdo contratual", async () => {
    const contrato = renderToStaticMarkup(await ContratoPage({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));
    const previa = renderToStaticMarkup(await PreviaPage({ params: Promise.resolve({ id: "matricula", previaId: "previa" }), searchParams: Promise.resolve({}) }));
    const participantes = renderToStaticMarkup(await ParticipantesPage({ params: Promise.resolve({ id: "matricula", previaId: "previa" }), searchParams: Promise.resolve({}) }));
    mocks.conferenciaAssinatura.mockResolvedValueOnce({ ok: true, dado: {
      revisao: {
        hash: "revisao-atual",
        dados: {
          regraTaxa: "CONFIRMACAO_PREVIA_EXIGIDA",
          taxa: { valor: "100.00", moeda: "BRL", confirmada: true },
          reserva: { status: "ATIVA", expiraEm: "2026-01-01T03:30:00.000Z" },
          agenda: [],
          agendaParticular: null,
          participantes: [],
        },
      },
      pendencia: null,
      historico: [{ id: "conferencia", autor: { nome: "Secretaria" }, criadaEm: instante, motivo: "Documento conferido", revisaoHash: "hash" }],
      temProxima: false,
    } });
    const original = renderToStaticMarkup(await OriginalPage({ params: Promise.resolve({ id: "matricula", artefatoId: "original" }), searchParams: Promise.resolve({}) }));

    for (const html of [contrato, previa, participantes, original]) {
      expect(html).toContain("31/12/2025, 20:30");
      expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    }
    expect(contrato).toContain("CTR · versão 1");
    expect(previa).toContain("Arquivo anterior à assinatura; geração não comprova aceite.");
    expect(participantes).toContain('name="maioridade"');
    expect(original).toContain("Aceite conferido");
    expect(original).toContain("31/12/2025, 21:30");
    expect(original).toContain("31/12/2025, 22:30");
    expect(original).toContain("Prazo registrado: 31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
  });

  it("recorre a UTC se a preferência estiver ausente ou indisponível e preserva a guarda em cada histórico", async () => {
    const paginas = [
      () => ContratoPage({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }),
      () => PreviaPage({ params: Promise.resolve({ id: "matricula", previaId: "previa" }), searchParams: Promise.resolve({}) }),
      () => ParticipantesPage({ params: Promise.resolve({ id: "matricula", previaId: "previa" }), searchParams: Promise.resolve({}) }),
      () => OriginalPage({ params: Promise.resolve({ id: "matricula", artefatoId: "original" }), searchParams: Promise.resolve({}) }),
    ];

    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
    for (const renderizar of paginas) {
      const html = renderToStaticMarkup(await renderizar());
      expect(html).toContain("01/01/2026, 02:30");
      expect(html).toContain("horário exibido em UTC; origem UTC");
    }

    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Preferência indisponível." });
    const comFalhaNaConsulta = renderToStaticMarkup(await OriginalPage({ params: Promise.resolve({ id: "matricula", artefatoId: "original" }), searchParams: Promise.resolve({}) }));
    expect(comFalhaNaConsulta).toContain("01/01/2026, 02:30");
    expect(comFalhaNaConsulta).toContain("horário exibido em UTC; origem UTC");

    const consultasAntesDaGuarda = mocks.preferencia.mock.calls.length;
    for (const renderizar of paginas) {
      mocks.sessao.mockRejectedValueOnce(new Error("Sessão expirada."));
      await expect(renderizar()).rejects.toThrow("Sessão expirada.");
    }
    expect(mocks.preferencia).toHaveBeenCalledTimes(consultasAntesDaGuarda);
  });
});
