import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 L279 (docs/43 §6 item 7): quem aprova a utilização ou a devolução de um crédito decidia sem ver de quem
// era o crédito, e a origem aparecia como "Cobrança de origem: <id>", "Aplicação: <id> · Decisão: <id>".
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), cabecalho: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/financeiro/uso-credito-proposta", () => ({ consultarPropostasUsoCredito: mocks.consultar, proporUtilizacaoCredito: vi.fn() }));
vi.mock("@/server/financeiro/uso-credito-decisao", () => ({ decidirUtilizacaoCredito: vi.fn() }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: mocks.cabecalho }));
vi.mock("./DevolucaoCredito", () => ({ DevolucaoCredito: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

const usuario = { id: "fin", papeis: [Papel.FINANCEIRO] };
const dado = (extra: Record<string, unknown> = {}) => ({
  creditoId: "credito-interno", matriculaId: "matricula-interna", moeda: "BRL", valorCredito: "30.00", reservaDevolucao: "0.00", devolvido: "0.00",
  origemDesistencia: { id: "origem-interna", cobrancaId: "cobranca-origem-interna", valorOriginal: "50.00", criadaEm: "2026-09-01T12:00:00.000Z",
    aplicacaoId: "aplicacao-interna", decisaoId: "decisao-interna", propostaId: "proposta-interna", pedidoId: "pedido-interno",
    cobranca: { codigo: "C-000077", tipo: "MENSALIDADE", vencimento: "2026-08-10T12:00:00.000Z" } },
  cobrancas: [
    { id: "cobranca-aberta-interna", codigo: null, saldo: "20.00", vencimento: "2026-10-10T12:00:00.000Z" },
    { id: "cobranca-codigo-interna", codigo: "C-000099", saldo: "15.00", vencimento: "2026-11-10T12:00:00.000Z" },
  ],
  propostas: [{ id: "uso-interno", cobrancaId: "cobranca-quitada-interna", versao: 1, concordancia: "Aluno concordou por e-mail.", motivo: "Abater mensalidade.", decisao: null, podeDecidir: false, valor: "10.00", criadoEm: "2026-09-20T12:00:00.000Z" }],
  devolucoes: [], aplicacaoDisponivel: true, ...extra,
});
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno-interno", creditoId: "credito-interno" }) }));

describe("proposta de utilização de crédito", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue(usuario);
    mocks.consultar.mockResolvedValue({ ok: true, dado: dado() });
    mocks.cabecalho.mockResolvedValue({ id: "matricula-interna", codigo: "M-000555", status: "ATIVA", alunoId: "aluno-interno", aluno: "Davi Rocha", produto: "Inglês · Regular" });
  });

  it("identifica aluno, matrícula e o crédito (cabeçalho de /matriculas/[id])", async () => {
    const html = await renderizar();
    expect(mocks.cabecalho).toHaveBeenCalledWith(usuario, "matricula-interna");
    expect(html).toContain('aria-label="Aluno e matrícula deste crédito"');
    expect(html).toContain(">Davi Rocha</a>");
    expect(html).toContain("Matrícula: M-000555 · Inglês · Regular");
    expect(html).toContain("Crédito de acerto de desistência · saldo disponível R$ 30,00");
  });

  it("a cobrança de origem e as cobranças da proposta saem por código e vencimento; nenhum id vira texto", async () => {
    const html = await renderizar();
    expect(html).toContain("Cobrança de origem: C-000077 · Mensalidade · vencimento 10/08/2026.");
    expect(html).toContain(">Cobrança sem código · vencimento 10/10/2026 · saldo R$ 20,00</option>");
    expect(html).toContain(">C-000099 · vencimento 10/11/2026 · saldo R$ 15,00</option>");
    expect(html).toContain("<p>Cobrança: Cobrança que não está mais em aberto</p>");
    // Ids só em atributos (href, value): nenhum como texto.
    const texto = html.replace(/(?:href|value)="[^"]*"/g, "");
    for (const id of ["credito-interno", "matricula-interna", "cobranca-origem-interna", "aplicacao-interna", "decisao-interna", "cobranca-aberta-interna", "cobranca-quitada-interna", "aluno-interno"]) expect(texto, id).not.toContain(id);
  });

  it("sem cabeçalho no alcance ou com a consulta recusada, a tela não inventa a identificação", async () => {
    mocks.cabecalho.mockResolvedValue(null);
    expect(await renderizar()).not.toContain("Aluno e matrícula deste crédito");
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Crédito não encontrado para este aluno." });
    const html = await renderizar();
    expect(html).toContain('role="alert">Crédito não encontrado para este aluno.');
    expect(html).not.toContain("Aluno e matrícula deste crédito");
  });
});
