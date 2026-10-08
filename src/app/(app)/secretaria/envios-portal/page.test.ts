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

    await expect(Page({ searchParams: Promise.resolve({ pagina: "2" }) })).rejects.toThrow("acesso negado");

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  it("mostra estados sem alegar entrega e pagina nos dois sentidos", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      itens: [
        { id: "interno", alunoNome: "Ana", finalidade: "CONVITE", situacao: "ENVIADO", criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
        { id: "interno-2", alunoNome: "Bia", finalidade: "RECUPERACAO", situacao: "INCERTO", criadoEm: new Date("2026-09-16T12:00:00.000Z"), atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
      ],
      pagina: 3,
      temProxima: true,
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));

    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 3 });
    expect(html).toContain("Aceito pelo provedor");
    expect(html).toContain("Resultado incerto exige conciliação");
    expect(html).not.toMatch(/entregue ao aluno/i);
    expect(html).toContain("16/09/2026, 06:00 (horário exibido em America/Costa_Rica; origem UTC)");
    // No meio: as duas direções, cada uma na página certa.
    expect(html).toContain('href="/secretaria/envios-portal?pagina=2">← Anterior');
    expect(html).toContain('href="/secretaria/envios-portal?pagina=4">Próxima');

    // Primeira página: só Próxima, sem link para si mesma.
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ pagina: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toContain("pagina=1");
    expect(primeira).toContain('href="/secretaria/envios-portal?pagina=2">Próxima');

    // Segunda página: Anterior volta à primeira sem ?pagina=1.
    const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(segunda).toContain('href="/secretaria/envios-portal">← Anterior');
  });

  it("vazio: fila zerada na primeira página; 'nesta página' só depois dela", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [], pagina: 1, temProxima: false } });
    const zerada = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(zerada).toContain("Nenhuma solicitação de acesso ao portal na fila.");
    expect(zerada).not.toContain("nesta página");
    expect(zerada).not.toContain("Anterior");
    const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "5" }) }));
    expect(alem).toContain("Nenhuma solicitação nesta página.");
    expect(alem).toContain('href="/secretaria/envios-portal?pagina=4">← Anterior');
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
      ], pagina: 1, temProxima: false,
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
