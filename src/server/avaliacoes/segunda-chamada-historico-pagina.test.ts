import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { consulta, sessao } = vi.hoisted(() => ({ consulta: vi.fn(), sessao: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-historico", () => ({ consultarHistoricoReservasSegundaChamada: consulta }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: vi.fn().mockResolvedValue({ ok: true, dado: { fusoExibicao: null } }) }));
vi.mock("@/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/ResolverImpedimento", () => ({ ResolverImpedimento: (p: { realizacoes: { rotulo: string }[] }) => `[resolver:${p.realizacoes.map(z => z.rotulo).join("|")}]` }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));
import Page from "@/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  sessao.mockResolvedValue({ id: "gestor" });
});

afterEach(() => vi.unstubAllGlobals());

it("renderiza links reais codificados, evidência escapada e estados legíveis", async () => {
  consulta.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC", proximoId: "reserva/antiga", itens: [{
    id: "r1", status: "PENDENCIA_ESCOLA", reservadaEm: "2026-09-15T12:00:00Z", reservadaPor: "Gestão",
    encontro: { inicio: "2026-09-15T13:00:00Z", fim: "2026-09-15T14:00:00Z", status: "IMPEDIDO_ESCOLA", professor: "Docente" },
    ocorrencia: { status: "PENDENCIA_ESCOLA", ocorridaEm: "2026-09-15T13:00:00Z", criadaEm: "2026-09-15T14:00:00Z", registradaPor: "Gestão", motivo: "Impedimento registrado", evidencia: "<script>não executar</script>" },
    realizacao: null, resolucaoImpedimento: null, realizacoesQueResolvem: [],
  }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "vinculo/1", codigoAvaliacao: "A 1" }), searchParams: Promise.resolve({ antesId: "r2" }) }));
  expect(html).toContain('href="/academico/segundas-chamadas/vinculo%2F1/A%201"');
  expect(html).toContain('href="/academico/segundas-chamadas/vinculo%2F1/A%201/historico"');
  expect(html).toContain('href="/academico/segundas-chamadas/vinculo%2F1/A%201/historico?antesId=reserva%2Fantiga"');
  expect(html).not.toContain("${");
  expect(html).toContain("Impedido pela escola");
  expect(html).not.toContain("IMPEDIDO_ESCOLA");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(consulta).toHaveBeenCalledWith({ alocacaoId: "vinculo/1", codigoAvaliacao: "A 1", antesId: "r2" });
  expect(sessao).toHaveBeenCalledWith("GERENTE_PEDAGOGICO");
});

it("Q164: oferece a confirmação só com realização oficial posterior e mostra a resolução registrada", async () => {
  const item = { id: "r1", status: "PENDENCIA_ESCOLA", reservadaEm: "2026-09-15T12:00:00Z", reservadaPor: "Gestão", encontro: null, ocorrencia: null, realizacao: null };
  consulta.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC", proximoId: null, itens: [
    { ...item, resolucaoImpedimento: null, realizacoesQueResolvem: [] },
    { ...item, id: "r2", resolucaoImpedimento: null, realizacoesQueResolvem: [{ id: "z9", realizadaEm: "2026-10-20T15:00:00Z" }] },
    { ...item, id: "r3", realizacoesQueResolvem: [], resolucaoImpedimento: { confirmadaEm: "2026-10-21T12:00:00Z", motivo: "Aplicada depois", confirmadaPor: "Gestora", realizadaEm: "2026-10-20T15:00:00Z" } },
  ] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "a", codigoAvaliacao: "I1" }), searchParams: Promise.resolve({}) }));
  expect(html.match(/\[resolver:/g)).toHaveLength(1);
  expect(html).toContain("[resolver:Realizada em 20/10/2026");
  expect(html).toContain("bloqueia o fechamento até existir realização posterior");
  expect(html).toContain("Impedimento resolvido: confirmado por Gestora");
  expect(html).not.toContain("z9");
});

it("mostra falha de autorização sem publicar histórico ou navegação de dados", async () => {
  consulta.mockResolvedValue({ ok: false, erro: "Acesso negado" });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "a", codigoAvaliacao: "I1" }), searchParams: Promise.resolve({}) }));
  expect(html).toBe('<p role="alert">Acesso negado</p>');
});
