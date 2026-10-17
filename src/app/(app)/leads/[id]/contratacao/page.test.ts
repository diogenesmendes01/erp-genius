import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
import Page from "./page";

describe("/leads/[id]/contratacao (redirecionamento até a Tarefa 37)", () => {
  beforeEach(() => redirect.mockReset());
  it("leva para a rota da oportunidade", async () => {
    await Page({ params: Promise.resolve({ id: "op1" }) });
    expect(redirect).toHaveBeenCalledWith("/oportunidades/op1/contratacao");
  });
});
