"use server";

import { TextoNotaInternaSchema } from "../_shared/efeitos-humanos-schema";
import { normalizarNotaComMencoes, type TokenMencao } from "@/lib/mencoes-nota";
import { notificarMencoesNaNota } from "@/server/inbox/mencoes";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel, type Evento } from "@prisma/client";
import { cancelarAgendadaInboxTx } from "@/server/inbox/agendadas-cancelamento";
import { prisma } from "@/lib/prisma";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { cancelarMensagemAgendada } from "@/server/crm/mensagens-agendadas";
import { atendimentoVisivel } from "./atendimentos";
import { executarAgendadaInbox } from "@/server/inbox/agendadas-operacao-inbox";
import type { NotaInternaThread } from "./consultas-inbox";
import { notasInternasDoAtendimento } from "./notas-consulta";
import { despacharFila } from "./despachante";
import { copiarDocumentoParaSaida, copiarMidiaParaSaida, descartarMidiaSaida } from "./midia";
import { enfileirarSaidaInboxTx } from "./enfileirar-inbox";
import { ERRO_ANEXAR_PROPOSTA, exigirPropostaVisivel } from "./proposta-atendimento";
import type { EnvioInboxResultado } from "./acoes";

const TokenMencaoSchema = z.object({ usuarioId: z.string().min(1).max(200), inicio: z.number().int().nonnegative(), fim: z.number().int().positive() });
const NotaSchema = z.object({
  atendimentoId: z.string().min(1),
  nota: TextoNotaInternaSchema,
  mencoes: z.array(TokenMencaoSchema).max(50).optional(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

export async function registrarNotaAtendimento(input: { atendimentoId: string; nota: string; chaveIdempotencia?: string; mencoes?: readonly TokenMencao[] }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { atendimentoId, nota, chaveIdempotencia, mencoes } = NotaSchema.parse(input);
    let comando: ReturnType<typeof normalizarNotaComMencoes>;
    try { comando = normalizarNotaComMencoes(nota, mencoes); }
    catch { throw new ErroRegra("Confira as menções da nota."); }
    const marca = marcaIdempotencia(chaveIdempotencia, { atendimentoId, ...comando });
    await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outra nota. Feche e reabra o atendimento e confira as notas antes de repetir.",
        });
        if (repetido) return;
      }
      const a = await atendimentoVisivel(u, atendimentoId, false, tx);
      if (!a) throw new ErroRegra("Atendimento fora do seu escopo.");
      const evento = await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId: u.id, payload: { nota: comando.nota, ...(comando.mencoes === undefined ? {} : { mencoes: comando.mencoes.map(t => ({ usuarioId: t.usuarioId, inicio: t.inicio, fim: t.fim })) }), ...marca } });
      await notificarMencoesNaNota(tx, { atendimentoId, eventoId: evento.id, autor: u, ...comando });
      await avisarAtendimentoAtualizado(tx, a);
    });
    revalidatePath("/inbox");
  });
}

export async function notasDoAtendimento(atendimentoId: string): Promise<NotaInternaThread[]> {
  const u = await exigirSessao();
  const id = z.string().min(1).parse(atendimentoId);
  if (!(await atendimentoVisivel(u, id))) return [];
  return notasInternasDoAtendimento(id);
}

function revalidarAgendadas() {
  revalidatePath("/inbox");
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}

export async function agendarMensagemNoAtendimento(input: { atendimentoId: string; texto: string; quando: string; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const r = await executarAgendadaInbox(prisma, u.id, {
      tipo: "CRIAR", atendimentoId, texto: input.texto, agendadaPara: input.quando, chaveIdempotencia: input.chaveIdempotencia,
    });
    revalidarAgendadas();
    return r;
  });
}

export async function reagendarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string; quandoLocal: string; fuso: string; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const intencaoId = z.string().min(1).parse(input.intencaoId);
    const agendadaPara = exigirInstanteDoCampoLocal(input.quandoLocal, input.fuso).toISOString();
    const r = await executarAgendadaInbox(prisma, u.id, { tipo: "REAGENDAR", atendimentoId, intencaoId, agendadaPara, chaveIdempotencia: input.chaveIdempotencia });
    revalidarAgendadas();
    return r;
  });
}

