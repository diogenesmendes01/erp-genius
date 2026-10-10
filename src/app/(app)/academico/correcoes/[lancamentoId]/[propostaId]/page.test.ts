import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 L1399 (docs/43 §6 item 7): o decisor atestava "Conferi … impactos apresentados" vendo só
// "Solicitação <uuid> — Executada". Agora cada mudança impactada sai pela turma de destino.
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), revisar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/correcao", () => ({ revisarCorrecaoNota: mocks.revisar }));
vi.mock("../Formularios", () => ({ DecidirCorrecao: () => null }));
import Page from "./page";

const dado = (extra: Record<string, unknown> = {}) => ({
  lancamentoId: "lancamento", propostaId: "proposta", versao: 2, motivo: "Nota digitada errada.", propostaHash: "a".repeat(64), impactosHash: "b".repeat(64),
  notasPropostas: [], notasVigentes: [], podeAprovar: true, podeDecidir: true,
  identificacao: { aluno: "Elisa Prado", matriculaId: "matricula-interna", matriculaCodigo: null, oferta: "Inglês · Regular", turma: "T-000010", nivel: "B1" },
  impactos: [{ id: "solicitacao-interna-1", status: "EXECUTADA", turmaDestinoId: "turma-interna", decididoEm: null, executadoEm: null }, { id: "solicitacao-interna-2", status: "APROVADA", turmaDestinoId: "turma-interna-2", decididoEm: null, executadoEm: null }],
  impactosLegiveis: [{ id: "solicitacao-interna-1", status: "EXECUTADA", turmaDestino: "T-000020" }, { id: "solicitacao-interna-2", status: "APROVADA", turmaDestino: "sem código" }],
  ...extra,
});
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ lancamentoId: "lancamento", propostaId: "proposta" }) }));

describe("conferir correção de nota", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "gestao" });
    mocks.revisar.mockResolvedValue({ ok: true, dado: dado() });
  });

  it("identifica aluno e matrícula (sem código: \"sem código\", nunca o id)", async () => {
    const html = await renderizar();
    expect(html).toContain('aria-label="Aluno e matrícula desta avaliação"');
    expect(html).toContain("Elisa Prado");
    expect(html).toContain("Matrícula: sem código · Inglês · Regular");
    expect(html).toContain("T-000010 · nível B1");
    expect(html).not.toContain("matricula-interna");
  });

  it("cada mudança impactada sai pela turma de destino; o id da solicitação não é texto", async () => {
    const html = await renderizar();
    expect(html).toContain("<p>Mudança para a turma T-000020 — executada</p>");
    expect(html).toContain("<p>Mudança para a turma sem código — aprovada</p>");
    expect(html).not.toContain("Solicitação");
    expect(html).not.toContain("solicitacao-interna");
  });

  it("sem impactos: o estado vazio de sempre", async () => {
    mocks.revisar.mockResolvedValue({ ok: true, dado: dado({ impactos: [], impactosLegiveis: [] }) });
    expect(await renderizar()).toContain("Nenhuma mudança aprovada ou executada identificada para este vínculo.");
  });
});
