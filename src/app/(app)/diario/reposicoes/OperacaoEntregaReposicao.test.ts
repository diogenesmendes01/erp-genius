import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ prorrogarLocal: vi.fn(), liberarLocal: vi.fn(), substituir: vi.fn(), refresh: vi.fn(), useState: vi.fn(), useTransition: vi.fn(), useRef: vi.fn() }));
vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState, useTransition: mocks.useTransition, useRef: mocks.useRef }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/diario/reposicao-entrega-operacional", () => ({
  confirmarIndisponibilidadeOperacional: vi.fn(), liberarEntregaOperacional: vi.fn(), prorrogarEtapaOperacional: vi.fn(), publicarMaterialOperacional: vi.fn(), retomarIndisponibilidadeOperacional: vi.fn(), substituirAvaliadorReposicaoOperacional: mocks.substituir,
}));
vi.mock("@/server/diario/reposicao-operacoes-relatos", () => ({ descartarRelatoIndisponibilidadeEquipe: vi.fn() }));
vi.mock("@/server/diario/reposicao-local", () => ({ prorrogarEtapaOperacionalLocal: mocks.prorrogarLocal, liberarEntregaOperacionalLocal: mocks.liberarLocal }));
vi.mock("./RelatarIndisponibilidadeReposicao", () => ({ RelatarIndisponibilidadeReposicao: () => null }));
import { OperacaoEntregaReposicao, type OperacaoEntrega } from "./OperacaoEntregaReposicao";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";

type No = { type?: unknown; props?: Record<string, unknown> };
function todos(no: unknown, tipo: string): No[] { if (Array.isArray(no)) return no.flatMap(n => todos(n, tipo)); if (!no || typeof no !== "object") return []; const n = no as No; if (typeof n.type === "function") return todos((n.type as (p: Record<string, unknown>) => unknown)(n.props ?? {}), tipo); const filhos = n.props?.children; return [...(n.type === tipo ? [n] : []), ...todos(Array.isArray(filhos) ? filhos : [filhos], tipo)]; }
function texto(no: unknown): string { if (typeof no === "string" || typeof no === "number") return String(no); if (Array.isArray(no)) return no.map(texto).join(""); if (!no || typeof no !== "object") return ""; return texto((no as No).props?.children); }
const operacao: OperacaoEntrega = { reposicaoId: "repo", matriculaStatus: "ATIVA", fuso: "UTC", material: null, etapa: { correcaoId: null, prazoAte: null, prazoInicialAte: null }, liberacao: { podeLiberar: false, expiraEm: null }, indisponibilidade: null, relatosAbertos: [], avaliador: { professorId: "prof-a", nome: "Professor A", inicio: "2026-09-17T00:00:00.000Z", motivo: "Designação anterior" }, avaliadoresDisponiveis: [{ id: "prof-a", nome: "Professor A" }, { id: "prof-b", nome: "Professor B" }] };

function preparar() {
  mocks.useState.mockReturnValue(["", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (callback: () => void) => callback()]);
  mocks.useRef.mockReturnValueOnce({ current: "q40-chave-estável" }).mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  vi.stubGlobal("crypto", { randomUUID: () => "q40-chave-estável" });
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("envia a troca escolhida, conserva a chave no retry e mostra erro de capacidade", async () => {
  preparar();
  let professor = "prof-b";
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: professor, motivo: "Substituição necessária para concluir a avaliação" } as Record<string, string>)[nome] ?? null; } });
  mocks.substituir.mockResolvedValueOnce({ ok: false, erro: "Você não tem permissão para esta ação." }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(OperacaoEntregaReposicao({ operacao, fusoExibicao: "America/Costa_Rica" }), "form")[0].props!;
  await (formulario.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-b";
  await (formulario.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.substituir).toHaveBeenNthCalledWith(1, { reposicaoId: "repo", professorId: "prof-b", motivo: "Substituição necessária para concluir a avaliação", chaveIdempotencia: "q40-chave-estável" });
  expect(mocks.substituir).toHaveBeenNthCalledWith(2, expect.objectContaining({ professorId: "prof-b", chaveIdempotencia: "q40-chave-estável" }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("ignora submissão concorrente enquanto a substituição está pendente", async () => {
  preparar();
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: "prof-b", motivo: "Professor B assume esta reposição gravada" } as Record<string, string>)[nome] ?? null; } });
  let concluir: ((resultado: { ok: boolean }) => void) | undefined;
  mocks.substituir.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  const formulario = todos(OperacaoEntregaReposicao({ operacao, fusoExibicao: "America/Costa_Rica" }), "form")[0].props!;
  (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} });
  (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} });
  expect(mocks.substituir).toHaveBeenCalledTimes(1);
  concluir?.({ ok: true }); await Promise.resolve(); await Promise.resolve();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("renova a chave após sucesso e congela a entrada para retry após erro", async () => {
  preparar();
  const uuid = vi.fn().mockReturnValue("q40-chave-nova"); vi.stubGlobal("crypto", { randomUUID: uuid });
  let professor = "prof-b";
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: professor, motivo: "Troca de avaliador da reposição gravada" } as Record<string, string>)[nome] ?? null; } });
  mocks.substituir.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: "Resultado incerto; repita a mesma operação." }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(OperacaoEntregaReposicao({ operacao, fusoExibicao: "America/Costa_Rica" }), "form")[0].props!;
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-a";
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  professor = "prof-b";
  await (formulario.onSubmit as any)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(mocks.substituir).toHaveBeenNthCalledWith(1, expect.objectContaining({ professorId: "prof-b", chaveIdempotencia: "q40-chave-estável" }));
  expect(mocks.substituir).toHaveBeenNthCalledWith(2, expect.objectContaining({ professorId: "prof-a", chaveIdempotencia: "q40-chave-nova" }));
  expect(mocks.substituir).toHaveBeenNthCalledWith(3, expect.objectContaining({ professorId: "prof-a", chaveIdempotencia: "q40-chave-nova" }));
});

