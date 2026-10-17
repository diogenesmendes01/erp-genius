"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { agendarMensagem } from "@/server/crm/mensagens-agendadas";
import { atendimentoVisivel } from "./atendimentos";

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
  return notas.map((e) => ({ id: e.id, nota: typeof (e.payload as { nota?: unknown })?.nota === "string" ? (e.payload as { nota: string }).nota : "", autorNome: e.autor?.nome ?? null, criadoEm: e.criadoEm.toISOString() }));
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
