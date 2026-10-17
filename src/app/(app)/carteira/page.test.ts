import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"] as string[], permissoes: [] as string[] } },
  carregar: vi.fn(),
  coberturas: vi.fn(async () => ({ itens: [] as unknown[], possuiMais: false })),
  vendedoresBanco: vi.fn(async () => [{ id: "v1", nome: "Bia" }]),
  config: vi.fn(async () => ({ fusoInstitucional: "America/Sao_Paulo" })),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.vendedoresBanco }, configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("@/server/crm/carteira", async (original) => ({ ...(await original<typeof import("@/server/crm/carteira")>()), carregarCarteira: mocks.carregar }));
vi.mock("@/server/crm/carteira-acoes", () => ({ reatribuirCarteiraEmLote: vi.fn() }));
vi.mock("@/server/acesso/consultas", () => ({ listarCoberturas: mocks.coberturas }));
vi.mock("@/server/acesso/coberturas", () => ({ concederCobertura: vi.fn(), revogarCobertura: vi.fn() }));
vi.mock("@/server/acesso/coberturas-local", () => ({ concederCoberturaLocal: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: async () => ({ ok: true, dado: { fusoExibicao: null } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/carteira", redirect: vi.fn() }));

import Page from "./page";
import { ConsequenciaRevogacao } from "./CoberturasPainel";
import { ConsequenciaReatribuicao, avisoLimiteLote, idsParaSelecionarTodas, textoConclusaoLote } from "./ListaCarteira";
import { TEXTO_CONSEQUENCIA_REATRIBUICAO } from "@/server/crm/carteira";

const linha = { oportunidadeId: "o1", pessoaId: null, empresaId: null, nome: "Ana", tipo: "pf", etapa: "NOVO", dono: { id: "v1", nome: "Bia" }, diasSemInteracao: 3, turmaAtiva: null, tags: [] };
const vendedor = { id: "u1", nome: "U", papeis: ["VENDEDOR"], permissoes: [] };
const gerente = { id: "g1", nome: "G", papeis: ["GERENTE_COMERCIAL"], permissoes: [] };

async function renderPagina(usuario: typeof vendedor, sp: Record<string, string> = {}, linhas: unknown[] = [linha]) {
  mocks.usuario.valor = usuario;
  mocks.carregar.mockResolvedValue({ vendedores: [{ id: "v1", nome: "Bia", total: 1, cobertoPor: null }], linhas, total: linhas.length });
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}
const renderConfirmacaoReatribuir = () => renderToStaticMarkup(createElement(ConsequenciaReatribuicao, { quantidade: 2, para: "Bia" }));

describe("/carteira (página)", () => {
  beforeEach(() => { mocks.coberturas.mockClear(); mocks.carregar.mockClear(); });

  it("guard comercial", () => {
    expect(papeisDoGuardArquivo("src/app/(app)/carteira/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL", "VENDEDOR"]);
  });

  it("vendedor: título Minha carteira, sem trocar responsável e sem aba Coberturas", async () => {
    const html = await renderPagina(vendedor);
    expect(html).toContain("Minha carteira");
    expect(html).toContain("Ana");
    expect(html).not.toContain('aria-label="Mudar responsável"');
    expect(html).not.toContain("Selecionar Ana");
    expect(html).not.toContain("Conceder cobertura");
    expect(html).not.toContain("Coberturas");
    const pedindo = await renderPagina(vendedor, { aba: "coberturas" });
    expect(pedindo).not.toContain("Conceder cobertura");
    expect(mocks.coberturas).not.toHaveBeenCalled();
  });

  it("gerente: seleciona em lote e vê a aba Coberturas; conceder e vazio da lista", async () => {
    const carteira = await renderPagina(gerente);
    expect(carteira).toContain("Carteira");
    expect(carteira).toContain("Selecionar Ana");
    expect(carteira).toContain("Coberturas");
    const html = await renderPagina(gerente, { aba: "coberturas" });
    expect(html).toContain("Conceder cobertura");
    expect(html).toContain("Nenhuma cobertura cadastrada.");
    expect(mocks.coberturas).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), 1);
  });

  it("vazio duplo: carteira vazia × filtro sem resultado", async () => {
    expect(await renderPagina(gerente, {}, [])).toContain("Nenhuma oportunidade na carteira.");
    const filtrado = await renderPagina(gerente, { tipo: "pj" }, []);
    expect(filtrado).toContain("Nenhuma oportunidade com esses filtros.");
    expect(mocks.carregar).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ tipo: "pj" }));
  });

  it("reatribuir mostra a consequência antes de confirmar", () => {
    const html = renderConfirmacaoReatribuir();
    expect(html).toContain(TEXTO_CONSEQUENCIA_REATRIBUICAO);
    expect(html).toContain("2 oportunidades passam para Bia.");
  });

  it("revogar: a lista mostra o botão Revogar só da cobertura vigente", async () => {
    const base = { titular: "Bia", substituto: "Caio", inicio: new Date("2026-10-01T12:00:00Z"), fim: new Date("2026-10-20T12:00:00Z"), motivo: "Férias da titular" };
    mocks.coberturas.mockResolvedValueOnce({ itens: [{ id: "c1", revogadaEm: null, ...base }, { id: "c2", revogadaEm: new Date("2026-10-02T12:00:00Z"), ...base }], possuiMais: false });
    const html = await renderPagina(gerente, { aba: "coberturas" });
    expect(html).toContain("Caio atende a carteira de Bia");
    expect(html.match(/>Revogar</g)).toHaveLength(1);
    expect(html).toContain("Revogada");
  });

  it("revogar mostra a consequência antes de confirmar", () => {
    const periodo = { inicio: { texto: "01/10/2026 09:00", fuso: "America/Sao_Paulo" }, fim: { texto: "20/10/2026 09:00" } };
    const html = renderToStaticMarkup(createElement(ConsequenciaRevogacao, { cobertura: { substituto: "Caio", titular: "Bia" }, periodo }));
    expect(html).toContain("Caio deixa de atender a carteira de Bia na hora");
    expect(html).toContain("01/10/2026 09:00 até 20/10/2026 09:00");
    expect(html).toContain("Revogar a cobertura não tem desfazer pela tela.");
    expect(html).toContain("conceder uma nova cobertura");
  });

  it("selecionar todas marca no máximo 50 e a barra mostra o limite do lote", async () => {
    const muitas = Array.from({ length: 60 }, (_, i) => ({ ...linha, oportunidadeId: `o${i}`, nome: `Pessoa ${i}` }));
    expect(idsParaSelecionarTodas(muitas)).toEqual(muitas.slice(0, 50).map((l) => l.oportunidadeId));
    expect(idsParaSelecionarTodas(muitas.slice(0, 3))).toEqual(["o0", "o1", "o2"]);
    expect(await renderPagina(gerente, {}, muitas)).toContain('aria-label="Selecionar as primeiras 50 oportunidades"');
    expect(await renderPagina(gerente)).toContain('aria-label="Selecionar todas as oportunidades"');
    expect(avisoLimiteLote(10, 60)).toBeNull();
    expect(avisoLimiteLote(50, 50)).toBeNull();
    expect(avisoLimiteLote(50, 60)).toEqual({ texto: "O lote aceita no máximo 50 oportunidades por vez; as demais ficam para o próximo lote.", bloqueia: false });
    expect(avisoLimiteLote(53, 60)).toEqual({ texto: "O lote aceita no máximo 50 oportunidades por vez; desmarque 3.", bloqueia: true });
  });

  it("conclusão do lote só conta as que mudaram de responsável", () => {
    expect(textoConclusaoLote({ feitas: 2, jaEram: 0 })).toBe("2 oportunidades reatribuídas.");
    expect(textoConclusaoLote({ feitas: 1, jaEram: 1 })).toBe("1 oportunidade reatribuída. 1 já era do novo responsável.");
    expect(textoConclusaoLote({ feitas: 0, jaEram: 3 })).toBe("0 oportunidades reatribuídas. 3 já eram do novo responsável.");
  });
});
