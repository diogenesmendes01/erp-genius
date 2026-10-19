// Sem "use server": exporta helpers de transação; a fronteira de Server Action é acoes-distribuicao.ts.
import { z } from "zod";
import { Prisma, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, registrarEvento, type Resultado } from "@/server/_shared";
import { SETORES } from "@/server/whatsapp/setor";
import { aplicarDistribuicaoSetor, DistribuicaoSchema, exigirEdicaoDoSetor, type EntradaDistribuicao } from "./distribuicao";
import { horarioCanonico, HorarioAtendimentoSchema, type HorarioAtendimento } from "./horario-atendimento";

/** Prazos aceitos na tela. 1440 (24 h) é o padrão do Pedagógico gravado pela migration da 5F. */
export const PRAZOS_SLA = [15, 30, 60, 120, 240, 1440] as const;
export type PrazoSla = (typeof PRAZOS_SLA)[number];

const SlaSchema = z.object({
  finalidade: z.enum(SETORES as unknown as [FinalidadeAtendimentoWhatsApp, ...FinalidadeAtendimentoWhatsApp[]]),
  prazoPrimeiraRespostaMin: z.number().int().positive(),
  alertarResponsavel: z.boolean(),
  alertarGerente: z.boolean(),
  contarSoNoHorario: z.boolean(),
  /** Horário de atendimento do setor; null limpa (contagem corrida). Ausente preserva o gravado. */
  horario: HorarioAtendimentoSchema.nullable().optional(),
});
export type EntradaSla = z.input<typeof SlaSchema>;

/** Horário gravado lido do JSON; o que não passa no schema conta como ausente. */
function horarioGravado(v: Prisma.JsonValue | null | undefined): HorarioAtendimento | null {
  const r = HorarioAtendimentoSchema.safeParse(v);
  return r.success ? horarioCanonico(r.data) : null;
}

/**
 * Grava o SLA na transação do chamador e só quando algo mudou (sem `SlaAlterado` vazio). Um prazo
 * fora de PRAZOS_SLA só é aceito se for o valor já gravado (preservado, nunca trocado em silêncio).
 */
export async function aplicarSlaSetor(tx: Prisma.TransactionClient, autorId: string, entrada: EntradaSla): Promise<boolean> {
  const dados = SlaSchema.parse(entrada);
  const linha = await tx.prazoRespostaSetor.findUnique({ where: { finalidade: dados.finalidade }, select: { minutos: true, alertarResponsavel: true, alertarGerente: true, contarSoNoHorario: true, horario: true } });
  if (!(PRAZOS_SLA as readonly number[]).includes(dados.prazoPrimeiraRespostaMin) && dados.prazoPrimeiraRespostaMin !== linha?.minutos) {
    throw new ErroRegra("Prazo da primeira resposta inválido.");
  }
  const antes = linha ? { ...linha, horario: horarioGravado(linha.horario) } : null;
  const horario = dados.horario === undefined ? (antes?.horario ?? null) : dados.horario && horarioCanonico(dados.horario);
  const campos = { minutos: dados.prazoPrimeiraRespostaMin, alertarResponsavel: dados.alertarResponsavel, alertarGerente: dados.alertarGerente, contarSoNoHorario: dados.contarSoNoHorario, horario };
  if (antes && antes.minutos === campos.minutos && antes.alertarResponsavel === campos.alertarResponsavel
    && antes.alertarGerente === campos.alertarGerente && antes.contarSoNoHorario === campos.contarSoNoHorario
    && JSON.stringify(antes.horario) === JSON.stringify(campos.horario)) return false;
  const gravar = { ...campos, horario: campos.horario ?? Prisma.DbNull };
  await tx.prazoRespostaSetor.upsert({ where: { finalidade: dados.finalidade }, create: { finalidade: dados.finalidade, ...gravar }, update: gravar });
  await registrarEvento(tx, { tipo: "SlaAlterado", agregadoTipo: "ConfigSetorAtendimento", agregadoId: dados.finalidade, autorId, payload: { finalidade: dados.finalidade, de: antes ?? null, para: campos } });
  return true;
}

export async function salvarSlaSetor(i: EntradaSla): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = SlaSchema.parse(i);
    const autor = await exigirEdicaoDoSetor(dados.finalidade);
    await prisma.$transaction((tx) => aplicarSlaSetor(tx, autor.id, dados));
    return undefined;
  });
}

/** Tela do setor: distribuição e SLA numa transação só (nada de salvamento parcial); cada parte só grava se mudou. */
export async function salvarConfigSetor(i: { distribuicao: EntradaDistribuicao; sla: Omit<EntradaSla, "finalidade"> }): Promise<Resultado> {
  return executarAcao(async () => {
    const dist = DistribuicaoSchema.parse(i.distribuicao);
    const sla = SlaSchema.parse({ ...i.sla, finalidade: dist.finalidade });
    const autor = await exigirEdicaoDoSetor(dist.finalidade);
    await prisma.$transaction(async (tx) => {
      await aplicarDistribuicaoSetor(tx, autor.id, dist);
      await aplicarSlaSetor(tx, autor.id, sla);
    });
    return undefined;
  });
}
