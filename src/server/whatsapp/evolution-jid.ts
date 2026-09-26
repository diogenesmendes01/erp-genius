// CONTATO NO PAYLOAD DA EVOLUTION (SPEC-ERP-005 Fase 0). Módulo puro, testável.
//
// O webhook só gravava `remoteJid` terminado em `@s.whatsapp.net`. O WhatsApp passou a endereçar
// parte dos contatos por LID (`<id>@lid`, identificador que não é telefone); nesses casos a
// Evolution/Baileys manda o telefone num campo alternativo da `key`. Sem olhar esse campo, a
// mensagem de um contato novo sumia sem nem chegar à triagem.

export interface ChaveMensagemEvolution {
  remoteJid?: string | null;
  /** Telefone do contato quando `remoteJid` é LID (Baileys 6.7+/Evolution 2.3). */
  remoteJidAlt?: string | null;
  /** Variante mais antiga do mesmo campo. */
  senderPn?: string | null;
  fromMe?: boolean;
  id?: string;
}

/** Descartes esperados (grupo/broadcast/status) × inesperados (vão para o log). */
export type MotivoDescarte = "grupo" | "broadcast" | "status" | "lid_sem_telefone" | "jid_desconhecido" | "sem_jid";

export type ContatoEvolution = { waId: string } | { descarte: MotivoDescarte };

const SUFIXO_TELEFONE = "@s.whatsapp.net";

function telefoneDoJid(jid: string | null | undefined): string | null {
  if (!jid || !jid.endsWith(SUFIXO_TELEFONE)) return null;
  // Jid de aparelho vinculado vem como "5511999:12@s.whatsapp.net": o telefone é antes do ":".
  const digitos = jid.slice(0, -SUFIXO_TELEFONE.length).split(":")[0].replace(/\D/g, "");
  return digitos.length >= 8 ? digitos : null;
}

/** Resolve o wa_id (E.164 sem "+") do contato de uma conversa 1:1, ou o motivo do descarte. */
export function resolverContatoEvolution(key: ChaveMensagemEvolution | null | undefined): ContatoEvolution {
  const jid = key?.remoteJid ?? "";
  if (!jid) return { descarte: "sem_jid" };
  if (jid.endsWith("@g.us")) return { descarte: "grupo" };
  if (jid === "status@broadcast") return { descarte: "status" };
  if (jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return { descarte: "broadcast" };
  const direto = telefoneDoJid(jid);
  if (direto) return { waId: direto };
  if (jid.endsWith("@lid")) {
    const alternativo = telefoneDoJid(key?.remoteJidAlt) ?? telefoneDoJid(key?.senderPn);
    return alternativo ? { waId: alternativo } : { descarte: "lid_sem_telefone" };
  }
  return { descarte: "jid_desconhecido" };
}

/** Descartes que indicam payload não suportado — registrados em log (sem telefone nem conteúdo). */
export function descarteInesperado(motivo: MotivoDescarte): boolean {
  return motivo === "lid_sem_telefone" || motivo === "jid_desconhecido" || motivo === "sem_jid";
}