it("mostra liberação, relato e pausa no fuso pessoal, sem esconder a origem", () => {
  preparar();
  const exibicao = texto(OperacaoEntregaReposicao({
    fusoExibicao: "America/Costa_Rica",
    operacao: {
      ...operacao,
      material: { publicadoEm: "2026-09-01T03:30:00.000Z", disponivel: false, fonteTrocaElegivel: false },
      etapa: { correcaoId: null, prazoAte: "2026-09-01T03:30:00.000Z", prazoInicialAte: "2026-09-01T03:30:00.000Z" },
      liberacao: { podeLiberar: true, expiraEm: "2026-09-02T03:30:00.000Z" },
      relatosAbertos: [{ id: "relato-fuso", criadaEm: "2026-09-03T03:30:00.000Z", descricao: "Arquivo indisponível" }],
      indisponibilidade: { id: "pausa-fuso", inicio: "2026-09-04T03:30:00.000Z", motivo: "Aguardando arquivo" },
    },
  }));

  expect(exibicao).toContain("31/08/2026");
  expect(exibicao).toContain("01/09/2026");
  expect(exibicao).toContain("02/09/2026");
  expect(exibicao).toContain("03/09/2026");
  expect(exibicao).toContain("exibido em America/Costa_Rica; origem UTC");
  expect(exibicao).not.toContain("01/09/2026, 03:30");
});


// Integração da #151 (B3): a trava do retry vem do estado `temTentativa` (antes, de ref.current no render).
// Com a tentativa pendente, professor e motivo ficam travados e o botão vira "Repetir substituição" — senão a
// pessoa editaria os campos e o retry reenviaria a entrada congelada sem avisar.
/** Elemento com a prop `name` dada, de qualquer tipo (o CampoTexto vem embrulhado e não é expandido por `todos`). */
function comNome(no: unknown, nome: string): No | undefined {
  if (Array.isArray(no)) { for (const n of no) { const r = comNome(n, nome); if (r) return r; } return undefined; }
  if (!no || typeof no !== "object") return undefined;
  const n = no as No;
  if (n.props?.name === nome) return n;
  if (typeof n.type === "function") return comNome((n.type as (p: Record<string, unknown>) => unknown)(n.props ?? {}), nome);
  return comNome(n.props?.children, nome);
}
function renderComTentativa(temTentativa: boolean) {
  mocks.useState.mockReset().mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([temTentativa, vi.fn()]).mockReturnValue(["", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (callback: () => void) => callback()]);
  mocks.useRef.mockReturnValueOnce({ current: "q40-chave-estável" }).mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  const formulario = todos(OperacaoEntregaReposicao({ operacao, fusoExibicao: "America/Costa_Rica" }), "form")[0];
  return {
    professor: comNome(formulario, "professorId")!,
    motivo: comNome(formulario, "motivo")!,
    botao: texto(todos(formulario, "button")[0]),
  };
}

