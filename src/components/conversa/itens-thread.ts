import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
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

export type AutorBalao = "cliente" | "humano" | "aria" | "nota";
export type ItemThreadVisual = (ItemThread & { emSequencia: boolean })
  | { tipo: "dia"; id: string; rotulo: string }
  | { tipo: "evento"; id: string; tom: "ia" | "neutro"; icone: "transferencia"; texto: string; hora: string | null };

export function autorDoItem(i: ItemThread): AutorBalao {
  if (i.tipo === "nota") return "nota";
  if (i.m.direcao === "ENTRADA") return "cliente";
  return i.m.origem === "IA" ? "aria" : "humano";
}

function formatadorDoDia(fuso: string | null) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: resolverFusoExibicao(fuso, "UTC"), year: "numeric", month: "2-digit", day: "2-digit" });
}
function chaveDoDia(iso: string | Date, formatador: Intl.DateTimeFormat): string | null {
  const instante = new Date(iso);
  if (!Number.isFinite(instante.getTime())) return null;
  const partes = formatador.formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/** Véspera da DATA LOCAL; subtrair24h do instante falha no início do horário de verão. */
function rotuloParaChaves(iso: string, fuso: string | null, dia: string | null, hoje: string | null): string {
  if (dia && hoje) {
    if (dia === hoje) return "Hoje";
    const [ano, mes, data] = hoje.split("-").map(Number);
    const ontem = new Date(Date.UTC(ano, mes - 1, data - 1)).toISOString().slice(0, 10);
    if (dia === ontem) return "Ontem";
  }
  return formatarInstanteExibicao(iso, fuso, "UTC", "data").texto;
}

export function rotuloDia(iso: string, fuso: string | null, agora: Date): string {
  const formatador = formatadorDoDia(fuso);
  return rotuloParaChaves(iso, fuso, chaveDoDia(iso, formatador), chaveDoDia(agora, formatador));
}

/** Sem id público do autor, desconhecidos nunca suprimem uma identificação potencialmente diferente. */
function identidade(i: ItemThread): string | null {
  if (i.tipo === "nota") return i.n.autorNome?.trim() ? JSON.stringify(["nota", i.n.origem, i.n.autorNome]) : null;
  const m = i.m, autor = autorDoItem(i);
  if (autor === "cliente") return JSON.stringify([autor, m.participanteNome]);
  if (autor === "aria") return autor;
  if (m.propria === true) return JSON.stringify([autor, "propria", m.origem]);
  return m.autorNome?.trim() ? JSON.stringify([autor, m.origem, m.autorNome]) : null;
}

/** Apenas decora a janela existente: não altera cursor, ordenação, limites ou as keys dos itens E0. */
export function decorarThread(itens: ItemThread[], { fuso, agora, transferidoDe }: { fuso: string | null; agora: Date; transferidoDe?: string | null }): ItemThreadVisual[] {
  const visual: ItemThreadVisual[] = [];
  // Um formatador por decoração, não por mensagem de um histórico virtualizado.
  const formatador = formatadorDoDia(fuso), hoje = chaveDoDia(agora, formatador);
  if (transferidoDe) visual.push({ tipo: "evento", id: "evento:transferencia", tom: "neutro", icone: "transferencia", texto: `Transferido de ${transferidoDe}`, hora: null });
  let diaAnterior: string | null = null, autorAnterior: string | null = null;
  for (const i of itens) {
    const iso = i.tipo === "nota" ? i.n.criadoEm : i.m.criadoEm;
    const dia = chaveDoDia(iso, formatador), autor = identidade(i);
    const emSequencia = !!dia && dia === diaAnterior && autor !== null && autor === autorAnterior;
    if (dia && dia !== diaAnterior) visual.push({ tipo: "dia", id: `dia:${dia}`, rotulo: rotuloParaChaves(iso, fuso, dia, hoje) });
    visual.push({ ...i, emSequencia });
    diaAnterior = dia; autorAnterior = autor;
  }
  return visual;
}

/** Adaptação estritamente visual; nota nunca deve entrar nos comandos ou status do transporte. */
export function notaComoMensagem(n: NotaInternaThread): MensagemThread {
  return { id: `nota:${n.id}`, direcao: "SAIDA", tipo: "TEXTO", corpo: n.nota, midiaPath: null, status: "INTERNA", origem: null,
    autorNome: n.autorNome, templateNome: null, criadoEm: n.criadoEm, participanteNome: null, favorita: false, clientMessageId: null };
}
