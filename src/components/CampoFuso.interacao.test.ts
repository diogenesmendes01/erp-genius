import { describe, expect, it, vi } from "vitest";

// O CampoFuso chamado como função (sem DOM): o useId vira constante, e o onChange do <input> recebe um evento
// mínimo com `setCustomValidity` — é o que o navegador usa para barrar o envio com a mensagem do campo.
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useId: (() => ":id:") as unknown as typeof real.useId };
});

import type { ReactNode } from "react";
import { CampoFuso } from "./CampoFuso";
import { MSG_FUSO_NAO_RECONHECIDO } from "@/server/operacao/fuso";
import { elementos, type No } from "@/test/tela-sem-dom";

const input = (arvore: ReactNode): No => elementos(arvore).find((n) => n.type === "input")!;
const digitar = (arvore: ReactNode, valor: string) => {
  const validade: string[] = [];
  (input(arvore).props.onChange as (e: { currentTarget: { value: string; setCustomValidity: (m: string) => void } }) => void)({ currentTarget: { value: valor, setCustomValidity: (m) => validade.push(m) } });
  return validade;
};

describe("CampoFuso — validação no campo e acompanhamento do valor", () => {
  it("fuso não reconhecido marca o campo inválido com a mensagem; fuso válido limpa", () => {
    const arvore = CampoFuso({ padrao: "", className: "c" });
    expect(digitar(arvore, "America/Sao Paulo")).toEqual([MSG_FUSO_NAO_RECONHECIDO]);
    expect(digitar(arvore, "America/Sao_Paulo")).toEqual([""]);
    expect(digitar(arvore, "")).toEqual([""]);
  });

  it("não controlado: defaultValue com o padrão, e onChange (opcional) acompanha o texto para a prévia", () => {
    const visto: string[] = [];
    const arvore = CampoFuso({ padrao: "America/Costa_Rica", onChange: (v) => visto.push(v), className: "c" });
    expect(input(arvore).props.defaultValue).toBe("America/Costa_Rica");
    expect(input(arvore).props.value).toBeUndefined();
    digitar(arvore, "America/Manaus");
    expect(visto).toEqual(["America/Manaus"]);
  });

  it("controlado: value com o valor e onChange com o texto; o name padrão é fuso e pode ser trocado", () => {
    const visto: string[] = [];
    const arvore = CampoFuso({ valor: "UTC", onChange: (v) => visto.push(v), name: "fusoOrigem", className: "c" });
    expect(input(arvore).props.value).toBe("UTC");
    expect(input(arvore).props.defaultValue).toBeUndefined();
    expect(input(arvore).props.name).toBe("fusoOrigem");
    digitar(arvore, "America/Sao_Paulo");
    expect(visto).toEqual(["America/Sao_Paulo"]);
    expect(input(CampoFuso({ padrao: "", className: "c" })).props.name).toBe("fuso");
  });
});
