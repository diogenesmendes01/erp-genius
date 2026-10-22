import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";

export type ItemThread = { tipo: "mensagem"; id: string; m: MensagemThread } | { tipo: "nota"; id: string; n: NotaInternaThread };

/** Notas não mudam cursores nem o limite das mensagens; aparecem somente dentro da janela carregada. */
export function itensDaThread(mensagens: MensagemThread[], notas: NotaInternaThread[], temMaisAntes: boolean): ItemThread[] {
  const primeira = mensagens.length ? mensagens.reduce((min, m) => m.criadoEm < min ? m.criadoEm : min, mensagens[0].criadoEm) : null;
  const itens: ItemThread[] = [
    ...mensagens.map((m): ItemThread => ({ tipo: "mensagem", id: m.id, m })),
    ...notas.filter((n) => !temMaisAntes || !primeira || n.criadoEm >= primeira)
      .map((n): ItemThread => ({ tipo: "nota", id: `nota:${n.id}`, n })),
  ];
  return itens.sort((a, b) => {
    const emA = a.tipo === "mensagem" ? a.m.criadoEm : a.n.criadoEm;
    const emB = b.tipo === "mensagem" ? b.m.criadoEm : b.n.criadoEm;
    return emA.localeCompare(emB) || (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === "mensagem" ? -1 : 1);
  });
}
