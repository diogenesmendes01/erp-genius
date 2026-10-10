import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 L2676 (docs/43 §6 item 7): "Problema com o material" aparecia sem campo e sem explicar — o formulário de
// relato some quando a gravação não está liberada (o servidor exige a mesma autorização da reprodução). Agora, no
// lugar dele, o aluno lê por quê e o que fazer.
const mocks = vi.hoisted(() => ({ reposicao: vi.fn(), detalhe: vi.fn(), estado: vi.fn(), autorizar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/portal-aluno/reposicoes", () => ({
  exigirReposicaoDoPortalAluno: mocks.reposicao, consultarEntregaGravacaoPortalAluno: mocks.detalhe, estadoEntregaPortalAluno: mocks.estado,
}));
vi.mock("@/server/gravacoes/autorizacao", () => ({ autorizarReproducaoGravacao: mocks.autorizar }));
vi.mock("@/server/portal-aluno/preferencia-fuso", () => ({ consultarPreferenciaFusoPortalAluno: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("./video-gravacao", () => ({ VideoGravacaoPortalAluno: () => null }));
vi.mock("./entrega-gravacao", () => ({ EntregaGravacaoPortalAluno: () => null }));
import Page from "./page";

const reposicao = (statusMatricula = "ATIVA") => ({ id: "reposicao-interna", matriculaId: "m", modalidade: "GRAVACAO", motivo: "Falta", statusMatricula, autorizada: true, concluida: false, dataResultado: null, entregaValidadaId: null, versaoEntregaValidada: null });
const detalhe = (extra: Record<string, unknown> = {}) => ({ disponivel: true, pausadaDesde: null, prazoEtapaAte: null, liberacaoEspecifica: false, correcoes: [], etapaEntrega: "ENTREGA", entregas: [], entregaValidada: null, relatosIndisponibilidade: [], pausasMaterial: [], ...extra });
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "reposicao-interna" }) }));

describe("relato de indisponibilidade no portal do aluno", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.reposicao.mockResolvedValue(reposicao());
    mocks.detalhe.mockResolvedValue(detalhe());
    mocks.estado.mockReturnValue("PODE_ENTREGAR");
    mocks.preferencia.mockResolvedValue({ fusoExibicao: null });
  });

  it("com a gravação liberada, o formulário aparece e nenhum motivo", async () => {
    mocks.autorizar.mockResolvedValue({});
    const html = await renderizar();
    expect(html).toContain("Relatar indisponibilidade");
    expect(html).toContain('name="descricao"');
    expect(html).not.toContain("Procure a secretaria");
  });

  it("matrícula pausada: sem formulário, com o motivo e o que fazer", async () => {
    mocks.reposicao.mockResolvedValue(reposicao("PAUSADA"));
    mocks.autorizar.mockRejectedValue(new Error("Reprodução não autorizada."));
    const html = await renderizar();
    expect(html).not.toContain('name="descricao"');
    expect(html).toContain("A matrícula está pausada; o relato só pode ser enviado com a matrícula ativa. Procure a secretaria da escola.");
  });

  it("indisponibilidade já confirmada e material ainda não liberado têm motivos próprios", async () => {
    mocks.autorizar.mockRejectedValue(new Error("Reprodução não autorizada."));
    mocks.detalhe.mockResolvedValue(detalhe({ pausadaDesde: "2026-10-01T12:00:00.000Z" }));
    expect(await renderizar()).toContain("A escola já confirmou a indisponibilidade do material e está regularizando");
    mocks.detalhe.mockResolvedValue(detalhe({ disponivel: false }));
    expect(await renderizar()).toContain("O material ainda não foi liberado pela escola.");
  });

  it("acesso bloqueado (ou outro impedimento): ainda assim o motivo e a saída, nunca o bloco vazio", async () => {
    mocks.autorizar.mockRejectedValue(new Error("Reprodução não autorizada."));
    const html = await renderizar();
    expect(html).not.toContain('name="descricao"');
    expect(html).toContain("A gravação não está liberada para você neste momento");
    expect(html).toContain("Procure a secretaria da escola para regularizar.");
  });
});