export async function editarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string; texto: string; quandoLocal: string; fuso: string; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const intencaoId = z.string().min(1).parse(input.intencaoId);
    const texto = z.string().parse(input.texto);
    const agendadaPara = exigirInstanteDoCampoLocal(input.quandoLocal, input.fuso).toISOString();
    const r = await executarAgendadaInbox(prisma, u.id, { tipo: "EDITAR", atendimentoId, intencaoId, texto, agendadaPara, chaveIdempotencia: input.chaveIdempotencia });
    revalidarAgendadas();
    return r;
  });
}

export async function enviarAgendamentoAgoraDoAtendimento(input: { atendimentoId: string; intencaoId: string; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const intencaoId = z.string().min(1).parse(input.intencaoId);
    const r = await executarAgendadaInbox(prisma, u.id, { tipo: "ENVIAR_AGORA", atendimentoId, intencaoId, chaveIdempotencia: input.chaveIdempotencia });
    revalidarAgendadas();
    return r;
  });
}

export async function agendarMensagemNoAtendimentoLocal(input: { atendimentoId: string; texto: string; quandoLocal: string; fuso: string; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  const r = await executarAcao(async () => exigirInstanteDoCampoLocal(input.quandoLocal, input.fuso).toISOString());
  if (!r.ok) return { ok: false, erro: r.erro };
  return agendarMensagemNoAtendimento({ atendimentoId: input.atendimentoId, texto: input.texto, quando: r.dado!, chaveIdempotencia: input.chaveIdempotencia });
}

export async function cancelarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string }): Promise<Resultado> {
  const pre = await executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const intencaoId = z.string().min(1).parse(input.intencaoId);
    if (u.papeis.includes(Papel.GERENTE_PEDAGOGICO) && !capacidadesCrm(u.papeis).has("tarefas.ver")) {
      await cancelarAgendadaInboxTx(u, atendimentoId, intencaoId);
      return null;
    }
    const a = await atendimentoVisivel(u, atendimentoId);
    if (!a) throw new ErroRegra("Atendimento não encontrado.");
    const m = await prisma.intencaoMensagem.findFirst({ where: { id: intencaoId, atendimentoId }, select: { id: true } });
    if (!m) throw new ErroRegra("Mensagem agendada não encontrada.");
    return intencaoId;
  });
  if (!pre.ok) return pre;
  if (pre.dado === null) { revalidatePath("/inbox"); return { ok: true }; }
  if (!pre.dado) return { ok: false, erro: "Mensagem agendada não encontrada." };
  const r = await cancelarMensagemAgendada(pre.dado);
  if (r.ok) revalidatePath("/inbox");
  return r;
}

const MAX_DESTINOS_ENCAMINHAR = 5;
const EncaminharSchema = z.object({
  mensagemId: z.string().min(1),
  destinoAtendimentoIds: z.array(z.string().min(1)).min(1, "Escolha ao menos um destino.").max(MAX_DESTINOS_ENCAMINHAR, `Escolha no máximo ${MAX_DESTINOS_ENCAMINHAR} destinos.`),
});

export async function encaminharMensagem(input: { mensagemId: string; destinoAtendimentoIds: string[] }): Promise<Resultado<{ intencaoIds: string[] }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { mensagemId } = EncaminharSchema.parse(input);
    const destinoIds = [...new Set(EncaminharSchema.parse(input).destinoAtendimentoIds)];
    const origem = await prisma.mensagemWhatsApp.findUnique({ where: { id: mensagemId }, select: { id: true, atendimentoId: true, tipo: true, corpo: true, midiaPath: true } });
    if (!origem?.atendimentoId || !(await atendimentoVisivel(u, origem.atendimentoId))) throw new ErroRegra("Mensagem de origem fora do seu escopo.");
    if (origem.tipo !== "TEXTO" && !origem.midiaPath) throw new ErroRegra("Esta mensagem não pode ser encaminhada.");
    if (origem.tipo === "TEXTO" && !origem.corpo?.trim()) throw new ErroRegra("Esta mensagem não pode ser encaminhada.");

    const destinos: NonNullable<Awaited<ReturnType<typeof atendimentoVisivel>>>[] = [];
    for (const id of destinoIds) {
      const d = await atendimentoVisivel(u, id, true);
      if (!d || d.encerradoEm) throw new ErroRegra("Destino fora do seu escopo.");
      if (!d.numero.ativo) throw new ErroRegra("Um dos destinos está em número inativo.");
      if (d.contato.optOutEm) throw new ErroRegra("Um dos destinos pediu para não receber mensagens (opt-out).");
      destinos.push(d);
    }

    let midiaPath: string | null = null;
    if (origem.midiaPath) {
      midiaPath = await copiarMidiaParaSaida(u.id, origem.midiaPath);
      if (!midiaPath) throw new ErroRegra("A mídia desta mensagem não está mais disponível para encaminhar.");
    }

    const intencaoIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const d of destinos) {
        const i = await tx.intencaoMensagem.create({
          data: {
            numeroId: d.numeroId, atendimentoId: d.id, contatoId: d.contatoId, origem: "HUMANO",
            tipo: origem.tipo, midiaPath, corpoRenderizado: origem.corpo ?? "", autorId: u.id,
          },
        });
        ids.push(i.id);
      }
      await registrarEvento(tx, { tipo: "MensagemEncaminhada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: origem.atendimentoId!, autorId: u.id, payload: { mensagemId, destinoAtendimentoIds: destinoIds, intencaoIds: ids } });
      return ids;
    });
    for (const intencaoId of intencaoIds) await despacharFila(new Date(), { intencaoId });
    revalidatePath("/inbox");
    return { intencaoIds };
  });
}

