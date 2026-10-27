import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

describe("saída de /leads", () => {
  it("links antigos de /leads redirecionam de forma permanente para o CRM novo (C2 da R1 do #216)", async () => {
    const regras = await nextConfig.redirects!();
    const para = (source: string) => regras.find((r) => r.source === source);
    expect(para("/leads")).toMatchObject({ destination: "/funil", permanent: true });
    expect(para("/leads/:id")).toMatchObject({ destination: "/funil?o=:id", permanent: true });
    expect(para("/leads/:id/contratacao")).toMatchObject({ destination: "/oportunidades/:id/contratacao", permanent: true });
  });
});
