import { Suspense, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { elementos, primeiraPintura } from "@/test/tela-sem-dom";

// E10 (docs/43 §6 item 10; docs/42 /matriculas/[id] #3: "/preparacao faz 2 consultas encadeadas"): o
// diagnóstico de prontidão da Secretaria, a segunda consulta, sai num <Suspense> — a proposta aparece
// sem esperar por ele. O guard continua sendo a primeira coisa a rodar.
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), preparacao: vi.fn(), pendencias: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/preparacao-consulta", () => ({ consultarPreparacaoContratacao: mocks.preparacao }));
vi.mock("@/server/secretaria/prontidao-preparacao", () => ({ consultarPendenciasPreparacao: mocks.pendencias }));
vi.mock("@/app/(app)/secretaria/reservas/ConferirReserva", () => ({ ConferirReserva: () => null }));
vi.mock("./DecidirPreco", () => ({ DecidirPreco: () => null }));
import Page from "./page";

const MATRICULA = {
  codigo: "M-000123",
  aluno: { primeiroNome: "Ana", sobrenome: "Souza" },
  produto: { idioma: { nome: "Inglês" }, modalidade: { nome: "Regular" } },
  pais: { nome: "Brasil" },
  secretariaAssumiuEm: null,
};

const abrir = () => Page({ params: Promise.resolve({ id: "m1" }) });
const limites = (arvore: ReactNode) => elementos(arvore).filter((n) => n.type === Suspense);

describe("/matriculas/[id]/preparacao: a prontidão da Secretaria não segura a proposta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preparacao.mockResolvedValue({ ok: true, dado: { matricula: MATRICULA, preparacao: null } });
  });

  it("Secretaria: a página sai antes da consulta de prontidão, com o quadro de pendências num <Suspense> com esqueleto", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    const arvore = await abrir();
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.preparacao.mock.invocationCallOrder[0]);
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
    expect(mocks.pendencias).not.toHaveBeenCalled();

    expect(limites(arvore)).toHaveLength(1);
    const primeira = renderToStaticMarkup(primeiraPintura(arvore) as ReactElement);
    expect(primeira).toContain("Proposta da contratação · M-000123");
    expect(primeira).toContain('href="/matriculas/m1/desistencia"');
    // O título do quadro não depende da consulta: sai já, uma vez só, com o corpo em espera anunciado.
    expect(primeira.split("Pendências para conferência da Secretaria</h2>").length - 1).toBe(1);
    expect(primeira).toMatch(/<p class="sr-only" role="status">Carregando pendências para conferência da Secretaria<\/p>/);
    expect(primeira).toContain('aria-busy="true"');
  });

  it("Secretaria: quando a consulta chega, o quadro mostra as pendências — e a falha dela continua dentro do quadro", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    const [limite] = limites(await abrir());
    const filho = limite.props.children as ReactElement<{ matriculaId: string }>;
    expect(filho.props).toEqual({ matriculaId: "m1" });
    const conteudo = (filho.type as (p: { matriculaId: string }) => Promise<ReactNode>);

    mocks.pendencias.mockResolvedValue({ ok: true, dado: { pendencias: [{ codigo: "PAGADOR", descricao: "Pagador sem documento conferido" }], proximasEtapas: "Confira o pagador." } });
    const html = renderToStaticMarkup((await conteudo(filho.props)) as ReactElement);
    expect(mocks.pendencias).toHaveBeenCalledWith("m1");
    expect(html).toContain("Pendências para conferência da Secretaria</h2>");
    expect(html).toContain("<li>Pagador sem documento conferido</li>");
    expect(html).toContain("Confira o pagador.");
    expect(html).not.toContain("Carregando");

    mocks.pendencias.mockResolvedValue({ ok: false, erro: "Diagnóstico recusado." });
    expect(renderToStaticMarkup((await conteudo(filho.props)) as ReactElement)).toContain('<p role="alert">Diagnóstico recusado.</p>');
  });

  it("Vendedor: sem quadro, sem <Suspense> e sem a consulta de prontidão — a página é a mesma de antes", async () => {
    mocks.sessao.mockResolvedValue({ id: "ven", papeis: [Papel.VENDEDOR] });
    const arvore = await abrir();
    expect(limites(arvore)).toHaveLength(0);
    const html = renderToStaticMarkup(arvore as ReactElement);
    expect(html).toContain("Proposta da contratação · M-000123");
    expect(html).not.toContain("Pendências para conferência da Secretaria");
    expect(html).not.toContain('href="/matriculas/m1/desistencia"');
    expect(mocks.pendencias).not.toHaveBeenCalled();
  });

  it("consulta principal recusada: o alerta, sem quadro e sem consulta de prontidão", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.preparacao.mockResolvedValue({ ok: false, erro: "Matrícula fora da carteira." });
    const html = renderToStaticMarkup((await abrir()) as ReactElement);
    expect(html).toBe('<p role="alert">Matrícula fora da carteira.</p>');
    expect(mocks.pendencias).not.toHaveBeenCalled();
  });
});
