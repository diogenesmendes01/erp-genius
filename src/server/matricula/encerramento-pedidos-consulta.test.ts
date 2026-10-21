import { describe, expect, it } from "vitest";
import { paginaPedidosEncerramento } from "./encerramento-pedidos-consulta";

describe("paginaPedidosEncerramento", () => {
  it("aceita somente páginas positivas limitadas", () => {
    expect(paginaPedidosEncerramento("2")).toBe(2);
    expect(paginaPedidosEncerramento("10")).toBe(10);
    expect(paginaPedidosEncerramento("0")).toBe(1);
    expect(paginaPedidosEncerramento(["2", "3"])).toBe(1);
    expect(paginaPedidosEncerramento("100001")).toBe(1);
  });
});
