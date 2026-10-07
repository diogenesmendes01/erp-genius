import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilaCobrancaItem } from "@/server/cobrancas/consultas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/server/financeiro/acoes", () => ({ registrarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/financeiro/cobranca-manual", () => ({ prepararCobrancaManual: vi.fn() }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes", () => ({ aprovarLoteCobranca: vi.fn(), enfileirarCobrancaWhatsApp: vi.fn() }));
vi.mock("./AcessoAulasPainel", () => ({ AcessoAulasPainel: ({ matriculaId, alunoId, preferenciaFusoExibicao }: { matriculaId?: string; alunoId?: string; preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-acesso": `${matriculaId ?? alunoId ?? "geral"}:${preferenciaFusoExibicao ?? "UTC"}` }) }));

// Captura as opções passadas a useFiltrosUrl (o caminho com JavaScript: buscar navega pelo
// hrefDosCampos da fila); o handler de clique sai marcado com o href que o gerou (molde de EmpresasCliente.test).
const capturado = vi.hoisted(() => ({ opcoes: [] as { campos: Record<string, string>; hrefDosCampos: (c: Record<string, string>) => string }[] }));
vi.mock("@/lib/filtros-url", async (original) => {
  const real = await original<typeof import("@/lib/filtros-url")>();
  return { ...real, useFiltrosUrl: (o: Parameters<typeof real.useFiltrosUrl>[0]) => {
    capturado.opcoes.push(o as never);
    const r = real.useFiltrosUrl(o);
    return { ...r, aoClicar: (href: string) => Object.assign(r.aoClicar(href), { navegaPara: href }) };
  } };
});
// Cada <Link> renderizado: o href, o texto visível (descendo nos elementos filhos — o cartão tem número e
// rótulo em <div>s), o handler do clique (com JavaScript, o clique simples segue o handler, não o href) e
// o de teclado (o cartão com role="button" aciona com Espaço).
type TeclaFalsa = { key: string; preventDefault: () => void; currentTarget: { click: () => void } };
const links = vi.hoisted(() => ({ lista: [] as { href: string; texto: string; onClick?: { navegaPara?: string }; onKeyDown?: (e: TeclaFalsa) => void }[] }));
vi.mock("next/link", async () => {
  const { createElement: h, isValidElement } = await import("react");
  const texto = (c: unknown): string => typeof c === "string" || typeof c === "number" ? String(c)
    : Array.isArray(c) ? c.map(texto).join(" ")
    : isValidElement(c) ? texto((c.props as { children?: unknown }).children) : "";
  return { default: ({ href, onClick, onKeyDown, children, ...resto }: { href: string; onClick?: { navegaPara?: string }; onKeyDown?: (e: TeclaFalsa) => void; children?: unknown }) => {
    links.lista.push({ href: String(href), texto: texto(children).replace(/\s+/g, " ").trim(), onClick, onKeyDown });
    return h("a", { href, ...resto }, children as never);
  } };
});
import { DetalheCobranca, FilaCobranca } from "./FilaCobranca";
import { lerFiltrosFila, opcoesDaFila } from "@/server/cobrancas/filtros-fila";

const item: FilaCobrancaItem = {
  conferenciaAte: null,
  id: "cobranca", cicloRegua: 1, codigo: "COB-1", tipo: "MENSALIDADE",
  valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "BRL",
  vencimento: { estado: "CONFIRMADO", dataCivil: "2026-01-15", fuso: "Pacific/Kiritimati", origem: "EMISSAO_ENTRADA" }, competencia: "2026-01",
  estado: "acao_devida", passo: "D+3", tipoAcao: "cobrar", template: null,
  rotuloAcao: "Cobrar", atrasadaNaAcao: false, diasAtraso: 3, prioridade: 1,
  promessaAte: "2026-01-02T12:00:00.000Z", matriculaId: "matricula",
  acessoBloqueado: false, precisaBloqueio: false, tentativas: 1, ultimaCobrancaEm: null,
  passosFeitos: [], aluno: { id: "aluno", nome: "Ana Silva", telefone: null }, pais: "Brasil", turma: null,
  destino: { telefone: "+5511999999999", nome: "Ana Silva", viaResponsavel: false },
  respondeuEm: "2026-01-01T03:30:00.000Z",
  envio: { passo: "D+3", status: "DESPACHADA", motivo: null, em: "2026-01-01T02:30:00.000Z" },
  mensagemSugerida: "Olá, Ana.",
};

function detalhe(itemAtual: FilaCobrancaItem, preferenciaFusoExibicao: string | null) {
  return renderToStaticMarkup(createElement(DetalheCobranca, {
    item: itemAtual,
    regua: [{ passo: "D+3", offsetDias: 3, tipo: "cobrar", rotulo: "Cobrar" }],
    podeOperar: false,
    preferenciaFusoExibicao,
    onClose: vi.fn(), onEnviarApi: vi.fn(), onPrepararManual: async () => null,
    onConfirmarManual: async () => false, onPagar: vi.fn(), onPromessa: vi.fn(),
  }));
}

describe("DetalheCobranca", () => {
  it("mantém o vencimento em conferência quando a fonte civil está ausente", () => {
    const html = detalhe({ ...item, vencimento: { estado: "A_CONFERIR", motivo: "Fonte contratual ausente" } }, "America/Costa_Rica");
    expect(html).toContain("Vencimento a conferir: Fonte contratual ausente");
    expect(html).not.toContain("vence 15/01/2026");
  });
  it("renderiza envio e resposta na preferência, sem deslocar vencimento ou competência", () => {
    const html = detalhe(item, "America/Costa_Rica");

    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("31/12/2025, 21:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html).toContain(" 01/2026"); // competência formatada, sem deslocar o mês
    expect(html).toContain("vence 15/01/2026");
  });

  it("renderiza a suspensão em UTC sem mudar a promessa civil", () => {
    const html = detalhe({
      ...item,
      estado: "em_conferencia",
      passo: null,
      tipoAcao: null,
      conferenciaAte: "2026-01-01T02:30:00.000Z",
    }, null);

    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");

    const promessa = detalhe({ ...item, estado: "promessa", passo: null, tipoAcao: null }, null);
    expect(promessa).toContain("Promessa de pagamento até 02/01/2026");
  });

  it("encaminha a preferência aos painéis de acesso geral e da cobrança", () => {
    const geral = renderToStaticMarkup(createElement(FilaCobranca, {
      itens: [], totalFila: 0, filtros: lerFiltrosFila({}), opcoes: { paises: [], turmas: [] },
      dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [],
      podeOperar: true, podeBloquear: false, preferenciaFusoExibicao: "America/Costa_Rica",
    }));
    expect(geral).toContain('data-acesso="geral:America/Costa_Rica"');
    const detalheOperavel = renderToStaticMarkup(createElement(DetalheCobranca, {
      item, regua: [], podeOperar: true, preferenciaFusoExibicao: "America/Costa_Rica",
      onClose: vi.fn(), onEnviarApi: vi.fn(), onPrepararManual: async () => null,
      onConfirmarManual: async () => false, onPagar: vi.fn(), onPromessa: vi.fn(),
    }));
    expect(detalheOperavel).toContain('data-acesso="matricula:America/Costa_Rica"');
  });

  it("formata a última cobrança como instante, sem deslocar o vencimento civil", () => {
    const html = detalhe({ ...item, ultimaCobrancaEm: "2026-01-01T02:30:00.000Z" }, "America/Costa_Rica");
    expect(html).toContain("último 31/12/2025, 20:30");
    expect(html).toContain("vence 15/01/2026");
  });
});

describe("FilaCobranca — teclado e diálogo (docs/42 E7)", () => {
  const dashs = { aVencer: 0, emAtraso: 1, bloquear: 0, promessas: 0, recebidoHoje: [] };
  const fila = (podeOperar: boolean) => renderToStaticMarkup(createElement(FilaCobranca, {
    itens: [item, { ...item, id: "outra", aluno: { id: "aluno-2", nome: "Bruno Costa", telefone: null } }],
    totalFila: 2, filtros: lerFiltrosFila({}), opcoes: opcoesDaFila([item], lerFiltrosFila({})),
    dashs, regua: [], podeOperar, podeBloquear: false,
  }));

  it("cada linha abre por um <button type=\"button\"> com o nome do aluno", () => {
    const html = fila(true);
    for (const nome of ["Ana Silva", "Bruno Costa"]) {
      expect(html).toMatch(new RegExp(`<button type="button"[^>]*>(?:(?!</button>).)*${nome}(?:(?!</button>).)*</button>`));
    }
    expect(html).not.toMatch(/<div[^>]*cursor-pointer[^>]*>/);
  });

  it("o checkbox do lote fica fora de qualquer botão e mantém o rótulo", () => {
    const html = fila(true);
    expect(html).toContain('aria-label="Selecionar Ana Silva para o lote"');
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toMatch(/<button\b(?:(?!<\/button>).)*type="checkbox"/);
    // ações rápidas (outros botões) também não ficam aninhadas no botão da linha
    expect(html).not.toMatch(/<button\b(?:(?!<\/button>).)*<button\b/);
  });

  it("o detalhe é um diálogo modal rotulado pelo título, com ✕ nomeado", () => {
    const html = detalhe(item, null);
    expect(html).toMatch(/role="dialog"/);
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');
    const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}" class="text-sm font-medium">Detalhe da cobrança</h2>`);
    expect(html).toContain('aria-label="Fechar detalhe da cobrança"');
  });
});

describe("FilaCobranca — filtros na URL (E4)", () => {
  const ROTA = "/financeiro/cobrancas";
  const dashs = { aVencer: 2, emAtraso: 1, bloquear: 0, promessas: 0, recebidoHoje: [] };
  const costaRica: FilaCobrancaItem = { ...item, id: "cr", pais: "Costa Rica", turma: "Inglês A1" };
  /** Fila com os filtros lidos da URL pelo mesmo leitor da página; 5 cobranças na fila inteira. */
  const fila = (params: Record<string, string>, itens: FilaCobrancaItem[] = [item]) => {
    links.lista = [];
    const filtros = lerFiltrosFila(params);
    return renderToStaticMarkup(createElement(FilaCobranca, {
      itens, totalFila: 5, filtros, opcoes: opcoesDaFila([item, costaRica], filtros),
      dashs, regua: [], podeOperar: true, podeBloquear: false,
    }));
  };
  /** [aria-pressed, texto] de cada cartão-indicador, na ordem. */
  const cartoes = (html: string) => [...html.matchAll(/<a [^>]*role="button" aria-pressed="(true|false)"[^>]*>(.*?)<\/a>/g)]
    .map((m) => [m[1], m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()]);
  const link = (texto: string) => {
    const achados = links.lista.filter((l) => l.texto === texto);
    expect(achados, texto).toHaveLength(1);
    return achados[0];
  };

  it("indicador lido da URL: só o cartão dele sai com aria-pressed=\"true\", dentro do grupo rotulado", () => {
    const html = fila({ indicador: "emAtraso" });
    expect(html).toContain('role="group" aria-label="Filtrar a fila pelos indicadores"');
    expect(cartoes(html)).toEqual([["false", "2 A vencer"], ["true", "1 Em atraso"], ["false", "0 Bloquear"], ["false", "0 Promessas"]]);
    expect(html).toContain("limpar filtro");
    // A seleção do lote continua na linha (o filtro não mexe nela).
    expect(html).toContain('aria-label="Selecionar Ana Silva para o lote"');
  });

  it("sem indicador (ou indicador desconhecido na URL): nenhum cartão pressionado e a fila por prioridade", () => {
    const casos: Record<string, string>[] = [{}, { indicador: "inventado" }, { indicador: "constructor" }];
    for (const params of casos) {
      const html = fila(params);
      expect(cartoes(html).map(([pressionado]) => pressionado)).toEqual(["false", "false", "false", "false"]);
      expect(html).toContain("ordenada por prioridade");
      expect(html).not.toContain("limpar filtro");
    }
  });

  it("link de cada cartão: alterna o indicador (o ativo desliga) mantendo busca e país; cada limpar tira só o seu lado", () => {
    fila({ indicador: "emAtraso", busca: "ana", pais: "Brasil" });
    expect(link("2 A vencer").href).toBe(`${ROTA}?indicador=aVencer&busca=ana&pais=Brasil`);
    expect(link("1 Em atraso").href).toBe(`${ROTA}?busca=ana&pais=Brasil`);
    expect(link("0 Bloquear").href).toBe(`${ROTA}?indicador=bloquear&busca=ana&pais=Brasil`);
    expect(link("0 Promessas").href).toBe(`${ROTA}?indicador=promessas&busca=ana&pais=Brasil`);
    // "limpar filtro" tira só o indicador; "Limpar filtros" tira busca/país/turma e mantém o indicador.
    expect(link("limpar filtro").href).toBe(`${ROTA}?busca=ana&pais=Brasil`);
    expect(link("Limpar filtros").href).toBe(`${ROTA}?indicador=emAtraso`);
  });

  it("com JavaScript, o clique de cada link da fila vai para o MESMO href do link (na transição)", () => {
    const casos: Record<string, string>[] = [{}, { indicador: "bloquear" }, { indicador: "promessas", busca: "ana", turma: "Inglês A1" }];
    for (const params of casos) {
      fila(params);
      const daFila = links.lista.filter((l) => l.href === ROTA || l.href.startsWith(`${ROTA}?`));
      expect(daFila.length).toBeGreaterThanOrEqual(4);
      expect(daFila.filter((l) => !l.onClick).map((l) => `${l.texto} ${l.href}`), "link da fila sem clique na transição").toEqual([]);
      expect(daFila.filter((l) => l.onClick?.navegaPara !== l.href).map((l) => `${l.texto}: href ${l.href} · clique ${l.onClick?.navegaPara}`)).toEqual([]);
    }
  });

  it("cartão com role=\"button\" aciona com Espaço (como um <button>): impede a rolagem e clica no próprio link", () => {
    fila({ indicador: "emAtraso", busca: "ana" });
    const CARTOES = ["2 A vencer", "1 Em atraso", "0 Bloquear", "0 Promessas"];
    for (const texto of CARTOES) {
      const cartao = link(texto);
      expect(cartao.onKeyDown, `${texto}: sem onKeyDown`).toBeTypeOf("function");
      // O clique() do elemento dispara o onClick do próprio link — que navega para o href do cartão.
      const destinos: (string | undefined)[] = [];
      const preventDefault = vi.fn();
      cartao.onKeyDown!({ key: " ", preventDefault, currentTarget: { click: () => destinos.push(cartao.onClick?.navegaPara) } });
      expect(preventDefault, texto).toHaveBeenCalledTimes(1);
      expect(destinos, texto).toEqual([cartao.href]);
    }
  });

  it("outras teclas no cartão seguem o comportamento do link: nada de preventDefault nem clique extra (Enter já aciona o link)", () => {
    fila({});
    const cartao = link("2 A vencer");
    for (const key of ["Enter", "a", "Tab", "ArrowDown", "  "]) {
      const preventDefault = vi.fn();
      const click = vi.fn();
      cartao.onKeyDown!({ key, preventDefault, currentTarget: { click } });
      expect(preventDefault, key).not.toHaveBeenCalled();
      expect(click, key).not.toHaveBeenCalled();
    }
  });

  it("formulário GET de busca com os valores da URL; sem JavaScript, o indicador vai em campo oculto", () => {
    const html = fila({ indicador: "bloquear", busca: "ana", pais: "Brasil", turma: "Inglês A1" });
    expect(html).toMatch(/<form[^>]*action="\/financeiro\/cobrancas"[^>]*role="search"/);
    expect(html).toMatch(/<input name="busca"[^>]*value="ana"/);
    expect(html).toContain('<option value="Brasil" selected="">Brasil</option>');
    expect(html).toContain('<option value="Costa Rica">Costa Rica</option>');
    expect(html).toContain('<option value="Inglês A1" selected="">Inglês A1</option>');
    expect(html).toContain('<input type="hidden" name="indicador" value="bloquear"/>');
    expect(fila({ busca: "ana" })).not.toContain('name="indicador"');
  });

  it("buscar com JavaScript usa o mesmo leitor da página, deixa de fora os campos vazios e mantém o indicador", () => {
    fila({ indicador: "promessas" });
    const o = capturado.opcoes.at(-1)!;
    expect(o.campos).toEqual({ busca: "", pais: "", turma: "" });
    expect(o.hrefDosCampos({ busca: "  ana silva ", pais: "Brasil", turma: "" })).toBe(`${ROTA}?indicador=promessas&busca=ana+silva&pais=Brasil`);
    fila({});
    expect(capturado.opcoes.at(-1)!.hrefDosCampos({ busca: "", pais: "", turma: "" })).toBe(ROTA);
  });

  it("contador da visão sobre a fila inteira; visão vazia mantém o estado vazio e a saída pelos filtros", () => {
    expect(fila({ pais: "Brasil" })).toContain("1 de 5");
    const vazia = fila({ busca: "ninguem" }, []);
    expect(vazia).toContain("Nada nesta visão.");
    expect(vazia).toContain("0 de 5");
    expect(link("Limpar filtros").href).toBe(ROTA);
  });
});
