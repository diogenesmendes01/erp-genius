import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(), preferencia: vi.fn(), conferencia: vi.fn(), conclusao: vi.fn(), aceite: vi.fn(), integracao: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/contratos/assinatura-conferencia", () => ({ consultarConferenciaAssinatura: mocks.conferencia }));
vi.mock("@/server/contratos/conclusao-consulta", () => ({ consultarConclusaoContratual: mocks.conclusao }));
vi.mock("@/server/contratos/aceite", () => ({ consultarAceiteOriginal: mocks.aceite }));
vi.mock("@/server/contratos/envio", () => ({ consultarIntegracaoAssinatura: mocks.integracao }));
vi.mock("../../EnviarAssinatura", () => ({
  EnviarAssinatura: (p: { modo: string; conferenciaId?: string; processoId?: string; servico: string }) =>
    `[${p.modo}:${p.conferenciaId ?? p.processoId}:${p.servico}]`,
}));

import Page from "./page";

const render = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m", artefatoId: "a" }), searchParams: Promise.resolve({}) }));
const revisao = { hash: "revisao-atual", dados: { regraTaxa: "SEM_PAGAMENTO_PREVIO", taxa: { valor: "10.00", moeda: "BRL", confirmada: true },
  reserva: { status: "ATIVA", expiraEm: "2099-01-01T00:00:00.000Z" }, agenda: [], agendaParticular: null, participantes: [] } };
const simulado = { ok: true, dado: { fornecedor: "SIMULADO", ambiente: "SANDBOX", simulado: true } };
const processo = (estadoEnvio: string, fornecedor = "SIMULADO", ambiente = "SANDBOX", tentativaAtualIniciadaEm: string | null = new Date().toISOString()) => ({ ok: true, dado: { processoId: "p", estadoEnvio, fornecedor, ambiente, tentativaAtualIniciadaEm, conclusao: null } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessao.mockResolvedValue({ papeis: [Papel.SECRETARIA_ACADEMICA] });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: null });
  mocks.conferencia.mockResolvedValue({ ok: true, dado: { revisao, pendencia: null, temProxima: false,
    historico: [{ id: "conf-atual", autor: { nome: "S" }, criadaEm: new Date("2026-01-01T00:00:00Z"), motivo: "ok", revisaoHash: "revisao-atual" }] } });
  mocks.conclusao.mockResolvedValue({ ok: true, dado: null });
  mocks.aceite.mockResolvedValue({ ok: true, dado: null });
  mocks.integracao.mockResolvedValue({ ok: true, dado: null });
});

describe("envio integrado na conferência do original", () => {
  it("sem driver permanece o registro manual: nenhuma ação de envio", async () => {
    const html = await render();
    expect(html).toContain("O envio ao serviço de assinatura ainda não está disponível.");
    expect(html).not.toContain("[ENVIAR");
    expect(html).not.toContain("SIMULADA");
  });

  it("com o driver simulado oferece o envio da conferência atual e sinaliza a simulação", async () => {
    mocks.integracao.mockResolvedValue(simulado);
    const html = await render();
    expect(html).toContain("[ENVIAR:conf-atual:Simulado (nenhum documento sai do ERP)]");
    expect(html).toContain("Integração de assinatura SIMULADA");
  });

  it("sem conferência da revisão atual não oferece o envio", async () => {
    mocks.integracao.mockResolvedValue(simulado);
    mocks.conferencia.mockResolvedValue({ ok: true, dado: { revisao, pendencia: null, temProxima: false,
      historico: [{ id: "antiga", autor: { nome: "S" }, criadaEm: new Date("2026-01-01T00:00:00Z"), motivo: "ok", revisaoHash: "outra" }] } });
    expect(await render()).not.toContain("[ENVIAR");
  });

  it("envio pendente só se concilia pelo mesmo serviço; processo de outro serviço não recebe ação", async () => {
    mocks.integracao.mockResolvedValue(simulado);
    mocks.conclusao.mockResolvedValue(processo("ENVIO_INCERTO"));
    let html = await render();
    expect(html).toContain("[CONCILIAR:p:Simulado (nenhum documento sai do ERP)]");
    expect(html).not.toContain("[ENVIAR");
    expect(html).toContain("Simulado (nenhum documento sai do ERP)");
    mocks.conclusao.mockResolvedValue(processo("ENVIO_INCERTO", "ZAPSIGN", "PRODUCAO"));
    html = await render();
    expect(html).not.toContain("[CONCILIAR");
    expect(html).not.toContain("[ENVIAR");
    mocks.conclusao.mockResolvedValue(processo("ENVIADO"));
    html = await render();
    expect(html).not.toContain("[CONCILIAR");
    expect(html).not.toContain("[ENVIAR");
  });

  it("ENVIANDO recente não oferece conciliação (a criação pode estar em voo); vencido oferece", async () => {
    mocks.integracao.mockResolvedValue(simulado);
    mocks.conclusao.mockResolvedValue(processo("ENVIANDO"));
    expect(await render()).not.toContain("[CONCILIAR");
    mocks.conclusao.mockResolvedValue(processo("ENVIANDO", "SIMULADO", "SANDBOX", new Date(Date.now() - 11 * 60_000).toISOString()));
    expect(await render()).toContain("[CONCILIAR:p:");
  });

  it("processo simulado continua sinalizado mesmo com o driver desligado", async () => {
    mocks.conclusao.mockResolvedValue(processo("ENVIADO"));
    const html = await render();
    expect(html).toContain("Integração de assinatura SIMULADA");
    expect(html).not.toContain("[CONCILIAR");
  });

  it("driver mal configurado aparece como alerta, sem ação", async () => {
    mocks.integracao.mockResolvedValue({ ok: false, erro: "ASSINATURA_DRIVER=\"x\" não é reconhecido." });
    const html = await render();
    expect(html).toContain("não é reconhecido");
    expect(html).not.toContain("[ENVIAR");
  });
});
