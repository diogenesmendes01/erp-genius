import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/catalogo/acoes", () => ({ criarModalidade: vi.fn(), editarModalidade: vi.fn() }));
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  return {
    CampoSelect: ({ id, opcoes }: { id?: string; opcoes?: { valor: string; rotulo: React.ReactNode }[] }) =>
      React.createElement("div", { id }, ...(opcoes ?? []).map((opcao) => React.createElement("span", { key: opcao.valor }, opcao.rotulo))),
  };
});

import { ModalidadeFormulario } from "./ModalidadeFormulario";

it("opções do segmento: rótulo do mapa central e ordem do enum (Adulto, Kids, Teens, Empresa)", () => {
  const html = renderToStaticMarkup(createElement(ModalidadeFormulario, { onClose: () => {} }));
  expect(html).toContain('id="modalidade-segmento"');
  const rotulos = ["Adulto", "Kids", "Teens", "Empresa"];
  const posicoes = rotulos.map((rotulo) => html.indexOf(`>${rotulo}<`));
  expect(posicoes.every((posicao) => posicao >= 0)).toBe(true);
  expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
});