it("tentativa pendente: professor e motivo travados e o botão diz \"Repetir substituição\"; sem tentativa, editáveis", () => {
  const pendente = renderComTentativa(true);
  expect([pendente.professor.props?.disabled, pendente.motivo.props?.disabled, pendente.botao]).toEqual([true, true, "Repetir substituição"]);
  const livre = renderComTentativa(false);
  expect([livre.professor.props?.disabled, livre.motivo.props?.disabled, livre.botao]).toEqual([false, false, "Confirmar substituição"]);
});

it("envio liga a tentativa pendente; só o sucesso a desliga", async () => {
  const setTemTentativa = vi.fn();
  mocks.useState.mockReset().mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, setTemTentativa]).mockReturnValue(["", vi.fn()]);
  mocks.useTransition.mockReturnValue([false, (callback: () => void) => callback()]);
  mocks.useRef.mockReturnValueOnce({ current: "q40-chave-estável" }).mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  vi.stubGlobal("crypto", { randomUUID: () => "q40-chave-nova" });
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ professorId: "prof-b", motivo: "Substituição necessária para concluir a avaliação" } as Record<string, string>)[nome] ?? null; } });
  mocks.substituir.mockResolvedValueOnce({ ok: false, erro: "Resultado incerto; repita a mesma operação." }).mockResolvedValueOnce({ ok: true });
  const formulario = todos(OperacaoEntregaReposicao({ operacao, fusoExibicao: "America/Costa_Rica" }), "form")[0].props!;
  const enviar = formulario.onSubmit as (evento: { preventDefault(): void; currentTarget: object }) => Promise<void>;
  await enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(setTemTentativa.mock.calls).toEqual([[true]]);
  await enviar({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve();
  expect(setTemTentativa.mock.calls).toEqual([[true], [true], [false]]);
});

// B1 da review do #290: o novo prazo da etapa e o "Expira em" da liberação vão como o texto digitado e o fuso escrito
// ao lado do campo (o `fusoExibicao` da página: pessoal; sem preferência, o da ESCOLA). A conversão é do servidor:
// 25/10 23:59 em America/Sao_Paulo → 2026-10-26T02:59:00.000Z (src/server/operacao/acoes-campo-local.test.ts).
it("prorrogação e liberação mandam o texto digitado e o fuso do campo, sem converter no navegador", async () => {
  preparar();
  mocks.prorrogarLocal.mockResolvedValue({ ok: true }); mocks.liberarLocal.mockResolvedValue({ ok: true });
  vi.stubGlobal("FormData", class { get(nome: string) { return ({ novoPrazo: "2026-10-25T23:59", expiraEm: "2026-10-25T23:59", motivo: "Motivo da prorrogação conferido" } as Record<string, string>)[nome] ?? null; } });
  const comPrazo: OperacaoEntrega = { ...operacao, material: { publicadoEm: "2026-10-01T12:00:00.000Z", disponivel: true, fonteTrocaElegivel: false } as never, etapa: { correcaoId: null, prazoAte: "2026-10-20T02:59:00.000Z", prazoInicialAte: null }, liberacao: { podeLiberar: true, expiraEm: null } };
  const arvore = OperacaoEntregaReposicao({ operacao: comPrazo, fusoExibicao: "America/Sao_Paulo" });
  const ehCampo = (n: No) => n.type === CampoDataHoraLocal;
  const camposDe = (no: unknown): No[] => { if (Array.isArray(no)) return no.flatMap(camposDe); if (!no || typeof no !== "object") return []; const n = no as No; if (ehCampo(n)) return [n]; const filhos = n.props?.children; return camposDe(Array.isArray(filhos) ? filhos : [filhos]); };
  const forms = todos(arvore, "form").filter(f => camposDe(f).length);
  expect(forms.flatMap(f => camposDe(f)).map(n => [n.props!.name, n.props!.fuso])).toEqual([["novoPrazo", "America/Sao_Paulo"], ["expiraEm", "America/Sao_Paulo"]]);
  for (const f of forms) { await (f.props!.onSubmit as (e: { preventDefault(): void; currentTarget: object }) => void)({ preventDefault: vi.fn(), currentTarget: {} }); await Promise.resolve(); }
  expect(mocks.prorrogarLocal).toHaveBeenCalledWith({ reposicaoId: "repo", solicitacaoCorrecaoId: null, prazoAnterior: "2026-10-20T02:59:00.000Z", novoPrazoLocal: "2026-10-25T23:59", fuso: "America/Sao_Paulo", motivo: "Motivo da prorrogação conferido" });
  expect(mocks.liberarLocal).toHaveBeenCalledWith({ reposicaoId: "repo", expiraLocal: "2026-10-25T23:59", fuso: "America/Sao_Paulo", motivo: "Motivo da prorrogação conferido" });
});
