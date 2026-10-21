import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ checkinExperimental: vi.fn() }));

import { HomeProfessor } from "./HomeProfessor";

const passada = { id: "passada", nome: "Ana", data: "2026-10-01T01:30:00.000Z" };
const futura = { id: "futura", nome: "Bia", data: "2026-10-01T02:30:00.000Z" };

describe("HomeProfessor", () => {
  it("exibe a próxima escolhida no servidor no fuso preferido e mantém o check-in passado", () => {
    const html = renderToStaticMarkup(createElement(HomeProfessor, {
      nome: "Professor Um", turmas: [], experimentais: [passada, futura], proximaExperimental: futura,
      preferenciaFusoExibicao: "America/Costa_Rica",
    }));

    expect(html).toContain("Próxima aula experimental");
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("Bia");
    expect(html).toContain("Ana");
    expect(html).toContain("Compareceu");
    expect(html).toContain("America/Costa_Rica; origem UTC");
  });

  it("não renderiza card de próxima quando o servidor só devolve check-ins passados", () => {
    const html = renderToStaticMarkup(createElement(HomeProfessor, {
      nome: "Professor Um", turmas: [], experimentais: [passada], proximaExperimental: null,
      preferenciaFusoExibicao: null,
    }));

    expect(html).not.toContain("Próxima aula experimental");
    expect(html).toContain("Ana");
    expect(html).toMatch(/01\/10\/2026.*01:30/);
    expect(html).toContain("UTC; origem UTC");
  });
});
