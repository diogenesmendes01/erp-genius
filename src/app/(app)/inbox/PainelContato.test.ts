import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ABAS_ENTREGUES, AbasPainel, PainelContato, abasDoPainel } from "./PainelContato";
const contato = { id: "c1", nome: "Mariana Costa", subtitulo: "Comercial · Central da escola", tags: [{ id: "ingles", rotulo: "Inglês", ia: false }, { id: "noite", rotulo: "Noite", ia: true }] };
const p = (extra: object = {}) => renderToStaticMarkup(createElement(PainelContato, { visivel: true, sobreposto: false, className: "flex", aoFechar() {}, contato, children: "conteudo", ...extra } as never));
it("cabeçalho enriquecido tem avatar132, identidade, tags só leitura e marca sem autor", () => {
  const h = p(); for (const texto of ["h-[132px]", ">MC<", "Mariana Costa", "text-xl", "font-medium", "Comercial · Central da escola", "h-[26px]", "rounded-[13px]", "Inglês", 'aria-label="Criada pela Aria"']) expect(h).toContain(texto);
  expect(h.match(/aria-label="Criada pela Aria"/g)).toHaveLength(1);
  expect(h).not.toContain("Editar contato"); expect(h).not.toContain("+ tag");
});
it("E1 publica apenas Detalhes em qualquer finalidade e liga tab ao painel", () => {
  expect(ABAS_ENTREGUES).toEqual(["detalhes"]);
  for (const f of ["COMERCIAL", "PEDAGOGICO", "FINANCEIRO", "SECRETARIA", "desconhecida"]) expect(abasDoPainel(f)).toEqual([{ id: "detalhes", rotulo: "Detalhes" }]);
  const h = p(); expect(h).toContain('role="tablist"'); expect(h).toContain('aria-selected="true"'); expect(h).toContain('role="tabpanel"');
  expect(h.match(/role="tab"/g)).toHaveLength(1); for (const nome of ["Oportunidades", "Insights", "Atividade"]) expect(h).not.toContain(nome);
});
it("mantém um único fechar e um scroller local também no cabeçalho extenso", () => {
  const h = p({ contato: { ...contato, nome: "Nome extenso ".repeat(15), tags: Array.from({ length: 20 }, (_, i) => ({ id: "tag" + i, rotulo: "Tag extensa " + i, ia: false })) } });
  expect(h.match(/aria-label="Fechar painel do contato"/g)).toHaveLength(1);
  expect(h.match(/overflow-y-auto/g)).toHaveLength(1); expect(h).not.toContain("1100"); expect(h).toContain('data-cabecalho-contato');
});
it("contagem de uma aba isolada usa mono e tomIA; aba ativa inválida cai na primeira", () => {
  const h = renderToStaticMarkup(createElement(AbasPainel, { abas: [{ id: "atividade", rotulo: "Atividade", contagem: 5 }], abaAtiva: "detalhes", aoTrocarAba() {} }));
  for (const t of ["font-mono", "tabular-nums", "bg-ai-50", "text-ai-700", 'aria-selected="true"', ">5<"]) expect(h).toContain(t);
  expect(h).toMatch(/<span class="(?=[^"]*font-mono)(?=[^"]*tabular-nums)[^"]*">5<\/span>/);
});
it("mantém fallback308 e escapa textos de contato/tag", () => {
  expect(p({ contato: undefined })).toContain(">Painel do contato<");
  const h = p({ contato: { ...contato, nome: "<script>x</script>", tags: [{ id: "escape", rotulo: "<img onerror=x>", ia: false }] } });
  expect(h).toContain("&lt;script&gt;"); expect(h).toContain("&lt;img onerror=x&gt;"); expect(h).not.toContain("<script>");
});


it("cabeçalho usa BotaoIcone36 real, um controle com nomes responsivos sem posição conflitante", () => {
  const h = p();
  const botao = h.match(/<button[^>]*aria-label="Fechar painel do contato"[^>]*>/)?.[0] ?? "";
  expect(botao).toContain("h-[36px] w-[36px]"); expect(botao).toContain("aria-labelledby="); expect(botao).not.toContain("absolute");
  expect(h).toContain("Voltar para a conversa"); expect(h).toContain("Fechar painel");
  expect(h).toContain("absolute left-2.5 top-2.5");
});

it("slots324 substituem somente tags/aviso e undefined conserva fallback de leitura", () => {
  const custom = p({ slotTags: createElement("p", null, "Editor de tags"), slotAviso: createElement("p", null, "Aviso sem nome") });
  expect(custom).toContain("Editor de tags"); expect(custom).toContain("Aviso sem nome"); expect(custom).not.toContain("Inglês");
  expect(custom.indexOf("Aviso sem nome")).toBeLessThan(custom.indexOf('role="tablist"'));
  expect(p({ slotTags: null })).not.toContain("Inglês"); expect(p()).toContain("Inglês");
  expect(custom.match(/aria-label="Fechar painel do contato"/g)).toHaveLength(1);
});
