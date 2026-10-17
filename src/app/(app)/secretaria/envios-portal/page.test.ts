import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import Page from "./page";

beforeEach(() => { vi.resetAllMocks(); });

describe("fila operacional de envios do portal", () => {
  it("interrompe no guard de Secretaria/Administração antes da consulta", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ depois: "x" }) })).rejects.toThrow("acesso negado");

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  it("mostra estados sem alegar entrega e navega por cursor nos dois sentidos", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    const itens = [
      { id: "interno", alunoNome: "Ana", finalidade: "CONVITE", situacao: "ENVIADO", criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
      { id: "interno-2", alunoNome: "Bia", finalidade: "RECUPERACAO", situacao: "INCERTO", criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
    ];
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens, temAnterior: true, temProxima: true, anterior: "interno", proxima: "interno-2" } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "envio-0" }) }));

    // Sem `situacao` na URL, a tela abre em "Incertos" (docs/42 L431); o recorte vai à consulta junto do cursor.
    expect(mocks.consultar).toHaveBeenCalledWith({ depois: "envio-0", situacao: "incertos" });
    expect(html).toContain("Aceito pelo provedor");
    expect(html).toContain("Resultado incerto exige conciliação");
    expect(html).not.toMatch(/entregue ao aluno/i);
    expect(html).toContain("16/09/2026, 06:00 (horário exibido em America/Costa_Rica; origem UTC)");
    // No meio: Anterior volta a partir do primeiro item; Próxima continua do último.
    expect(html).toContain('href="/secretaria/envios-portal?antes=interno">← Anterior');
    expect(html).toContain('href="/secretaria/envios-portal?depois=interno-2">Próxima');

    // Início: só Próxima, sem link para si mesmo (nem ?pagina=1 nem cursor vazio).
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens, temAnterior: false, temProxima: true, anterior: null, proxima: "interno-2" } });
    const inicio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ situacao: "incertos" });
    expect(inicio).not.toContain("Anterior");
    expect(inicio).not.toContain("pagina=");
    expect(inicio).not.toContain("depois=&");
    expect(inicio).toContain('href="/secretaria/envios-portal?depois=interno-2">Próxima');

    // Voltando: o cursor `antes` chega à consulta.
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ antes: "envio-9" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ antes: "envio-9", situacao: "incertos" });
  });

  it("vazio: fila zerada no início; depois de um cursor que não leva a nada, a volta ao início", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [], temAnterior: false, temProxima: false, anterior: null, proxima: null } });
    const zerada = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ situacao: "todos" }) }));
    expect(zerada).toContain("Nenhuma solicitação de acesso ao portal na fila.");
    expect(zerada).not.toContain("nesta página");
    expect(zerada).not.toContain("Anterior");
    expect(zerada).not.toContain("Ir para o início da fila");
    const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "envio-sumido" }) }));
    expect(alem).toContain("Nenhuma solicitação a partir deste ponto da fila");
    expect(alem).not.toContain("nesta página");
    expect(alem).toContain('href="/secretaria/envios-portal">Ir para o início da fila');
    // A volta ao início fica no mesmo recorte.
    const alemFalhas = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ situacao: "falhas", depois: "envio-sumido" }) }));
    expect(alemFalhas).toContain('href="/secretaria/envios-portal?situacao=falhas">Ir para o início da fila');
  });

  it("abas de situação (docs/42 L431): Incertos é o padrão; cada aba é um link real e a ativa é marcada", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [], temAnterior: false, temProxima: false, anterior: null, proxima: null } });
    const padrao = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(padrao).toContain('aria-label="Situação dos envios"');
    expect(padrao).toContain('<span aria-current="true" class="font-medium text-gray-900">Incertos</span>');
    expect(padrao).toContain('href="/secretaria/envios-portal?situacao=falhas"');
    expect(padrao).toContain('href="/secretaria/envios-portal?situacao=todos"');
    expect(padrao).toContain("Nenhum envio com resultado incerto para conciliar.");
    const falhas = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ situacao: "falhas" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ situacao: "falhas" });
    expect(falhas).toContain('<span aria-current="true" class="font-medium text-gray-900">Falhas</span>');
    // O padrão não leva parâmetro: a aba Incertos volta à rota limpa.
    expect(falhas).toContain('href="/secretaria/envios-portal">Incertos</a>');
    expect(falhas).toContain("Nenhum envio com falha.");
    // Valor desconhecido na URL: o padrão.
    await Page({ searchParams: Promise.resolve({ situacao: "INCERTO" }) });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ situacao: "incertos" });
  });

  it("o cursor anda dentro do recorte: Anterior e Próxima mantêm a situação escolhida", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    const itens = [{ id: "e1", alunoNome: "Ana", finalidade: "CONVITE", situacao: "FALHOU", criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z") }];
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens, temAnterior: true, temProxima: true, anterior: "e1", proxima: "e1" } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ situacao: "falhas", depois: "e0" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ depois: "e0", situacao: "falhas" });
    expect(html).toContain('href="/secretaria/envios-portal?situacao=falhas&amp;antes=e1">← Anterior');
    expect(html).toContain('href="/secretaria/envios-portal?situacao=falhas&amp;depois=e1">Próxima');
  });

  it("mostra evidência auditável e separa os controles de registrar e decidir", async () => {
    mocks.sessao.mockResolvedValue({ id: "admin" });
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível." });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      itens: [
        { id: "pode-decidir", alunoNome: "Ana", finalidade: "CONVITE", situacao: "INCERTO", criadoEm: new Date("2026-01-01T02:30:00.000Z"), atualizadoEm: new Date("2026-01-01T02:30:00.000Z"), podeRegistrarEvidencia: true, podeDecidirReemissao: true,
          conciliacao: { id: "conciliacao", estadoHash: "a".repeat(64), evidencia: "Painel do provedor conferido pela secretaria.", versao: 2, secretariaNome: "Secretaria Ana", criadaEm: new Date("2026-09-16T12:00:00.000Z"), decisao: null } },
        { id: "sem-poder", alunoNome: "Bia", finalidade: "CONVITE", situacao: "INCERTO", criadoEm: new Date("2026-01-01T02:30:00.000Z"), atualizadoEm: new Date("2026-01-01T02:30:00.000Z"), podeRegistrarEvidencia: false, podeDecidirReemissao: false,
          conciliacao: { id: "conciliacao-2", estadoHash: "b".repeat(64), evidencia: "Outra conferência preservada.", versao: 1, secretariaNome: "Outra Secretaria", criadaEm: new Date("2026-09-16T13:00:00.000Z"), decisao: { aprovada: false, decididaEm: new Date("2026-01-01T03:30:00.000Z"), solicitacaoReemitidaId: null } } },
      ], temAnterior: false, temProxima: false, anterior: null, proxima: null,
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Painel do provedor conferido pela secretaria.");
    expect(html).toContain("registrada por Secretaria Ana");
    expect(html).toContain("Conferência 2");
    expect(html).toContain("Registrar evidência");
    expect(html).toContain("Autorizar nova emissão");
    expect(html).toContain("Não autorizar");
    expect(html).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
    expect(html).toContain("Nova emissão não autorizada em 01/01/2026, 03:30 (horário exibido em UTC; origem UTC)");
    expect(html.match(/Registrar evidência/g)).toHaveLength(1);
    expect(html.match(/Autorizar nova emissão/g)).toHaveLength(1);
  });
});
