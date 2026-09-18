import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
export function conferirPedidoReplayAcertoDesistencia(
  anterior: { pedidoId: string; condicoesId: string; memoria: unknown },
  esperado: { pedidoId: string; condicoesId: string; motivo: string },
) {
  const memoria = z.object({ motivo: z.string() }).passthrough().parse(anterior.memoria);
  if (anterior.pedidoId !== esperado.pedidoId || anterior.condicoesId !== esperado.condicoesId || memoria.motivo !== esperado.motivo) {
    throw new ErroRegra("Chave já utilizada com outro acerto de desistência.");
  }
}
export function conferirReplayAcertoDesistencia(anterior: { pedidoId: string; condicoesId: string; fotografiaHash: string; estadoHash: string; condicoesHash: string; memoria: unknown }, esperado: { pedidoId: string; condicoesId: string; fotografiaHash: string; estadoHash: string; condicoesHash: string; motivo: string }) { const memoria = z.object({ motivo: z.string() }).passthrough().parse(anterior.memoria); if (anterior.pedidoId !== esperado.pedidoId || anterior.condicoesId !== esperado.condicoesId || anterior.fotografiaHash !== esperado.fotografiaHash || anterior.estadoHash !== esperado.estadoHash || anterior.condicoesHash !== esperado.condicoesHash || memoria.motivo !== esperado.motivo) throw new ErroRegra("Chave já utilizada com outro acerto de desistência."); }


