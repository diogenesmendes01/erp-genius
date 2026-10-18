import { describe, it, expect, beforeEach } from "vitest";
import { StatusVersaoAgenteIA } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";

beforeEach(async () => {
  await truncarBanco();
});

async function criarVersao(numero: number, status: StatusVersaoAgenteIA) {
  return prisma.versaoAgenteIA.create({
    data: { numero, status, config: {}, criadaPorId: "u1" },
  });
}

async function contarColunas(tabela: string, colunas: string[]): Promise<number> {
  const r = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM information_schema.columns
    WHERE table_name = ${tabela} AND column_name = ANY(${colunas})`;
  return Number(r[0].n);
}

describe("schema aria_base", () => {
  it("agente_singleton_nasce_desligado", async () => {
    expect(await prisma.agenteIA.create({ data: {} })).toMatchObject({ id: "aria", estado: "DESLIGADA" });
    await expect(prisma.agenteIA.create({ data: {} })).rejects.toThrow();
  });

  it("config_ia_nasce_com_padroes", async () => {
    await prisma.configIA.deleteMany();
    const c = await prisma.configIA.create({ data: {} });
    expect(c).toMatchObject({
      id: "ia",
      modeloConversa: "claude-sonnet-5-5",
      modeloClassificacao: "claude-haiku-5-5",
      acaoAoEstourar: "SO_SUGERIR",
      limiarTriagem: 80,
      triagemAtiva: false,
    });
    expect(c.orcamentoMensalUsd.toString()).toBe("100");
  });

  it("no_maximo_um_rascunho_e_uma_publicada", async () => {
    await criarVersao(1, "RASCUNHO");
    await expect(criarVersao(2, "RASCUNHO")).rejects.toThrow();
    await criarVersao(3, "PUBLICADA");
    await expect(criarVersao(4, "PUBLICADA")).rejects.toThrow();
    await criarVersao(5, "ARQUIVADA");
    await criarVersao(6, "ARQUIVADA");
  });

  it("copiloto_saiu_do_schema", async () => {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM information_schema.tables WHERE table_name = 'SugestaoIA'`;
    expect(Number(r[0].n)).toBe(0);
    expect(await contarColunas("ConfigComercial", ["copilotoAtivo", "copilotoQuietudeMinutos"])).toBe(0);
  });
});
