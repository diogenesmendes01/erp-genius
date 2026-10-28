import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilaCobrancaItem } from "@/server/cobrancas/consultas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/dialog", async (importOriginal) => {
  const React = await import("react");
  const real = await importOriginal<typeof import("@/components/ui/dialog")>();
  return { ...real, DialogPortal: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children) };
});
vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  return {
    Popover: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverAnchor: ({ children }: { children?: React.ReactNode }) => children ?? null,
    PopoverContent: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  };
});
vi.mock("@/server/financeiro/acoes", () => ({ registrarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/financeiro/cobranca-manual", () => ({ prepararCobrancaManual: vi.fn() }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes", () => ({ aprovarLoteCobranca: vi.fn(), enfileirarCobrancaWhatsApp: vi.fn() }));
vi.mock("./AcessoAulasPainel", () => ({ AcessoAulasPainel: ({ matriculaId, alunoId, preferenciaFusoExibicao }: { matriculaId?: string; alunoId?: string; preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-acesso": `${matriculaId ?? alunoId ?? "geral"}:${preferenciaFusoExibicao ?? "UTC"}` }) }));

const capturado = vi.hoisted(() => ({ opcoes: [] as { campos: Record<string, string>; hrefDosCampos: (c: Record<string, string>) => string }[] }));
vi.mock("@/lib/filtros-url", async (original) => {
  const real = await original<typeof import("@/lib/filtros-url")>();
  return { ...real, useFiltrosUrl: (o: Parameters<typeof real.useFiltrosUrl>[0]) => {
    capturado.opcoes.push(o as never);
    const r = real.useFiltrosUrl(o);
    return { ...r, aoClicar: (href: string) => Object.assign(r.aoClicar(href), { navegaPara: href }) };
  } };
});
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
    fusoEscola: "America/Sao_Paulo",
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
    expect(html).toContain(" 01/2026");
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
      podeOperar: true, podeBloquear: false, fusoEscola: "America/Sao_Paulo", preferenciaFusoExibicao: "America/Costa_Rica",
    }));
    expect(geral).toContain('data-acesso="geral:America/Costa_Rica"');
    const detalheOperavel = renderToStaticMarkup(createElement(DetalheCobranca, {
      item, regua: [], podeOperar: true, preferenciaFusoExibicao: "America/Costa_Rica", fusoEscola: "America/Sao_Paulo",
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
    dashs, regua: [], podeOperar, podeBloquear: false, fusoEscola: "America/Sao_Paulo",
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
    expect(html).toMatch(/role="checkbox"/);
    const nome = html.match(/<button type="button" class="block w-full[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(nome).toContain("Ana Silva");
    expect(nome).not.toMatch(/role="checkbox"/);
  });

  it("o detalhe é um diálogo modal rotulado pelo título, com ✕ nomeado", () => {
    const html = detalhe(item, null);
    expect(html).toMatch(/role="dialog"/);
    expect(html).toContain('tabindex="-1"');
    expect(html).toMatch(/<h2 id="[^"]+"[^>]*>Detalhe da cobrança<\/h2>/);
    expect(html).toContain('aria-label="Fechar"');
  });

  it("o detalhe é camada elevada do DS: véu bg-black/60, superfície elevada e shadow-dialog", () => {
    const html = detalhe(item, null);
    expect(html).toContain("bg-black/60");
    expect(html).toMatch(/role="dialog"/);
    expect(html).toContain("bg-surface-raised");
    expect(html).toContain("shadow-dialog");
    expect(html).toContain('class="shrink-0 whitespace-nowrap text-2xl font-medium text-gray-800"');
  });

  it("a linha quebra no celular (flex-wrap) e os chips de estado são pílulas", () => {
    const html = fila(true);
    expect(html).toContain("flex flex-wrap items-center justify-between");
    expect(html).not.toMatch(/<span class="rounded-md px-2 py-0\.5 text-\[11px\]/);
  });
});

describe("FilaCobranca — filtros na URL (E4)", () => {
  const ROTA = "/financeiro/cobrancas";
  const dashs = { aVencer: 2, emAtraso: 1, bloquear: 0, promessas: 0, recebidoHoje: [] };
  const costaRica: FilaCobrancaItem = { ...item, id: "cr", pais: "Costa Rica", turma: "Inglês A1" };
  const fila = (params: Record<string, string>, itens: FilaCobrancaItem[] = [item]) => {
    links.lista = [];
    const filtros = lerFiltrosFila(params);
    return renderToStaticMarkup(createElement(FilaCobranca, {
      itens, totalFila: 5, filtros, opcoes: opcoesDaFila([item, costaRica], filtros),
      dashs, regua: [], podeOperar: true, podeBloquear: false, fusoEscola: "America/Sao_Paulo",
    }));
  };
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
    expect(html).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*limpar filtro/);
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
    expect(html).toContain('type="hidden" name="pais" value="Brasil"');
    expect(html).toContain("Brasil");
    expect(html).toContain("Costa Rica");
    expect(html).toContain('type="hidden" name="turma" value="Inglês A1"');
    expect(html).toContain("Inglês A1");
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

describe("FilaCobranca — trechos por cursor nos dois sentidos (docs/43 §6 item 9)", () => {
  const ROTA = "/financeiro/cobrancas";
  const dashs = { aVencer: 0, emAtraso: 60, bloquear: 0, promessas: 0, recebidoHoje: [] };
  type Props = Parameters<typeof FilaCobranca>[0];
  const fila = (o: Partial<Props> = {}) => {
    links.lista = [];
    const filtros = lerFiltrosFila({ indicador: "emAtraso", pais: "Brasil" });
    return renderToStaticMarkup(createElement(FilaCobranca, {
      itens: [item], totalFila: 120, totalVisao: 60, filtros, opcoes: opcoesDaFila([item], filtros),
      dashs, regua: [], podeOperar: true, podeBloquear: false, fusoEscola: "America/Sao_Paulo", ...o,
    }));
  };
  const link = (texto: string) => {
    const achados = links.lista.filter((l) => l.texto === texto);
    expect(achados, texto).toHaveLength(1);
    return achados[0];
  };

  it("no meio: Anterior e Próxima com a chave de ordem do cursor, mantendo indicador e país; sem número de página", () => {
    const html = fila({ navegacao: { anterior: "1_9_cobranca", proxima: "1_3_outra" } });
    expect(html).toContain('aria-label="Navegação da fila de cobrança"');
    expect(link("← Anterior").href).toBe(`${ROTA}?indicador=emAtraso&pais=Brasil&antes=1_9_cobranca`);
    expect(link("Próxima →").href).toBe(`${ROTA}?indicador=emAtraso&pais=Brasil&depois=1_3_outra`);
    expect(links.lista.filter((l) => /[?&]pagina=/.test(l.href))).toEqual([]);
    expect(html).not.toContain("Página ");
  });

  it("início sem Anterior; fim sem Próxima; um trecho só, sem navegação", () => {
    fila({ navegacao: { anterior: null, proxima: "1_3_outra" } });
    expect(links.lista.filter((l) => l.texto === "← Anterior")).toEqual([]);
    expect(link("Próxima →").href).toContain("depois=1_3_outra");
    fila({ navegacao: { anterior: "1_9_cobranca", proxima: null } });
    expect(links.lista.filter((l) => l.texto === "Próxima →")).toEqual([]);
    expect(fila()).not.toContain("Navegação da fila de cobrança");
  });

  it("o contador é da visão inteira (todos os trechos), não do trecho exibido", () => {
    expect(fila()).toContain("60 de 120");
  });

  it("trecho vazio depois de um cursor: diz que daqui em diante não há cobrança e volta ao início com o recorte", () => {
    const html = fila({ itens: [], totalVisao: 0, inicioDaFila: `${ROTA}?indicador=emAtraso&pais=Brasil` });
    expect(html).toContain("Nenhuma cobrança a partir deste ponto da fila");
    expect(html).not.toContain("Nada nesta visão.");
    expect(html).not.toContain("nesta página");
    const inicio = link("Ir para o início da fila");
    expect(inicio.href).toBe(`${ROTA}?indicador=emAtraso&pais=Brasil`);
    expect(inicio.onClick?.navegaPara).toBe(inicio.href);
  });

  it("visão vazia no início da fila: o estado vazio de sempre, sem volta ao início", () => {
    const html = fila({ itens: [], totalVisao: 0 });
    expect(html).toContain("Nada nesta visão.");
    expect(links.lista.filter((l) => l.texto === "Ir para o início da fila")).toEqual([]);
  });
});

describe("promessa de pagamento: dia civil da escola", () => {
  const prometida = (promessaAte: string) => ({ ...item, estado: "promessa" as const, promessaAte });
  it("meio-dia da escola e meia-noite UTC (legado) dão o mesmo dia, para qualquer preferência", () => {
    for (const promessaAte of ["2026-10-05T15:00:00.000Z", "2026-10-05T00:00:00.000Z"]) {
      for (const preferencia of ["Asia/Tokyo", "America/Costa_Rica", null]) {
        expect(detalhe(prometida(promessaAte), preferencia)).toContain("Promessa de pagamento até 05/10/2026");
      }
    }
  });
  it("o rótulo curto da fila usa o mesmo dia", () => {
    const html = renderToStaticMarkup(createElement(FilaCobranca, {
      itens: [prometida("2026-10-05T00:00:00.000Z")], totalFila: 1, filtros: lerFiltrosFila({}), opcoes: { paises: [], turmas: [] },
      dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 1, recebidoHoje: [] }, regua: [],
      podeOperar: false, podeBloquear: false, fusoEscola: "America/Sao_Paulo",
    }));
    expect(html).toContain("promessa · paga 05/10/2026");
  });
});
