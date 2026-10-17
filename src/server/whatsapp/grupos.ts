import type { ContatoWhatsApp, DriverWhatsApp, Prisma, TipoMensagem } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

// GRUPOS DO WHATSAPP (E3.5): uma conversa é de contato individual OU de grupo (CHECK
// "Conversa_contato_xor_grupo"). Grupo é só leitura/escopo: não abre atendimento (trigger
// impedir_atendimento_em_grupo), não conta não lidas e não cancela automação de ninguém.

/** Contato individual da conversa; conversa de grupo não tem. */
export function contatoIndividual<T extends { contato: ContatoWhatsApp | null }>(c: T): ContatoWhatsApp {
  if (!c.contato) throw new ErroRegra("Conversa de grupo não tem contato individual.");
  return c.contato;
}

export interface MensagemGrupo {
  numeroId: string;
  grupoJid: string;
  nomeGrupo: string;
  participanteJid: string;
  participanteE164: string | null;
  participanteNome: string | null;
  providerMessageId: string;
  tipo: TipoMensagem;
  corpo: string | null;
  quando: Date;
  driver: DriverWhatsApp;
}

/** Grava a mensagem recebida num grupo, sem atendimento. O dedupe (numeroId, providerMessageId) explode no create. */
export async function gravarMensagemGrupo(tx: Prisma.TransactionClient, d: MensagemGrupo): Promise<{ mensagemId: string; conversaId: string }> {
  const grupo = await tx.grupoWhatsApp.upsert({
    where: { numeroId_grupoJid: { numeroId: d.numeroId, grupoJid: d.grupoJid } },
    create: { numeroId: d.numeroId, grupoJid: d.grupoJid, nome: d.nomeGrupo },
    update: { nome: d.nomeGrupo },
  });
  const conversa = await tx.conversaWhatsApp.upsert({
    where: { numeroId_grupoId: { numeroId: d.numeroId, grupoId: grupo.id } },
    create: { numeroId: d.numeroId, grupoId: grupo.id },
    update: {},
  });
  const mensagem = await tx.mensagemWhatsApp.create({
    data: {
      conversaId: conversa.id, numeroId: d.numeroId, direcao: "ENTRADA", tipo: d.tipo, corpo: d.corpo,
      status: "ENTREGUE", statusEm: d.quando, driver: d.driver, providerMessageId: d.providerMessageId, criadoEm: d.quando,
      participanteJid: d.participanteJid, participanteE164: d.participanteE164, participanteNome: d.participanteNome,
    },
  });
  await tx.conversaWhatsApp.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: d.quando } });
  return { mensagemId: mensagem.id, conversaId: conversa.id };
}

/** Estreita um objeto com `conversa.contato` anulável para o mesmo objeto com contato garantido (lança em grupo). */
export function comContatoIndividual<T extends { conversa: { contato: unknown } }>(a: T): Omit<T, "conversa"> & { conversa: Omit<T["conversa"], "contato"> & { contato: NonNullable<T["conversa"]["contato"]> } } {
  if (!a.conversa.contato) throw new ErroRegra("Conversa de grupo não tem contato individual.");
  return a as never;
}
