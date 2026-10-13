import { existsSync, readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_SEM_RESET, ROTAS_COM_ERROR, ROTAS_COM_LOADING } from "./borda-rota-mapa";
import { clicar } from "@/test/tela-sem-dom";

// E10 — borda de rota (docs/43 §6 item 10). Render de cada loading.tsx e error.tsx da lista fechada
// (src/app/borda-rota-mapa.ts): o loading anuncia a espera e não desenha em dobro o título que o layout
// do segmento já desenha (C3 da issue #170); o error.tsx mostra a área, nunca o erro técnico, e o
// "Tentar de novo" chama reset; a volta leva ao índice da área.
const m = vi.hoisted(() => ({ caminho: "/", params: {} as Record<string, string> }));
vi.mock("next/navigation", () => ({ usePathname: () => m.caminho, useParams: () => m.params }));

import { ErroArea, TEXTO_ERRO_AREA, destinoDoErro } from "@/components/ErroArea";
import { EstadoRota } from "@/components/EstadoRota";

import LoadingApp from "@/app/(app)/loading";
import LoadingPortalAluno from "@/app/portal-aluno/loading";
import LoadingAlunos from "@/app/(app)/alunos/(lista)/loading";
import LoadingLeads from "@/app/(app)/leads/(lista)/loading";
import LoadingInbox from "@/app/(app)/inbox/loading";
import LoadingPipeline from "@/app/(app)/pipeline/loading";
import LoadingFinanceiro from "@/app/(app)/financeiro/(painel)/loading";
import LoadingContinuidade from "@/app/(app)/financeiro/continuidade/loading";
import LoadingMinhas from "@/app/(app)/academico/segundas-chamadas/minhas/loading";
import LoadingMatricula from "@/app/(app)/matriculas/[id]/loading";
import LoadingAcademico from "@/app/(app)/academico/loading";
import LoadingDiario from "@/app/(app)/diario/loading";
import LoadingSecretaria from "@/app/(app)/secretaria/loading";
import LoadingConfiguracao from "@/app/(app)/configuracao/loading";
import LoadingLogin from "@/app/login/loading";
import LoadingPagar from "@/app/pagar/[token]/loading";
import LoadingCertificado from "@/app/certificado/[codigo]/loading";

import ErroApp from "@/app/(app)/error";
import ErroPortalAluno from "@/app/portal-aluno/error";
import ErroAcademico from "@/app/(app)/academico/error";
import ErroAlunos from "@/app/(app)/alunos/error";
import ErroCarteiras from "@/app/(app)/carteiras/error";
import ErroComissoes from "@/app/(app)/comissoes/error";
import ErroConfiguracao from "@/app/(app)/configuracao/error";
import ErroDiario from "@/app/(app)/diario/error";
import ErroEmpresas from "@/app/(app)/empresas/error";
import ErroFinanceiro from "@/app/(app)/financeiro/error";
import ErroInbox from "@/app/(app)/inbox/error";
import ErroLeads from "@/app/(app)/leads/error";
import ErroMatricula from "@/app/(app)/matriculas/[id]/error";
import ErroPipeline from "@/app/(app)/pipeline/error";
import ErroSecretaria from "@/app/(app)/secretaria/error";
import ErroPagar from "@/app/pagar/[token]/error";
import ErroCertificado from "@/app/certificado/[codigo]/error";

type Rota<L extends readonly string[]> = L[number];

/** Cada loading da lista, com o número de títulos que ele desenha (0 quando o layout acima já tem o h1). */
const LOADINGS: Record<Rota<typeof ROTAS_COM_LOADING>, { Componente: () => ReactNode; titulos: 0 | 1; rotulo: string }> = {
  "src/app/(app)": { Componente: LoadingApp, titulos: 1, rotulo: "Carregando" },
  "src/app/portal-aluno": { Componente: LoadingPortalAluno, titulos: 1, rotulo: "Carregando" },
  "src/app/(app)/alunos/(lista)": { Componente: LoadingAlunos, titulos: 1, rotulo: "Carregando alunos" },
  "src/app/(app)/leads/(lista)": { Componente: LoadingLeads, titulos: 1, rotulo: "Carregando leads" },
  "src/app/(app)/inbox": { Componente: LoadingInbox, titulos: 1, rotulo: "Carregando conversas" },
  "src/app/(app)/pipeline": { Componente: LoadingPipeline, titulos: 1, rotulo: "Carregando funil de leads" },
  "src/app/(app)/financeiro/(painel)": { Componente: LoadingFinanceiro, titulos: 0, rotulo: "Carregando financeiro" },
  "src/app/(app)/financeiro/continuidade": { Componente: LoadingContinuidade, titulos: 0, rotulo: "Carregando fila de continuidade mensal…" },
  "src/app/(app)/academico/segundas-chamadas/minhas": { Componente: LoadingMinhas, titulos: 0, rotulo: "Carregando suas segundas chamadas designadas…" },
  "src/app/(app)/matriculas/[id]": { Componente: LoadingMatricula, titulos: 1, rotulo: "Carregando seção da matrícula" },
  "src/app/(app)/academico": { Componente: LoadingAcademico, titulos: 1, rotulo: "Carregando acadêmico" },
  "src/app/(app)/diario": { Componente: LoadingDiario, titulos: 1, rotulo: "Carregando diário de aulas" },
  "src/app/(app)/secretaria": { Componente: LoadingSecretaria, titulos: 1, rotulo: "Carregando secretaria" },
  "src/app/(app)/configuracao": { Componente: LoadingConfiguracao, titulos: 0, rotulo: "Carregando configuração" },
  "src/app/login": { Componente: LoadingLogin, titulos: 1, rotulo: "Carregando acesso" },
  "src/app/pagar/[token]": { Componente: LoadingPagar, titulos: 1, rotulo: "Carregando pagamento" },
  "src/app/certificado/[codigo]": { Componente: LoadingCertificado, titulos: 1, rotulo: "Carregando validação do certificado" },
};

