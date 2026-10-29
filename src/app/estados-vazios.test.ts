import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";

describe("EstadoVazio — componente (HTML exato; os invariantes de design estão em src/components/EstadoVazio.test.ts)", () => {
  it("compacto por padrão; bloco tracejado e centralizado para a lista principal", () => {
    const compacto = renderToStaticMarkup(EstadoVazio({ children: "Nenhuma turma." }));
    expect(compacto).toBe('<div data-estado-vazio="" class="rounded-item bg-surface-muted px-3 py-3 text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
    const bloco = renderToStaticMarkup(EstadoVazio({ bloco: true, children: "Nenhuma turma." }));
    expect(bloco).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-200 bg-surface-muted px-6 py-8 text-center text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
  });

  it("a ação (próximo passo) vem depois da mensagem; margem de posição e role são repassados", () => {
    const html = renderToStaticMarkup(EstadoVazio({ bloco: true, className: "mt-4", role: "status", "aria-busy": true, acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }));
    expect(html).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-200 bg-surface-muted px-6 py-8 text-center text-sm text-gray-500 mt-4" role="status" aria-busy="true"><p>Nada.</p><div class="mt-3 flex flex-wrap justify-center gap-2"><a href="/novo">Criar</a></div></div>');
    expect(renderToStaticMarkup(EstadoVazio({ acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }))).toContain('<p>Nada.</p><div class="mt-2 flex flex-wrap gap-2"><a href="/novo">Criar</a></div>');
  });

  it("na tabela: uma linha que ocupa todas as colunas; role/aria-busy dentro da célula", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 5, children: "Nenhum aluno." }))));
    expect(html).toBe('<table><tbody><tr><td colSpan="5" data-estado-vazio="" class="px-4 py-8 text-center text-sm text-gray-500"><div><p>Nenhum aluno.</p></div></td></tr></tbody></table>');
    const comFiltro = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 2, role: "status", "aria-busy": true, children: "Nada." }))));
    expect(comFiltro).toContain('<tr><td colSpan="2" data-estado-vazio="" class="px-4 py-8 text-center text-sm text-gray-500"><div role="status" aria-busy="true"><p>Nada.</p></div></td></tr>');
  });
});
