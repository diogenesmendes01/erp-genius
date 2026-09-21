import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao })); vi.mock("@/server/agenda/grade-consulta", () => ({ consultarPropostaGradeTurma: mocks.consulta })); vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
it("exibe instantes da grade no fuso pessoal e identifica origem", async () => {
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  const i = "2026-01-01T02:30:00.000Z", f = "2026-01-01T03:30:00.000Z";
  mocks.consulta.mockResolvedValue({ ok: true, dado: { id:"p", fusoOrigem:"UTC", turmaCodigo:"T", versao:1, motivo:"Teste", decisao:null, publicada:false, podeDecidir:false, necessitaNovaProposta:false, encontrosFuturos:true, pendencias:[], exibicao:{ grade:{dataInicialInformada:"2026-01-01", primeiraAula:i, previsaoTermino:f, encontros:[{inicio:i,fim:f}]}, origem:{quantidadeAulas:1,duracaoMinutos:60}}, disponibilidade:null } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id:"p" }) })); expect(html).toContain("31/12/2025"); expect(html).toContain("20:30"); expect(html).toContain("America/Costa_Rica; origem UTC");
});
