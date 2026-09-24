import { describe, expect, it } from "vitest";
import { criarBuscaMaisRecente } from "./busca-recente";

function adiada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((res) => { resolver = res; });
  return { promessa, resolver };
}

describe("criarBuscaMaisRecente", () => {
  it("resposta antiga que chega depois da mais nova é descartada", async () => {
    const busca = criarBuscaMaisRecente();
    const an = adiada<string[]>(), ana = adiada<string[]>();
    const pAn = busca.buscar(() => an.promessa);
    const pAna = busca.buscar(() => ana.promessa);
    ana.resolver(["Ana Silva"]);
    await expect(pAna).resolves.toEqual({ atual: true, valor: ["Ana Silva"] });
    an.resolver(["Ana Silva", "Antônio"]);
    await expect(pAn).resolves.toEqual({ atual: false });
  });

  it("respostas em ordem: só a última é atual", async () => {
    const busca = criarBuscaMaisRecente();
    const a = adiada<number>(), b = adiada<number>();
    const pa = busca.buscar(() => a.promessa), pb = busca.buscar(() => b.promessa);
    a.resolver(1);
    b.resolver(2);
    await expect(pa).resolves.toEqual({ atual: false });
    await expect(pb).resolves.toEqual({ atual: true, valor: 2 });
  });

  it("cancelar() (desmonte, campo curto) invalida a busca em voo", async () => {
    const busca = criarBuscaMaisRecente();
    const a = adiada<number>();
    const pa = busca.buscar(() => a.promessa);
    busca.cancelar();
    a.resolver(1);
    await expect(pa).resolves.toEqual({ atual: false });
  });

  it("depois de cancelar, uma busca nova volta a valer", async () => {
    const busca = criarBuscaMaisRecente();
    busca.cancelar();
    await expect(busca.buscar(async () => "ok")).resolves.toEqual({ atual: true, valor: "ok" });
  });
});
