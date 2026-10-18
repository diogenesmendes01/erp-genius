import type { AcaoOrcamentoIA, ChamadaIA, OrigemChamadaIA, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { custoMicroUsd } from "./provedor/custo";
import type { RespostaIA } from "./provedor/tipos";

type FalhaIA = { erro: string; modelo: string; latenciaMs: number };

export async function registrarChamadaIA(
  origem: OrigemChamadaIA,
  r: RespostaIA | FalhaIA,
  tx?: Prisma.TransactionClient,
): Promise<ChamadaIA> {
  const db = tx ?? prisma;
  if ("erro" in r) {
    return db.chamadaIA.create({
      data: {
        origem,
        modelo: r.modelo,
        provedor: r.modelo === "simulado" ? "simulado" : "anthropic",
        tokensEntrada: 0,
        tokensSaida: 0,
        tokensCache: 0,
        custoMicroUsd: 0,
        latenciaMs: r.latenciaMs,
        resultado: `ERRO:${r.erro}`,
      },
    });
  }
  return db.chamadaIA.create({
    data: {
      origem,
      modelo: r.modelo,
      provedor: r.provedor,
      tokensEntrada: r.tokensEntrada,
      tokensSaida: r.tokensSaida,
      tokensCache: r.tokensCache,
      custoMicroUsd: custoMicroUsd(r.modelo, {
        entrada: r.tokensEntrada,
        cache: r.tokensCache,
        saida: r.tokensSaida,
      }),
      latenciaMs: r.latenciaMs,
      resultado: r.recusa ? "RECUSA" : "OK",
    },
  });
}

export async function estadoOrcamento(agora: Date = new Date()): Promise<{
  situacao: "OK" | "ALERTA" | "ESTOURADO";
  gastoUsd: number;
  limiteUsd: number;
  acao: AcaoOrcamentoIA;
}> {
  const config = await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const soma = await prisma.chamadaIA.aggregate({
    _sum: { custoMicroUsd: true },
    where: { criadoEm: { gte: inicioMes, lte: agora } },
  });
  const gastoUsd = (soma._sum.custoMicroUsd ?? 0) / 1_000_000;
  const limiteUsd = Number(config.orcamentoMensalUsd);
  const situacao = gastoUsd >= limiteUsd ? "ESTOURADO" : gastoUsd >= limiteUsd * 0.8 ? "ALERTA" : "OK";
  return { situacao, gastoUsd, limiteUsd, acao: config.acaoAoEstourar };
}
