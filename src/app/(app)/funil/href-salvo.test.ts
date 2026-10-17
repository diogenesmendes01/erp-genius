import { describe, it, expect } from "vitest";
import { CHAVES_FILTRO } from "@/server/crm/filtros-salvos";
import { lerFiltrosFunil, type FiltrosFunil } from "@/server/crm/funil";
import { hrefSalvo } from "./href-salvo";

const lerDaUrl = (href: string) => lerFiltrosFunil(Object.fromEntries(new URL(href, "http://x").searchParams));

describe("visualização salva do funil", () => {
  it("CHAVES_FILTRO.FUNIL são exatamente as chaves de FiltrosFunil", () => {
    expect([...CHAVES_FILTRO.FUNIL].sort()).toEqual(Object.keys(lerFiltrosFunil({})).sort());
  });

  it("hrefSalvo e lerFiltrosFunil fazem a ida e volta de todos os filtros", () => {
    const f: FiltrosFunil = {
      busca: "ana", tipo: "b2b", donoId: "u1", temperatura: "QUENTE", origem: "SITE",
      tagId: "t1", perdidosDias: "90", ordem: "valor",
    };
    expect(lerDaUrl(hrefSalvo(f))).toEqual(f);
  });

  it("sem filtros volta ao funil padrão", () => {
    expect(hrefSalvo({})).toBe("/funil");
    expect(lerDaUrl(hrefSalvo({}))).toEqual(lerFiltrosFunil({}));
  });
});
