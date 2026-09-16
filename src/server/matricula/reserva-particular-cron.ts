import { prisma } from "@/lib/prisma";
import { conferirVencimentoParticularTx } from "./reserva-particular-vencimento-tx";
import { proximaReservaParticularVencida } from "./reserva-particular-cursor";

/** Um lote por chamada autenticada; cada reserva é revalidada na própria transação.
 * Falha individual mantém a reserva ocupante e não interrompe as demais. */
export async function rodarVencimentoParticulares() {
  const inicio = performance.now();
  const resultado = { avaliadas: 0, expiradas: 0, mantidas: 0, semTransicao: 0, falhas: 0, loteCheio: false, limiteTempo: false };
  while (resultado.avaliadas < 50) {
    if (performance.now() - inicio >= 15000) { resultado.limiteTempo = true; break; }
    const reserva = await proximaReservaParticularVencida();
    if (!reserva) break;
    resultado.avaliadas++;
    try {
      const r = await prisma.$transaction((tx) => conferirVencimentoParticularTx(tx, reserva.id), { timeout: 5000, maxWait: 1000 });
      if (r.resultado === "HORARIOS_LIBERADOS") resultado.expiradas++;
      else if (r.resultado === "PENDENCIA_REGISTRADA") resultado.mantidas++;
      else resultado.semTransicao++;
    } catch {
      resultado.falhas++;
      console.error("[reservas particulares] Falha ao conferir reserva", reserva.id);
    }
  }
  resultado.loteCheio = resultado.avaliadas === 50;
  return resultado;
}
