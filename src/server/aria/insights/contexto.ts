import { createHash } from "node:crypto";
import type { DirecaoMensagem, StatusMensagem } from "@prisma/client";

export interface MensagemParaInsight {
  id: string;
  criadoEm: Date;
  editadaEm: Date | null;
  apagadaEm: Date | null;
  direcao: DirecaoMensagem;
  status: StatusMensagem;
  corpo: string | null;
}
export interface ContextoInsight {
  mensagens: { papel: "usuario" | "assistente"; texto: string }[];
  baseHash: string;
  quantidade: number;
  ultimaMensagemId: string | null;
}
const ENVIADAS: ReadonlySet<StatusMensagem> = new Set(["ENVIADA", "ENTREGUE", "LIDA"]);
function cortar(texto: string, limite: number): string {
  const parte = texto.slice(0, limite);
  return /[\uD800-\uDBFF]$/.test(parte) ? parte.slice(0, -1) : parte;
}

export function prepararContextoInsight(
  entrada: readonly MensagemParaInsight[],
  ocultar: (texto: string) => string,
): ContextoInsight {
  const candidatas = entrada.filter(m => !m.apagadaEm && m.corpo?.trim()
    && (m.direcao === "ENTRADA" || ENVIADAS.has(m.status)))
    .toSorted((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime()
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(-30);
  let restante = 24000;
  const selecionadas: { mensagem: MensagemParaInsight; texto: string }[] = [];
  for (const mensagem of candidatas.toReversed()) {
    if (restante === 0) break;
    const texto = cortar(ocultar(mensagem.corpo!), Math.min(2000, restante));
    if (!texto.trim()) continue;
    selecionadas.push({ mensagem, texto });
    restante -= texto.length;
  }
  selecionadas.reverse();
  const base = selecionadas.map(({ mensagem: m }) => [
    m.id, m.criadoEm.toISOString(), m.editadaEm?.toISOString() ?? null, m.direcao, m.corpo,
  ]);
  return {
    mensagens: selecionadas.map(({ mensagem, texto }) => ({
      papel: mensagem.direcao === "ENTRADA" ? "usuario" : "assistente", texto,
    })),
    baseHash: createHash("sha256").update(JSON.stringify(base)).digest("hex"),
    quantidade: selecionadas.length,
    ultimaMensagemId: selecionadas.at(-1)?.mensagem.id ?? null,
  };
}
