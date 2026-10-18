import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import type { RespostaIA } from "./provedor/tipos";
import { registrarChamadaIA, estadoOrcamento } from "./uso";

const agora = new Date("2026-11-15T12:00:00Z");

const resp: RespostaIA = {
  texto: "oi",
  modelo: "claude-sonnet-5-5",
  provedor: "anthropic",
  recusa: false,
  tokensEntrada: 1000,
  tokensSaida: 500,
  tokensCache: 10000,
  tokensEscritaCache: 0,
  latenciaMs: 20,
};

async function gasto(micro: number, quando: string) {
  const data = quando.length === 10 ? `${quando}T12:00:00Z` : quando;
  await prisma.chamadaIA.create({
    data: {
      origem: "ATENDIMENTO",
      modelo: "claude-sonnet-5-5",
      provedor: "anthropic",
      tokensEntrada: 0,
      tokensSaida: 0,
      tokensCache: 0,
      custoMicroUsd: micro,
      latenciaMs: 1,
      resultado: "OK",
      criadoEm: new Date(data),
    },
  });
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configIA.deleteMany();
  await prisma.configIA.create({ data: { orcamentoMensalUsd: 10, acaoAoEstourar: "PAUSAR" } });
});

describe("estadoOrcamento", () => {
  it("ok_abaixo_de_80", async () => {
    await gasto(7_000_000, "2026-11-02");
    expect(await estadoOrcamento(agora)).toMatchObject({ situacao: "OK", gastoUsd: 7, limiteUsd: 10 });
  });
  it("alerta_em_80", async () => {
    await gasto(8_000_000, "2026-11-02");
    expect((await estadoOrcamento(agora)).situacao).toBe("ALERTA");
  });
  it("estourado_com_acao", async () => {
    await gasto(10_000_000, "2026-11-02");
    expect(await estadoOrcamento(agora)).toMatchObject({ situacao: "ESTOURADO", acao: "PAUSAR" });
  });
  it("so_mes_corrente_utc", async () => {
    await gasto(50_000_000, "2026-10-31T23:59:00Z");
    expect((await estadoOrcamento(agora)).situacao).toBe("OK");
  });
  it("cria_config_padrao_se_faltar", async () => {
    await prisma.configIA.deleteMany();
    expect(await estadoOrcamento(agora)).toMatchObject({
      situacao: "OK",
      gastoUsd: 0,
      limiteUsd: 100,
      acao: "SO_SUGERIR",
    });
    expect(await prisma.configIA.count()).toBe(1);
  });
});

describe("registrarChamadaIA", () => {
  it("registra_ok_com_custo", async () => {
    const c = await registrarChamadaIA("ATENDIMENTO", resp);
    expect(c).toMatchObject({ resultado: "OK", custoMicroUsd: 9000, provedor: "anthropic" });
  });
  it("registra_custo_com_escrita_de_cache", async () => {
    const c = await registrarChamadaIA("ATENDIMENTO", { ...resp, tokensEscritaCache: 2000 });
    expect(c.custoMicroUsd).toBe(14000);
  });
  it("registra_recusa_e_erro", async () => {
    expect((await registrarChamadaIA("ATENDIMENTO", { ...resp, recusa: true })).resultado).toBe("RECUSA");
    expect(
      (await registrarChamadaIA("ATENDIMENTO", { erro: "429", modelo: "claude-sonnet-5-5", latenciaMs: 5 }))
        .resultado,
    ).toBe("ERRO:429");
  });
  it("usa_a_transacao_recebida", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await registrarChamadaIA("TRIAGEM", resp, tx);
        throw new Error("desfaz");
      }),
    ).rejects.toThrow("desfaz");
    expect(await prisma.chamadaIA.count()).toBe(0);
  });
});