const PropostaSchema = z.object({
  atendimentoId: z.string().min(1),
  documentoId: z.string().min(1),
  legenda: z.string().max(1024, "A legenda pode ter no máximo 1024 caracteres.").optional(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});
const EVENTO_PROPOSTA = "PropostaEnviadaNoAtendimento";

function intencaoDoEvento(e: Evento): string {
  const id = (e.payload as Record<string, unknown> | null)?.intencaoId;
  if (typeof id !== "string") throw new ErroRegra("Não foi possível confirmar o envio anterior desta proposta. Confira a conversa antes de repetir.");
  return id;
}

async function situacaoDoEnvio(intencaoId: string): Promise<EnvioInboxResultado> {
  await despacharFila(new Date(), { intencaoId });
  const final = await prisma.intencaoMensagem.findUnique({ where: { id: intencaoId }, select: { status: true, motivoFalha: true } });
  revalidatePath("/inbox");
  return { status: final?.status ?? "PENDENTE", motivo: final?.motivoFalha ?? null };
}

export async function enviarPropostaNoAtendimento(input: { atendimentoId: string; documentoId: string; legenda?: string; chaveIdempotencia?: string }): Promise<Resultado<EnvioInboxResultado>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { atendimentoId, documentoId, legenda, chaveIdempotencia } = PropostaSchema.parse(input);
    const texto = legenda?.trim() ?? "";
    const marca = marcaIdempotencia(chaveIdempotencia, { atendimentoId, documentoId, legenda: texto });
    const alvo = marca ? {
      tipo: EVENTO_PROPOSTA, agregadoTipo: "AtendimentoWhatsApp", autorId: u.id, marca,
      mensagemConflito: "Esta tentativa já foi usada com outra proposta. Feche e reabra a conversa e confira as mensagens antes de repetir.",
    } : null;
    if (alvo) {
      const repetido = await prisma.$transaction((tx) => repeticaoIdempotente(tx, alvo));
      if (repetido) return situacaoDoEnvio(intencaoDoEvento(repetido));
    }
    const proposta = await exigirPropostaVisivel(u, atendimentoId, documentoId);
    const midiaPath = await copiarDocumentoParaSaida(u.id, proposta.url);
    if (!midiaPath) throw new ErroRegra(ERRO_ANEXAR_PROPOSTA);
    let gravado: { intencaoId: string; nova: boolean };
    try {
      gravado = await prisma.$transaction(async (tx) => {
        if (alvo) {
          const repetido = await repeticaoIdempotente(tx, alvo);
          if (repetido) return { intencaoId: intencaoDoEvento(repetido), nova: false };
        }
        const intencao = await enfileirarSaidaInboxTx(tx, u.id, atendimentoId, { tipo: "midia", url: midiaPath, ...(texto ? { legenda: texto } : {}) });
        await registrarEvento(tx, { tipo: EVENTO_PROPOSTA, agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId: u.id, payload: { documentoId, intencaoId: intencao.id, ...marca } });
        return { intencaoId: intencao.id, nova: true };
      });
    } catch (e) {
      await descartarMidiaSaida(u.id, midiaPath);
      throw e;
    }
    if (!gravado.nova) await descartarMidiaSaida(u.id, midiaPath);
    return situacaoDoEnvio(gravado.intencaoId);
  });
}