/** Os layout.tsx que envolvem o loading de `rota` (o do mesmo segmento e os de cima, até src/app). */
function layoutsAcima(rota: string): string[] {
  const partes = rota.split("/");
  const saida: string[] = [];
  for (let i = partes.length; i >= 2; i--) {
    const arquivo = `${partes.slice(0, i).join("/")}/layout.tsx`;
    if (existsSync(arquivo)) saida.push(arquivo);
  }
  return saida;
}

const titulos = (html: string) => html.split('data-esqueleto="titulo"').length - 1;

describe("loading.tsx: anúncio e formato (E10)", () => {
  it("o render cobre exatamente a lista fechada", () => {
    expect(Object.keys(LOADINGS).sort()).toEqual([...ROTAS_COM_LOADING].sort());
  });

  for (const [rota, { Componente, titulos: esperado, rotulo }] of Object.entries(LOADINGS)) {
    it(`${rota}: anuncia a espera e desenha ${esperado} título`, () => {
      const html = renderToStaticMarkup(createElement(Componente));
      expect(html).toMatch(/\brole="status"/);
      expect(html).toContain(`>${rotulo}</p>`);
      expect(titulos(html), "barras de título").toBe(esperado);
    });
  }

  it("sob um layout que já desenha o h1 (financeiro, configuração), o esqueleto não desenha outro título — e é o layout que diz isso", () => {
    for (const [rota, { titulos: esperado }] of Object.entries(LOADINGS)) {
      const comH1 = layoutsAcima(rota).filter((l) => /<h1\b/.test(readFileSync(l, "utf-8")));
      if (comH1.length) expect(esperado, `${rota} (h1 em ${comH1.join(", ")})`).toBe(0);
    }
    // As duas áreas cujo layout tem o h1 estão na conta (a regra acima não é vazia).
    expect(layoutsAcima("src/app/(app)/financeiro/(painel)")).toContain("src/app/(app)/financeiro/(painel)/layout.tsx");
    expect(layoutsAcima("src/app/(app)/configuracao")).toContain("src/app/(app)/configuracao/layout.tsx");
  });

  it("C3 da #170: o esqueleto do financeiro não repete o título nem a fileira de abas — só os indicadores e a tabela", () => {
    const html = renderToStaticMarkup(createElement(LoadingFinanceiro));
    expect(titulos(html)).toBe(0);
    expect(html).not.toMatch(/h-8 w-24/); // a fileira de 5 abas do antigo EsqueletoAbas
    expect([...html.matchAll(/class="rounded-md bg-surface-muted h-20"/g)]).toHaveLength(4);
    expect(html).toContain("overflow-hidden rounded-lg border border-gray-200");
  });

  it("páginas públicas: cartão centralizado, fora do shell", () => {
    expect(renderToStaticMarkup(createElement(LoadingLogin))).toMatch(/^<div class="flex min-h-screen items-center justify-center px-4" aria-busy="true">/);
    for (const Componente of [LoadingPagar, LoadingCertificado]) {
      expect(renderToStaticMarkup(createElement(Componente))).toMatch(/^<div class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10" aria-busy="true">/);
    }
  });
});

type PropsErro = { error: Error & { digest?: string }; reset: () => void };
type CasoErro = { Componente: (p: PropsErro) => ReactNode; caminho: string; titulo: string; voltar: string | null; params?: Record<string, string> };

/** Cada error.tsx da lista, aberto num caminho da área, com o título e a volta esperados. */
const ERROS: Record<Rota<typeof ROTAS_COM_ERROR>, CasoErro> = {
  "src/app/(app)": { Componente: ErroApp, caminho: "/home", titulo: "Não foi possível carregar esta tela", voltar: null },
  "src/app/portal-aluno": { Componente: ErroPortalAluno, caminho: "/portal-aluno", titulo: "Não foi possível abrir esta página", voltar: null },
  "src/app/(app)/academico": { Componente: ErroAcademico, caminho: "/academico/avaliacoes", titulo: "Não foi possível carregar o acadêmico", voltar: "/academico" },
  "src/app/(app)/alunos": { Componente: ErroAlunos, caminho: "/alunos/a1", titulo: "Não foi possível carregar os alunos", voltar: "/alunos" },
  "src/app/(app)/carteiras": { Componente: ErroCarteiras, caminho: "/carteiras", titulo: "Não foi possível carregar as carteiras", voltar: "/home" },
  "src/app/(app)/comissoes": { Componente: ErroComissoes, caminho: "/comissoes", titulo: "Não foi possível carregar as comissões", voltar: "/home" },
  "src/app/(app)/configuracao": { Componente: ErroConfiguracao, caminho: "/configuracao/migracao/l1", titulo: "Não foi possível carregar esta configuração", voltar: "/configuracao" },
  "src/app/(app)/diario": { Componente: ErroDiario, caminho: "/diario/reposicoes/r1/troca-fonte", titulo: "Não foi possível carregar o diário de aulas", voltar: "/diario" },
  "src/app/(app)/empresas": { Componente: ErroEmpresas, caminho: "/empresas/e1", titulo: "Não foi possível carregar as empresas", voltar: "/empresas" },
  "src/app/(app)/financeiro": { Componente: ErroFinanceiro, caminho: "/financeiro/acertos-taxa", titulo: "Não foi possível carregar o financeiro", voltar: "/financeiro" },
  "src/app/(app)/inbox": { Componente: ErroInbox, caminho: "/inbox", titulo: "Não foi possível carregar a inbox", voltar: "/home" },
  "src/app/(app)/leads": { Componente: ErroLeads, caminho: "/leads/l1/contratacao", titulo: "Não foi possível carregar os leads", voltar: "/leads" },
  "src/app/(app)/matriculas/[id]": { Componente: ErroMatricula, caminho: "/matriculas/m1/preparacao", params: { id: "m1" }, titulo: "Não foi possível carregar esta seção da matrícula", voltar: "/matriculas/m1" },
  "src/app/(app)/pipeline": { Componente: ErroPipeline, caminho: "/pipeline", titulo: "Não foi possível carregar o funil de leads", voltar: "/home" },
  "src/app/(app)/secretaria": { Componente: ErroSecretaria, caminho: "/secretaria/reservas", titulo: "Não foi possível carregar a secretaria", voltar: "/secretaria" },
  "src/app/pagar/[token]": { Componente: ErroPagar, caminho: "/pagar/t1", titulo: "Não foi possível abrir o pagamento", voltar: null },
  "src/app/certificado/[codigo]": { Componente: ErroCertificado, caminho: "/certificado/C1", titulo: "Não foi possível conferir o certificado agora", voltar: null },
};

const erroTecnico = () => Object.assign(new Error("SEGREDO-TECNICO: relation \"Cobranca\" does not exist"), { digest: "DIGEST-123" });

/** O href do link de volta (<VoltarPara>, nome acessível "Voltar para …"); um por tela, no máximo. */
const voltas = (html: string) => (html.match(/<a\b[^>]*aria-label="Voltar para [^"]*"[^>]*>/g) ?? []).map((tag) => tag.match(/\bhref="([^"]*)"/)?.[1] ?? "(sem href)");

/** Expande ErroArea e EstadoRota (componentes sem gancho) para o "Tentar de novo" aparecer como <button>. */
type No = { type: unknown; props: Record<string, unknown> };
function expandir(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(expandir);
  if (!v || typeof v !== "object" || !("type" in v) || !("props" in v)) return v;
  const el = v as No;
  if (el.type === ErroArea || el.type === EstadoRota) return expandir((el.type as (p: unknown) => unknown)(el.props));
  return { ...el, props: { ...el.props, children: expandir(el.props.children) } };
}

function abrir(caso: CasoErro, caminho = caso.caminho) {
  m.caminho = caminho;
  m.params = caso.params ?? {};
  const reset = vi.fn();
  const props = { error: erroTecnico(), reset };
  return { html: renderToStaticMarkup(createElement(caso.Componente, props)), arvore: expandir(caso.Componente(props)) as ReactNode, reset };
}

describe("error.tsx: área, volta e \"Tentar de novo\" (E10)", () => {
  beforeEach(() => {
    m.caminho = "/";
    m.params = {};
  });

  it("o render cobre exatamente a lista fechada", () => {
    expect(Object.keys(ERROS).sort()).toEqual([...ROTAS_COM_ERROR].sort());
  });

  for (const [rota, caso] of Object.entries(ERROS)) {
    it(`${rota}: título da área, nenhum detalhe técnico, volta certa e "Tentar de novo" chama reset`, () => {
      const { html, arvore, reset } = abrir(caso);
      expect(html).toMatch(new RegExp(`<h[12] class="text-2xl font-medium">${caso.titulo}</h[12]>`));
      expect(html).not.toContain("SEGREDO-TECNICO");
      expect(html).not.toContain("does not exist");
      expect(html).not.toContain("DIGEST-123");
      expect(voltas(html)).toEqual(caso.voltar ? [caso.voltar] : []);
      if (rota in ERROR_SEM_RESET) {
        expect(html).not.toContain("Tentar de novo");
        return;
      }
      expect(html).toContain('<button type="button"');
      expect(reset).not.toHaveBeenCalled();
      clicar(arvore, "Tentar de novo");
      expect(reset).toHaveBeenCalledTimes(1);
    });
  }

  it("um título só: dentro do layout da Configuração (que já tem o h1) o erro é h2; nas outras áreas, h1", () => {
    const configuracao = abrir(ERROS["src/app/(app)/configuracao"]).html;
    expect(configuracao).not.toContain("<h1");
    expect(configuracao).toContain('<h2 class="text-2xl font-medium">Não foi possível carregar esta configuração</h2>');
    expect(abrir(ERROS["src/app/(app)/secretaria"]).html.split("<h1").length - 1).toBe(1);
  });

  it("as áreas usam o texto comum (sem prometer o que não sabe) e as páginas públicas falam com quem recebeu o link", () => {
    expect(abrir(ERROS["src/app/(app)/secretaria"]).html).toContain(TEXTO_ERRO_AREA);
    const pagar = abrir(ERROS["src/app/pagar/[token]"]).html;
    expect(pagar).toMatch(/^<main class="mx-auto flex min-h-screen max-w-md/);
    expect(pagar).toContain("fale com a Secretaria da escola pelo canal em que recebeu este link");
    expect(pagar).not.toContain("administrador");
    const certificado = abrir(ERROS["src/app/certificado/[codigo]"]).html;
    expect(certificado).toContain("Isto não indica que o certificado seja inválido.");
    expect(certificado).not.toContain("administrador");
  });

  it("a volta não leva de novo à tela que acabou de falhar: do índice da área vai ao início", () => {
    const voltaEm = (rota: Rota<typeof ROTAS_COM_ERROR>, caminho: string) => voltas(abrir(ERROS[rota], caminho).html);
    expect(voltaEm("src/app/(app)/secretaria", "/secretaria")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/secretaria", "/secretaria?busca=ana")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/academico", "/academico")).toEqual(["/home"]);
    // Financeiro: o painel e as abas são o próprio índice; as telas avulsas voltam ao Financeiro.
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro/")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro/cobrancas")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro/cambio?x=1")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro/recebimentos")).toEqual(["/financeiro"]);
    expect(voltaEm("src/app/(app)/financeiro", "/financeiro/cobrancas/x")).toEqual(["/financeiro"]);
    // Configuração: uma sub-aba já é o índice (as outras seguem no layout).
    expect(voltaEm("src/app/(app)/configuracao", "/configuracao/usuarios")).toEqual(["/home"]);
    expect(voltaEm("src/app/(app)/configuracao", "/configuracao")).toEqual(["/home"]);
    // Matrícula: da seção ao hub; do hub à Secretaria.
    expect(voltaEm("src/app/(app)/matriculas/[id]", "/matriculas/m1")).toEqual(["/secretaria"]);
  });

  it("o link de volta da matrícula tem o nome do destino (mapa da trilha)", () => {
    expect(abrir(ERROS["src/app/(app)/matriculas/[id]"]).html).toContain('aria-label="Voltar para Matrícula"');
    expect(abrir(ERROS["src/app/(app)/matriculas/[id]"], "/matriculas/m1").html).toContain('aria-label="Voltar para Secretaria"');
  });

  it("destinoDoErro ignora query string e barra final, e aceita outro destino acima do índice", () => {
    expect(destinoDoErro("/secretaria/reservas", "/secretaria")).toBe("/secretaria");
    expect(destinoDoErro("/secretaria/", "/secretaria")).toBe("/home");
    expect(destinoDoErro("/secretaria#topo", "/secretaria")).toBe("/home");
    expect(destinoDoErro("/matriculas/m1", "/matriculas/m1", "/secretaria")).toBe("/secretaria");
    expect(destinoDoErro("/secretariaX", "/secretaria")).toBe("/secretaria");
  });
});
