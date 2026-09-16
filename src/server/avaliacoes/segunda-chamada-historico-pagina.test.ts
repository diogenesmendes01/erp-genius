import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { consulta, sessao } = vi.hoisted(() => ({ consulta: vi.fn(), sessao: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-historico", () => ({ consultarHistoricoReservasSegundaChamada: consulta }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: sessao }));
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
    realizacao: null,
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

it("mostra falha de autorização sem publicar histórico ou navegação de dados", async () => {
  consulta.mockResolvedValue({ ok: false, erro: "Acesso negado" });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ alocacaoId: "a", codigoAvaliacao: "I1" }), searchParams: Promise.resolve({}) }));
  expect(html).toBe('<p role="alert">Acesso negado</p>');
});
