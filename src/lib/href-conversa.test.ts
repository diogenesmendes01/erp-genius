import { describe, expect, it } from "vitest";
import { hrefConversa } from "./href-conversa";

describe("hrefConversa335", () => {
  it("monta URL relativa com o id bruto codificado e não interpreta a opção de agendar", () => {
    expect(hrefConversa("a 1")).toBe("/inbox?c=a%201");
    expect(hrefConversa("a1", { agendar: true })).toBe("/inbox?c=a1&agendar=1");
    expect(hrefConversa("a1", { agendar: false })).toBe("/inbox?c=a1");
  });
  it.each(["ação/1", "a?c=outro&agendar=1#fim", "//externo.example.test/a", " a "])("o id %s não muda origem, caminho ou parâmetros", id => {
    const caminho = hrefConversa(id), url = new URL(caminho, "https://erp.example.test");
    expect(url.origin).toBe("https://erp.example.test"); expect(url.pathname).toBe("/inbox");
    expect([...url.searchParams]).toEqual([["c", id]]); expect(url.hash).toBe("");
  });
});
