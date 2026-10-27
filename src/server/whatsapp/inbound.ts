import type { DriverWhatsApp, StatusMensagem, TipoMensagem } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { capturarRespostaExperimental, type ReferralInbound } from "@/server/comercial/captura";
import { garantirContato, telefoneDeWaId } from "./identidade";
import { atendimentoDoInbound } from "./atendimentos";
import { aplicarInbound, aplicarResposta } from "./status-atendimento";
import { aoGravarSaidaHumana } from "@/server/aria/pausa";
import { agendarTurnoAria } from "@/server/aria/turno/orquestrador";
import { agendarTriagemAria } from "@/server/aria/triagem";

export interface InboundNormalizado {
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  contatoWaId: string;
  nomeExibicao?: string | null;
  providerMessageId: string;
  mensagemIdMotor?: string | null;
  corpo: string | null;
  tipo: TipoMensagem;
  midiaPath?: string | null;
  driver: DriverWhatsApp;
  fromMe: boolean;
  referral?: ReferralInbound | null;
  quando: Date;
}

const KEYWORDS_OPT_OUT = new Set(["sair", "parar", "stop", "baja", "no enviar", "unsubscribe"]);

export function ehPedidoOptOut(corpo: string | null): boolean {
  if (!corpo) return false;
  return KEYWORDS_OPT_OUT.has(corpo.trim().toLowerCase());
}

function conflitoUnicoInbound(erro: unknown, modelo: string, campos: readonly string[]): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2002" || erro.meta?.modelName !== modelo) return false;
  const alvo = erro.meta.target;
  return Array.isArray(alvo) && alvo.length === campos.length && alvo.every((campo, i) => campo === campos[i]);
}
export type ResultadoInbound = "gravada" | "duplicada" | "numero_desconhecido";

export async function processarMensagemNormalizada(m: InboundNormalizado): Promise<ResultadoInbound> {
  const numeroEncontrado = await acharNumero(m);
  if (!numeroEncontrado) return "numero_desconhecido";
  const numero = numeroEncontrado;

  const telefoneContato = telefoneDeWaId(m.contatoWaId);

  async function gravarTentativa() {
    const ancoraAria: { id: string | null } = { id: null };
    const ancoraTriagem: { id: string | null } = { id: null };
    await prisma.$transaction(async (tx) => {
      const contato = await garantirContato(tx, {
        telefoneE164: telefoneContato,
        waId: m.contatoWaId.replace(/\D/g, ""),
        nomePerfil: m.fromMe ? null : m.nomeExibicao ?? null,
      });

      const conversa = await tx.conversaWhatsApp.upsert({
        where: { numeroId_contatoId: { numeroId: numero.id, contatoId: contato.id } },
        create: { numeroId: numero.id, contatoId: contato.id },
        update: {},
      });

      if (!m.fromMe) await tx.conversaWhatsApp.updateMany({ where: { id: conversa.id, capturadaEm: null }, data: { capturadaEm: m.quando } });

      const mensagem = await tx.mensagemWhatsApp.create({
        data: {
          conversaId: conversa.id,
          numeroId: numero.id,
          direcao: m.fromMe ? "SAIDA" : "ENTRADA",
          tipo: m.tipo,
          corpo: m.corpo,
          midiaPath: m.midiaPath ?? null,
          status: m.fromMe ? "ENVIADA" : "ENTREGUE",
          statusEm: m.quando,
          enviadaEm: m.fromMe ? m.quando : null,
          driver: m.driver,
          origem: m.fromMe ? "CELULAR" : null,
          providerMessageId: m.providerMessageId,
          mensagemIdMotor: m.mensagemIdMotor ?? null,
          criadoEm: m.quando,
        },
      });

      await tx.conversaWhatsApp.update({
        where: { id: conversa.id },
        data: {
          ultimaMensagemEm: m.quando,
          ...(m.fromMe ? {} : { ultimoInboundEm: m.quando, naoLidas: { increment: 1 } }),
        },
      });

      if (!m.fromMe) {
        await tx.intencaoMensagem.updateMany({
          where: {
            contatoId: contato.id,
            status: { in: ["PENDENTE", "ADIADA"] },
            origem: { in: ["CRON", "LOTE"] },
            criadaEm: { lt: m.quando },
          },
          data: { status: "CANCELADA", motivoFalha: "conversa_viva" },
        });

        const optOutAgora = !contato.optOutEm && ehPedidoOptOut(m.corpo);
        if (optOutAgora) {
          await tx.contatoWhatsApp.update({
            where: { id: contato.id },
            data: { optOutEm: m.quando },
          });
          await registrarEvento(tx, {
            tipo: "OptOutRegistrado",
            agregadoTipo: "ContatoWhatsApp",
            agregadoId: contato.id,
            autorId: null,
            payload: { via: "keyword", palavra: (m.corpo ?? "").trim().toLowerCase() },
          });
        }

        if (!optOutAgora) {
          await capturarRespostaExperimental(tx, {
            leadId: contato.leadId,
            corpo: m.corpo,
            quando: m.quando,
          });
        }
      }
      const atendimentoId = await atendimentoDoInbound(tx, conversa.id, { atribuir: !m.fromMe });
      if (atendimentoId) {
        await tx.mensagemWhatsApp.update({ where: { id: mensagem.id }, data: { atendimentoId } });
        await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: {
          ultimaMensagemEm: m.quando, ...(m.fromMe ? {} : { ultimoInboundEm: m.quando, naoLidas: { increment: 1 } }),
        } });
        if (m.fromMe) {
          await aplicarResposta(tx, atendimentoId, m.quando);
          await aoGravarSaidaHumana(tx, { atendimentoId, origem: "CELULAR", autorId: null });
        }
        else {
          await aplicarInbound(tx, atendimentoId, m.quando);
          ancoraAria.id = mensagem.id;
        }
      } else if (!m.fromMe) ancoraTriagem.id = mensagem.id;
    });
    return { ariaId: ancoraAria.id, triagemId: ancoraTriagem.id };
  }

  let confirmada: Awaited<ReturnType<typeof gravarTentativa>>;
  try {
    confirmada = await gravarTentativa();
  } catch (erro) {
    if (conflitoUnicoInbound(erro, "ContatoWhatsApp", ["telefoneE164"])) {
      try {
        confirmada = await gravarTentativa();
      } catch (segundaFalha) {
        if (await mensagemDuplicadaConfirmada(segundaFalha)) return "duplicada";
        throw segundaFalha;
      }
    } else {
      if (await mensagemDuplicadaConfirmada(erro)) return "duplicada";
      throw erro;
    }
  }
  if (confirmada.ariaId) agendarTurnoAria(confirmada.ariaId);
  else if (confirmada.triagemId) agendarTriagemAria(confirmada.triagemId);
  return "gravada";

  async function mensagemDuplicadaConfirmada(erro: unknown): Promise<boolean> {
    if (!conflitoUnicoInbound(erro, "MensagemWhatsApp", ["numeroId", "providerMessageId"])) return false;
    const existente = await prisma.mensagemWhatsApp.findUnique({
      where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId: m.providerMessageId } },
      select: { id: true },
    });
    return existente !== null;
  }
}

