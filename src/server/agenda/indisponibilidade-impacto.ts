import { createHash } from "node:crypto";
import { z } from "zod";
const Intervalo = z.object({ id: z.string(), inicio: z.union([z.date(), z.string().datetime()]), fim: z.union([z.date(), z.string().datetime()]) });
/** Canonicaliza os mesmos intervalos na consulta, aprovação e repetição. */
export function hashImpactoAusencia(ausencia: { id: string; professorId: string; inicio: Date; fim: Date }, encontros: unknown, reservas: unknown) {
  const converter = (e: { id: string; inicio: Date | string; fim: Date | string }) => ({ id: e.id, inicio: new Date(e.inicio).toISOString(), fim: new Date(e.fim).toISOString() });
  const aulas = z.array(Intervalo).parse(encontros).map(converter).sort((a, b) => a.id.localeCompare(b.id));
  const horarios = z.array(Intervalo.extend({ reservaId: z.string() })).parse(reservas).map((r) => ({ ...converter(r), reservaId: r.reservaId })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify({ ausenciaId: ausencia.id, professorId: ausencia.professorId, inicio: ausencia.inicio.toISOString(), fim: ausencia.fim.toISOString(), aulas, horarios })).digest("hex");
}
