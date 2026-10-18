"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { agendarMensagem, cancelarMensagemAgendada } from "@/server/crm/mensagens-agendadas";
import { atendimentoVisivel } from "./atendimentos";
import { despacharFila } from "./despachante";
import { copiarMidiaParaSaida } from "./midia";

const NotaSchema = z.object({ atendimentoId: z.string().min(1), nota: z.string().trim().min(1, "Escreva a nota.").max(2000, "A nota pode ter no máximo 2000 caracteres.") });

/** Nota interna do atendimento (regra 20): só Evento, nunca MensagemWhatsApp nem IntencaoMensagem. Ver basta; participante sem envio pode anotar. */
export async function registrarNotaAtendimento(input: { atendimentoId: string; nota: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const { atendimentoId, nota } = NotaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const a = await atendimentoVisivel(u, atendimentoId);
      if (!a) throw new ErroRegra("Atendimento fora do seu escopo.");
      await registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: atendimentoId, autorId: u.id, payload: { nota } });
    });
    revalidatePath("/inbox");
  });
}

/** Notas do atendimento, mais recentes primeiro; vazio se o atendimento não é visível ao usuário. */
export async function notasDoAtendimento(atendimentoId: string): Promise<{ id: string; nota: string; autorNome: string | null; criadoEm: string }[]> {
  const u = await exigirSessao();
  const id = z.string().min(1).parse(atendimentoId);
  if (!(await atendimentoVisivel(u, id))) return [];
  const notas = await prisma.evento.findMany({
    where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, tipo: "NotaInterna" },
    orderBy: { criadoEm: "desc" }, take: 50, include: { autor: { select: { nome: true } } },
  });
  // Nota da Aria desfeita fica arquivada: o Evento original permanece, mas a nota sai da lista.
  const arquivadas = new Set(
    (await prisma.evento.findMany({ where: { agregadoTipo: "AtendimentoWhatsApp", agregadoId: id, tipo: "NotaInternaArquivada" }, select: { payload: true } }))
      .map((e) => (e.payload as { eventoId?: unknown } | null)?.eventoId)
      .filter((v): v is string => typeof v === "string"),
  );
  return notas.filter((e) => !arquivadas.has(e.id)).map((e) => ({ id: e.id, nota: typeof (e.payload as { nota?: unknown })?.nota === "string" ? (e.payload as { nota: string }).nota : "", autorNome: e.autor?.nome ?? null, criadoEm: e.criadoEm.toISOString() }));
}

/** Agenda uma mensagem pelo atendimento (Fase 2, Tarefa 29, reusada): o acesso e o número vêm do atendimento; horário, opt-out e validade ficam em `agendarMensagem`. */
export async function agendarMensagemNoAtendimento(input: { atendimentoId: string; texto: string; quando: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const a = await atendimentoVisivel(u, atendimentoId, true);
    if (!a || a.encerradoEm) throw new ErroRegra("Atendimento não encontrado.");
    const r = await agendarMensagem({ numeroId: a.numeroId, atendimentoId, texto: input.texto, agendadaPara: input.quando });
    if (!r.ok) throw new ErroRegra(r.erro);
    revalidatePath("/inbox");
    return r.dado!;
  });
}

/** Cancela uma mensagem agendada pelo atendimento: ela precisa ser deste atendimento; autoria e estado ficam em `cancelarMensagemAgendada`. */
export async function cancelarAgendamentoDoAtendimento(input: { atendimentoId: string; intencaoId: string }): Promise<Resultado> {
  const pre = await executarAcao(async () => {
    const u = await exigirSessao();
    const atendimentoId = z.string().min(1).parse(input.atendimentoId);
    const intencaoId = z.string().min(1).parse(input.intencaoId);
    const a = await atendimentoVisivel(u, atendimentoId);
    if (!a) throw new ErroRegra("Atendimento não encontrado.");
    const m = await prisma.intencaoMensagem.findFirst({ where: { id: intencaoId, atendimentoId }, select: { id: true } });
    if (!m) throw new ErroRegra("Mensagem agendada não encontrada.");
    return intencaoId;
  });
  if (!pre.ok || !pre.dado) return pre.ok ? { ok: false, erro: "Mensagem agendada não encontrada." } : pre;
  const r = await cancelarMensagemAgendada(pre.dado);
  if (r.ok) revalidatePath("/inbox");
  return r;
}

const MAX_DESTINOS_ENCAMINHAR = 5;
const EncaminharSchema = z.object({
  mensagemId: z.string().min(1),
  destinoAtendimentoIds: z.array(z.string().min(1)).min(1, "Escolha ao menos um destino.").max(MAX_DESTINOS_ENCAMINHAR, `Escolha no máximo ${MAX_DESTINOS_ENCAMINHAR} destinos.`),
});

/**
 * Encaminha uma mensagem como cópia (nova intenção HUMANO por destino). A autorização vem de a origem ser visível
 * (a mídia da origem é copiada para whatsapp-out/<autor>, que é de onde o despachante lê). Cada destino exige envio no escopo e
 * contato sem opt-out; qualquer recusa cancela tudo antes de criar intenção.
 */
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

    // O despachante só lê de whatsapp-out/: copia a mídia da origem (recebida ou enviada) para a pasta do autor.
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
