import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// docs/42 L1722 (docs/43 §6 item 7): "Preparar agenda inicial" aparecia em todo item, também nos que a própria
// fila classifica como não acionáveis. Arquivo à parte do page.test.ts (que a #158 reescreve com a paginação):
// a lista vem sem página seguinte e a URL sem parâmetros, o que vale antes e depois dela.
const mocks = vi.hoisted(() => ({ listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-fila-agenda", () => ({ listarSegundasChamadasSemAgenda: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";

const situacao = (s: Record<string, unknown>) => ({ pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true, ...s });
const item = (id: string, s: Record<string, unknown>) => ({ propostaSegundaChamadaId: id, aluno: `Aluno ${id}`, matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: situacao(s) });
const artigo = (html: string, id: string) => html.split("<article").find((a) => a.includes(`Aluno ${id}`)) ?? "";

describe("fila de segundas chamadas pendentes de agenda: preparar só quando faz sentido", () => {
  it("disponível ou \"a prévia confirmará\": o link de preparar; não acionável: o motivo e o que fazer, sem o link", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.listar.mockResolvedValue({ ok: true, dado: { proximoCursor: null, temProxima: false, itens: [
      item("disponivel", {}),
      item("vinculo", { alocacaoAtiva: false }),
      item("anterior", { possuiReservaTerminal: true }),
      item("escola", { possuiPendenciaEscola: true }),
      item("pausada", { statusMatricula: "PAUSADA" }),
      item("semsaldo", { saldo: 0 }),
    ] } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    for (const id of ["disponivel", "vinculo", "anterior"]) expect(artigo(html, id), id).toContain(`href="/academico/segundas-chamadas/propostas/${id}/agenda">Preparar agenda inicial</a>`);
    for (const id of ["escola", "pausada", "semsaldo"]) expect(artigo(html, id), id).not.toContain("Preparar agenda inicial");
    expect(artigo(html, "escola")).toContain("Agenda indisponível até a Gestão Pedagógica revisar o impedimento registrado pela escola.");
    expect(artigo(html, "pausada")).toContain("a agenda exige autorização específica da Gestão Pedagógica");
    expect(artigo(html, "pausada")).toContain(">Conferir a autorização na prévia</a>");
    expect(artigo(html, "semsaldo")).toContain("não há agenda a preparar");
    // Mesmo sem preparo, há saída: a consulta das propostas da segunda chamada.
    expect(artigo(html, "semsaldo")).toContain('href="/academico/segundas-chamadas/propostas/semsaldo/agenda"');
  });
});
