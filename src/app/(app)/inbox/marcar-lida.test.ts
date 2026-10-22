import { expect, it, vi } from "vitest";
import { criarMarcadorDeLeitura } from "./marcar-lida";

it("leituras de atendimentos diferentes seguem em paralelo", async () => {
  const resolver: (() => void)[] = [];
  const marcar = vi.fn(() => new Promise<void>((ok) => resolver.push(ok)));
  const pedir = criarMarcadorDeLeitura(marcar);
  pedir("a1"); pedir("a2"); pedir("a1");
  expect(marcar.mock.calls.map(([id]) => id)).toEqual(["a1", "a2"]);
  resolver[0]();
  await vi.waitFor(() => expect(marcar.mock.calls.map(([id]) => id)).toEqual(["a1", "a2", "a1"]));
  resolver[1](); resolver[2]();
});

it("falha de rede não impede a repetição pedida durante a tentativa", async () => {
  const marcar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue({ ok: true });
  const pedir = criarMarcadorDeLeitura(marcar);
  pedir("a1"); pedir("a1");
  await vi.waitFor(() => expect(marcar).toHaveBeenCalledTimes(2));
  expect(marcar.mock.calls.map(([id]) => id)).toEqual(["a1", "a1"]);
});
