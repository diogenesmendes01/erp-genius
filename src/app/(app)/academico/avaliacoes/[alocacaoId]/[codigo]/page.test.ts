import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), fuso: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/lancamentos", () => ({ consultarLancamentosAvaliacao: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("./Formularios", () => ({
  LancarNotas: ({ fuso, anterior }: { fuso: string; anterior: { realizadaEm: string } | null }) => createElement("p", { "data-testid": "lancar-notas" }, `entrada=${fuso}; anterior=${anterior?.realizadaEm}`),
  ConferirNotas: () => null,
}));
vi.mock("../../Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));

import Page from "./page";
import { LancarNotas } from "./Formularios";
import { identidadeNoReact } from "@/test/tela-sem-dom";
import { MSG_LANCAMENTO_SEM_FUSO } from "@/server/avaliacoes/tempo";

const dado = {
  contexto: {
    turma: "Turma A", regraVersao: 2,
    avaliacao: { titulo: "Avaliação final", habilidades: ["FALA"] },
    escala: { minimo: "0", maximo: "10" },
  },
  identificacao: {}, versaoEsperada: 1, oficial: false, podeGerirDesignacao: true, podeLancar: true,
  realizadores: [], registradorId: "professor", pagina: 1, temProxima: true,
  anterior: { realizadaEm: new Date("2026-10-01T02:30:00.000Z"), notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Bom" }] },
  versoes: [{
    id: "versao", versao: 1, realizadaEm: new Date("2026-10-01T02:30:00.000Z"), criadaEm: new Date("2026-10-01T03:30:00.000Z"),
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Bom" }], submetida: true, conteudoHash: "a".repeat(64),
    realizadaPor: null, motivoRegularizacao: null, evidenciasRegularizacao: null,
    autor: { id: "professor", nome: "Ana" }, decisao: { aprovada: true, motivo: "Conferida", criadaEm: new Date("2026-10-01T04:30:00.000Z"), decisor: { id: "gestao", nome: "Bia" } },
    vigente: null, podeDecidir: false, podeAprovar: false,
  }],
};

const renderizar = (busca: { pagina?: string; fuso?: string } = {}) => Page({
  params: Promise.resolve({ alocacaoId: "alocacao", codigo: "final" }),
  searchParams: Promise.resolve(busca),
});

describe("lançamentos de avaliação", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "professor" });
    mocks.consultar.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    // Com a escola sem fuso o lançamento é bloqueado (D10); o padrão destes testes é a escola configurada.
    mocks.fuso.mockResolvedValue("America/Sao_Paulo");
  });

  it("usa a preferência somente no histórico e conserva UTC como entrada explícita", async () => {
    const html = renderToStaticMarkup(await renderizar({ fuso: "UTC" }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("Fuso de exibição do histórico: America/Costa_Rica (origem UTC).");
    // O fuso de entrada mora no formulário (docs/43 §6 item 3): a página só passa o inicial, sem <form method="get">.
    expect(html).not.toContain('method="get"');
    expect(html).toContain("entrada=UTC");
    expect(html).toContain("anterior=2026-10-01T02:30");
    expect(html).toContain('href="?fuso=UTC&amp;pagina=2"');
    expect(html).toContain('href="/academico/avaliacoes/alocacao/final/designacao"');
    // O fuso da escola é sempre conferido, mesmo com fuso na URL: sem ele, não há lançamento (D10).
    expect(mocks.fuso).toHaveBeenCalledTimes(1);
  });

  it("recorre ao fuso informado para o histórico sem preferência e preserva São Paulo na entrada", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar({ fuso: "America/Sao_Paulo" }));
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toContain("Fuso de exibição do histórico: America/Sao_Paulo (origem UTC).");
    expect(html).toContain("entrada=America/Sao_Paulo");
    expect(html).toContain("anterior=2026-09-30T23:30");
    expect(mocks.fuso).toHaveBeenCalledTimes(1);
  });

  it("não consulta lançamentos, preferência ou fuso institucional quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("recusa fuso de entrada inválido sem consultar dados ou preferência", async () => {
    const html = renderToStaticMarkup(await renderizar({ fuso: "Factory" }));
    expect(html).toContain("Fuso inválido");
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fuso).not.toHaveBeenCalled();
  });

  it("sem fuso na URL, usa o fuso institucional configurado como entrada padrão", async () => {
    mocks.fuso.mockResolvedValue("America/Sao_Paulo");
    const html = renderToStaticMarkup(await renderizar({}));
    expect(html).toContain("entrada=America/Sao_Paulo");
  });

  // D10 (decisão do dono, 19/10/2026; C7 da #170): em UTC a data da avaliação pode cair no dia errado. Sem fuso da
  // escola, o formulário de lançamento não aparece; a tela diz por quê e leva à configuração. O histórico continua.
  it("sem fuso institucional configurado, bloqueia o lançamento e leva à configuração do fuso", async () => {
    mocks.fuso.mockResolvedValue(null);
    const html = renderToStaticMarkup(await renderizar({}));
    expect(html).not.toContain("lancar-notas");
    expect(html).toContain(MSG_LANCAMENTO_SEM_FUSO);
    expect(html).toContain('href="/configuracao/operacao"');
    expect(html).toContain("Configurar o fuso da escola");
    expect(html).toContain("Histórico de lançamentos");
    expect(html).toContain("Versão 1");
  });

  it("um fuso escolhido na URL não libera o lançamento quando a escola não tem fuso", async () => {
    mocks.fuso.mockResolvedValue(null);
    const html = renderToStaticMarkup(await renderizar({ fuso: "America/Sao_Paulo" }));
    expect(html).not.toContain("lancar-notas");
    expect(html).toContain(MSG_LANCAMENTO_SEM_FUSO);
  });

  it("com fuso da escola, o lançamento aparece e não há aviso de bloqueio nem de UTC", async () => {
    for (const busca of [{}, { fuso: "UTC" }]) {
      const html = renderToStaticMarkup(await renderizar(busca));
      expect(html).toContain("lancar-notas");
      expect(html).not.toContain(MSG_LANCAMENTO_SEM_FUSO);
      expect(html).not.toContain("Fuso da escola não configurado");
    }
  });

  // docs/43 §6 item 3 (docs/42 L1314): antes, a key do LancarNotas tinha a versão e o fuso, e o formulário só
  // existia na página 1 do histórico — aplicar o fuso, mudar de página ou receber a versão nova apagava as notas.
  it("o formulário tem a mesma identidade no React ao mudar a página do histórico, o fuso da URL e a versão: nada remonta", async () => {
    const base = identidadeNoReact(await renderizar({ fuso: "UTC" }), LancarNotas);
    expect(base).not.toBeNull();
    expect(base!.key).toBeNull();
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, pagina: 2, versoes: [] } });
    expect(identidadeNoReact(await renderizar({ fuso: "UTC", pagina: "2" }), LancarNotas)).toEqual(base);
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, versaoEsperada: 2 } });
    expect(identidadeNoReact(await renderizar({ fuso: "America/Sao_Paulo" }), LancarNotas)).toEqual(base);
  });

  it("na página 2 do histórico o formulário continua e parte da última versão (não da primeira da página)", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { ...dado, pagina: 2, versoes: [] } });
    const html = renderToStaticMarkup(await renderizar({ fuso: "UTC", pagina: "2" }));
    expect(html).toContain("entrada=UTC; anterior=2026-10-01T02:30");
  });
});
