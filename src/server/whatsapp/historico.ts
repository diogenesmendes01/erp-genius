import type { TipoMensagem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { acharNumero } from "./inbound";
import { garantirContato, telefoneDeWaId } from "./identidade";
import { atendimentoDaLinhaParaInbound, ehLinhaComercial } from "./linha-comercial";

// IMPORTAÇÃO DO HISTÓRICO DA LINHA (SPEC-ERP-005 §5.4, LC-D04). Ao conectar uma linha BAILEYS, o
// aparelho manda o histórico recente; gravamos só conversas 1:1 dos últimos 30 dias.
// SEM EFEITOS COLATERAIS: é passado, não conversa viva — não captura lead, não saúda, não confirma
// experimental, não aplica opt-out por palavra, não cancela intenções e não soma não lidas.
// Idempotente pelo @@unique(numeroId, providerMessageId): reenvio/reconexão não duplica.

export const JANELA_HISTORICO_DIAS = 30;
/** Mensagens por transação — lote pequeno para não segurar lock nem estourar o webhook. */
const LOTE = 200;

export interface MensagemHistorica {
  contatoWaId: string;
  nomeExibicao?: string | null;
  providerMessageId: string;
  corpo: string | null;
  tipo: TipoMensagem;
  fromMe: boolean;
  quando: Date;
}

export interface ResultadoHistorico { gravadas: number; ignoradas: number; motivo: string | null }

/** Filtro puro da janela: nada antes de 30 dias nem "do futuro" (relógio do aparelho adiantado). */
export function dentroDaJanelaHistorico(quando: Date, agora: Date): boolean {
  const t = quando.getTime();
  if (Number.isNaN(t)) return false;
  return t >= agora.getTime() - JANELA_HISTORICO_DIAS * 86_400_000 && t <= agora.getTime() + 5 * 60_000;
}

export async function importarHistoricoLinha(
  ref: { numeroProviderRef: string },
  mensagens: MensagemHistorica[],
  agora: Date = new Date(),
): Promise<ResultadoHistorico> {
  const numero = await acharNumero({ numeroProviderRef: ref.numeroProviderRef, driver: "BAILEYS" });
  if (!numero) return { gravadas: 0, ignoradas: mensagens.length, motivo: "numero_desconhecido" };
  // Canal institucional não importa histórico: o aparelho mistura assuntos que a escola separa.
  if (!ehLinhaComercial(numero) || !numero.ativo) return { gravadas: 0, ignoradas: mensagens.length, motivo: "nao_e_linha_comercial" };

  const validas = mensagens.filter((m) => dentroDaJanelaHistorico(m.quando, agora));
  const porContato = new Map<string, MensagemHistorica[]>();
  for (const m of validas) {
    const chave = m.contatoWaId.replace(/\D/g, "");
    if (!chave) continue;
    const lista = porContato.get(chave) ?? [];
    lista.push(m);
    porContato.set(chave, lista);
  }

  let gravadas = 0;
  for (const [waId, doContato] of porContato) {
    for (let i = 0; i < doContato.length; i += LOTE) {
      const lote = doContato.slice(i, i + LOTE);
      gravadas += await prisma.$transaction(async (tx) => {
        const nome = lote.find((m) => !m.fromMe && m.nomeExibicao)?.nomeExibicao ?? null;
        const contato = await garantirContato(tx, { telefoneE164: telefoneDeWaId(waId), waId, nomeExibicao: nome });
        const conversa = await tx.conversaWhatsApp.upsert({
          where: { numeroId_contatoId: { numeroId: numero.id, contatoId: contato.id } },
          create: { numeroId: numero.id, contatoId: contato.id },
          update: {},
        });
        // Mesmo roteamento do tempo real: atendimento da linha, ou triagem se a conversa já tem
        // assunto institucional aberto.
        const atendimentoId = (await atendimentoDaLinhaParaInbound(tx, conversa.id)) ?? null;
        const criadas = await tx.mensagemWhatsApp.createMany({
          data: lote.map((m) => ({
            conversaId: conversa.id,
            numeroId: numero.id,
            atendimentoId,
            direcao: m.fromMe ? "SAIDA" as const : "ENTRADA" as const,
            tipo: m.tipo,
            corpo: m.corpo,
            midiaPath: null, // mídia do histórico entra sem binário (tipo e legenda preservados)
            status: m.fromMe ? "ENVIADA" as const : "ENTREGUE" as const,
            statusEm: m.quando,
            driver: "BAILEYS" as const,
            origem: null,
            providerMessageId: m.providerMessageId,
            criadoEm: m.quando,
          })),
          skipDuplicates: true,
        });
        if (criadas.count) {
          const maisRecente = new Date(Math.max(...lote.map((m) => m.quando.getTime())));
          // Só avança a recência — nunca recua para trás de uma mensagem viva mais nova.
          await tx.conversaWhatsApp.updateMany({
            where: { id: conversa.id, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: maisRecente } }] },
            data: { ultimaMensagemEm: maisRecente },
          });
          if (atendimentoId) {
            await tx.atendimentoWhatsApp.updateMany({
              where: { id: atendimentoId, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: maisRecente } }] },
              data: { ultimaMensagemEm: maisRecente },
            });
          }
        }
        return criadas.count;
      });
    }
  }
  return { gravadas, ignoradas: mensagens.length - gravadas, motivo: null };
}
