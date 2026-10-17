"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { atendimentoVisivel } from "../atendimentos";
import { executarAcaoMotor } from "./acoes";
import { ErroMotor, MENSAGEM_LIMITE_RITMO } from "./cliente";

const JANELA_EDICAO_MS = 15 * 60_000;

const EditarSchema = z.object({ mensagemId: z.string().min(1), texto: z.string().trim().min(1, "Escreva o texto.").max(4096, "O texto pode ter no máximo 4096 caracteres.") });
const ApagarSchema = z.object({ mensagemId: z.string().min(1) });

/** Carrega a mensagem própria, de saída pelo motor, dentro do escopo de envio; qualquer falha é ErroRegra sem tocar o motor. */
async function mensagemPropria(mensagemId: string, verbo: "editar" | "apagar") {
  const u = await exigirSessao();
  const m = await prisma.mensagemWhatsApp.findUnique({
    where: { id: mensagemId },
    include: { numero: { select: { id: true, driver: true, providerRef: true } } },
  });
  if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, true))) throw new ErroRegra("Mensagem fora do seu escopo de envio.");
  if (m.direcao !== "SAIDA" || m.autorId !== u.id) throw new ErroRegra(`Só é possível ${verbo} as próprias mensagens.`);
  if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra(`Esta mensagem não pode ser ${verbo === "editar" ? "editada" : "apagada"} neste canal.`);
  if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
  return { u, m, numeroRef: m.numero.providerRef ?? m.numero.id, mensagemIdMotor: m.mensagemIdMotor };
}

function traduzir(e: unknown): never {
  if (e instanceof ErroMotor) {
    if (e.codigo === "LIMITE_RITMO") throw new ErroRegra(MENSAGEM_LIMITE_RITMO);
    throw new ErroRegra("O motor do WhatsApp não executou a ação. Tente de novo em instantes.");
  }
  throw e;
}

/** Edita a própria mensagem de texto até 15 min depois do envio (message.edit no motor). */
export async function editarMensagemWhatsApp(input: { mensagemId: string; texto: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = EditarSchema.parse(input);
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "editar");
    if (m.tipo !== "TEXTO") throw new ErroRegra("Só é possível editar mensagens de texto.");
    if (Date.now() - m.criadoEm.getTime() > JANELA_EDICAO_MS) throw new ErroRegra("Só é possível editar até 15 minutos após o envio.");
    try {
      await executarAcaoMotor(numeroRef, "message.edit", { messageId: mensagemIdMotor, text: dados.texto }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { corpo: dados.texto, editadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId!, autorId: u.id,
        payload: { mensagemId: m.id, antes: m.corpo, depois: dados.texto },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

/** Apaga para todos a própria mensagem (message.delete no motor); o corpo fica guardado, só `apagadaEm` marca. */
export async function apagarMensagemWhatsApp(input: { mensagemId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ApagarSchema.parse(input);
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "apagar");
    try {
      await executarAcaoMotor(numeroRef, "message.delete", { messageId: mensagemIdMotor, forEveryone: true }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppApagada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId!, autorId: u.id,
        payload: { mensagemId: m.id, mensagemIdMotor },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}