export interface StatusNormalizado {
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  providerMessageId: string;
  clientMessageId?: string | null;
  status: StatusMensagem;
  driver: DriverWhatsApp;
  quando: Date;
}

const ORDEM_STATUS: Record<StatusMensagem, number> = {
  NA_FILA: 0,
  ENVIADA: 1,
  ENTREGUE: 2,
  LIDA: 3,
  FALHOU: 9,
};

export async function processarStatusNormalizado(
  s: StatusNormalizado,
  aposAtualizar?: (tx: Prisma.TransactionClient, msg: { id: string }) => Promise<void>,
): Promise<"atualizado" | "ignorado" | "sem_mensagem"> {
  const numero = await acharNumero(s);
  if (!numero) return "ignorado";

  const ou: Prisma.MensagemWhatsAppWhereInput[] = [{ providerMessageId: s.providerMessageId }];
  if (s.clientMessageId) ou.push({ clientMessageId: s.clientMessageId });
  const msg = await prisma.mensagemWhatsApp.findFirst({
    where: { numeroId: numero.id, OR: ou },
    select: { id: true, status: true, enviadaEm: true },
  });
  if (!msg) return "sem_mensagem";
  if (ORDEM_STATUS[s.status] <= ORDEM_STATUS[msg.status]) return "ignorado";

  await prisma.$transaction(async (tx) => {
    await tx.mensagemWhatsApp.update({
      where: { id: msg.id },
      data: { status: s.status, statusEm: s.quando, ...(msg.enviadaEm === null && msg.status === "NA_FILA" && s.status !== "FALHOU" ? { enviadaEm: s.quando } : {}) },
    });
    if (aposAtualizar) await aposAtualizar(tx, msg);
  });
  return "atualizado";
}

export async function acharNumero(ref: {
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  driver: DriverWhatsApp;
}) {
  if (ref.numeroProviderRef) {
    const porRef = await prisma.numeroWhatsApp.findFirst({
      where: { providerRef: ref.numeroProviderRef, driver: ref.driver },
    });
    if (porRef) return porRef;
  }
  if (ref.numeroTelefoneE164) {
    return prisma.numeroWhatsApp.findFirst({ where: { telefoneE164: ref.numeroTelefoneE164, driver: ref.driver } });
  }
  return null;
}
