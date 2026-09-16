import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-preparacao", () => ({ consultarDesistenciaPreparacao: mocks.consultar }));
vi.mock("./PedidoFormulario", () => ({ PedidoFormulario: ({ matriculaId }: { matriculaId: string; estadoHash: string }) =>
  createElement("div", { "data-formulario": "desistencia", "data-matricula": matriculaId }, "Formulário de pedido"),
}));
vi.mock("./EfetivacaoFormulario", () => ({ EfetivacaoFormulario: ({ pedidoId }: { pedidoId: string; estadoHash: string }) =>
  createElement("div", { "data-formulario": "efetivacao", "data-pedido": pedidoId }, "Formulário de efetivação"),
}));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  conferencia: {
    codigo: "MAT-21", podeRegistrar: true,
    pendencias: ["Financeiro deve conferir cobranças, comprovantes, recebimentos e eventual acerto."],
    reservas: [{ id: "reserva-interna", tipo: "TURMA", status: "RESERVADA" }],
    quantidadeProcessosAssinatura: 1,
    financeiro: { quantidadeCobrancas: 2, quantidadeCreditos: 0, informesAConferir: 1 },
  },
  estadoHash: "a".repeat(64),
  pedidos: [{ id: "pedido-atual", versao: 3, registradorNome: "Secretaria", criadaEmISO: "2026-09-16T12:00:00.000Z", motivo: "Cliente desistiu da contratação", evidenciaPedido: "Mensagem registrada no atendimento", estadoHash: "a".repeat(64), atual: true },
    { id: "pedido-antigo", versao: 2, registradorNome: "Administração", criadaEmISO: "2026-09-15T12:00:00.000Z", motivo: "Condição anterior", evidenciaPedido: "Atendimento anterior", estadoHash: "b".repeat(64), atual: false }],
  proximaVersao: 4,
  podeEfetivar: false,
  efetivacao: null,
  ...sobrescrever,
} });

describe("DesistenciaPage", () => {
  it("exige o escopo Secretaria/Administração e mostra somente a conferência contextual", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/a?" }) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "matricula/a?" });
    expect(html).toContain("MAT-21");
    expect(html).toContain("2 cobrança(s) · 1 comprovante(s) a conferir · 0 crédito(s) para conferência.");
    expect(html).toContain("1 reserva(s) registrada(s) · 1 processo(s) de assinatura.");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/preparacao");
    expect(html).not.toContain("reserva-interna");
    expect(html).not.toContain("aaaaaaaa");
  });

  it("preserva o histórico e identifica a versão que ficou desatualizada", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Versão 3 · Secretaria");
    expect(html).toContain("Cliente desistiu da contratação");
    expect(html).toContain("Versão 2 · Administração");
    expect(html).toContain("As condições mudaram desde este registro; refaça a conferência antes de prosseguir.");
  });

  it("mantém as pendências visíveis e não monta o formulário fora da preparação", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.consultar.mockResolvedValue(resposta({ conferencia: {
      ...resposta().dado.conferencia,
      podeRegistrar: false,
      pendencias: ["Esta matrícula não está em preparação; confira o fluxo de encerramento aplicável."],
    } }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Esta matrícula não está em preparação");
    expect(html).not.toContain('data-formulario="desistencia"');
    expect(html).not.toContain("Formulário de pedido");
  });

  it("oferece efetivação somente para o caso simples conferido", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({
      conferencia: { ...resposta().dado.conferencia, pendencias: [], financeiro: { quantidadeCobrancas: 0, quantidadeCreditos: 0, informesAConferir: 0 } },
      podeEfetivar: true,
    }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain('data-formulario="efetivacao"');
    expect(html).toContain('data-pedido="pedido-atual"');
    expect(html).not.toContain("tratamento financeiro ou documental ainda não está disponível");
  });

  it("mantém o caso complexo em conferência sem oferecer efetivação", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.consultar.mockResolvedValue(resposta({ podeEfetivar: false, efetivacao: null }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Este caso permanece em conferência.");
    expect(html).not.toContain('data-formulario="efetivacao"');
  });

  it("exibe a efetivação histórica sem convidar reexecução nem marcar o pedido aplicado como desatualizado", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({
      podeEfetivar: false,
      efetivacao: { pedidoId: "pedido-antigo", motivo: "Reserva liberada após conferência", executorNome: "Administração", aplicadaEmISO: "2026-09-16T15:00:00.000Z" },
    }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Desistência efetivada");
    expect(html).toContain("Executada por Administração");
    expect(html).toContain("Reserva liberada após conferência");
    expect(html).not.toContain('data-formulario="efetivacao"');
    expect(html).not.toContain("As condições mudaram desde este registro; refaça a conferência antes de prosseguir.");
  });
});
