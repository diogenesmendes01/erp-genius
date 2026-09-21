import { createHash } from "node:crypto";
import type { carregarReplanejamentoTx } from "./replanejamento-tx";
export function estadoReplanejamento(revisao: Awaited<ReturnType<typeof carregarReplanejamentoTx>>) {
 const { conferidoEm, ...estado } = revisao;
 void conferidoEm;
 return createHash("sha256").update(JSON.stringify(estado)).digest("hex");
}
