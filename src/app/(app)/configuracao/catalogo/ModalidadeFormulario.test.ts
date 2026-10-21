import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/catalogo/acoes", () => ({ criarModalidade: vi.fn(), editarModalidade: vi.fn() }));

import { ModalidadeFormulario } from "./ModalidadeFormulario";

// As opções do segmento vêm do mapa central (SEGMENTO_LABEL), na ordem do enum — R1 da #150, B5.
it("opções do segmento: rótulo do mapa central e ordem do enum (Adulto, Kids, Teens, Empresa)", () => {
  const html = renderToStaticMarkup(createElement(ModalidadeFormulario, { onClose: () => {} }));
  const select = /<select[^>]*id="modalidade-segmento"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? "";
  const opcoes = [...select.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
  expect(opcoes).toEqual([["ADULTO", "Adulto"], ["KIDS", "Kids"], ["TEENS", "Teens"], ["EMPRESA", "Empresa"]]);
});
