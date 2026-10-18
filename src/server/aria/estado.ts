import { Prisma, type EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessao,
  registrarEvento,
  type Resultado,
} from "../_shared";
import type { ConfigAria } from "./config-schema";
import { capacidadesAria, type CapacidadeAria } from "./permissoes-tela";
import { versaoPublicada } from "./versoes";

// Estado operacional da Aria: DESLIGADA/SHADOW/ATIVA, pausa global com motivo e supervisão
// (revisão humana obrigatória até uma data; "até eu desligar" = 9999-12-31T00:00:00Z).

const ID_AGENTE = "aria";
type Tx = Prisma.TransactionClient;

async function exigir(u: Parameters<typeof capacidadesAria>[0], cap: CapacidadeAria, msg: string) {
  if (!capacidadesAria(u).has(cap)) throw new ErroPermissao(msg);
}

async function travarAgente(tx: Tx): Promise<void> {
  await tx.agenteIA.upsert({ where: { id: ID_AGENTE }, create: { id: ID_AGENTE }, update: {} });
  await tx.$queryRaw`SELECT "id" FROM "AgenteIA" WHERE "id" = ${ID_AGENTE} FOR UPDATE`;
}

export async function situacaoAria(
  agora: Date = new Date(),
  tx?: Tx,
): Promise<{
  estado: EstadoPolitica;
  pausada: boolean;
  supervisao: boolean;
  versao: { id: string; numero: number; config: ConfigAria } | null;
}> {
  const db = tx ?? prisma;
  const a = await db.agenteIA.findUnique({ where: { id: ID_AGENTE } });
  return {
    estado: a?.estado ?? "DESLIGADA",
    pausada: a?.pausadoEm != null,
    supervisao: a?.supervisaoAte != null && a.supervisaoAte.getTime() > agora.getTime(),
    versao: await versaoPublicada(tx),
  };
}

export async function definirEstadoAria(estado: EstadoPolitica): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigir(u, "mudarEstado", "Só o Administrador muda o estado da Aria.");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const atual = await tx.agenteIA.findUniqueOrThrow({ where: { id: ID_AGENTE } });
      if (atual.estado === estado) return;
      if (estado !== "DESLIGADA" && !(await versaoPublicada(tx))) {
        throw new ErroRegra("Publique uma versão antes de ligar a Aria.");
      }
      await tx.agenteIA.update({ where: { id: ID_AGENTE }, data: { estado } });
      await registrarEvento(tx, {
        tipo: "AriaEstadoAlterado",
        agregadoTipo: "AgenteIA",
        agregadoId: ID_AGENTE,
        autorId: u.id,
        payload: { de: atual.estado, para: estado },
      });
    });
  });
}

export async function pausarAria(input: { motivo: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigir(u, "pausar", "Sem permissão para pausar a Aria.");
    const motivo = input.motivo?.trim() ?? "";
    if (!motivo) throw new ErroRegra("Informe o motivo da pausa.");
    if (motivo.length > 500) throw new ErroRegra("O motivo da pausa aceita até 500 caracteres.");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const atual = await tx.agenteIA.findUniqueOrThrow({ where: { id: ID_AGENTE } });
      if (atual.pausadoEm) throw new ErroRegra("A Aria já está pausada.");
      await tx.agenteIA.update({
        where: { id: ID_AGENTE },
        data: { pausadoEm: new Date(), pausadoPorId: u.id, motivoPausa: motivo },
      });
      await registrarEvento(tx, {
        tipo: "AriaPausada",
        agregadoTipo: "AgenteIA",
        agregadoId: ID_AGENTE,
        autorId: u.id,
        payload: { motivo },
      });
    });
  });
}

export async function reativarAria(): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigir(u, "pausar", "Sem permissão para reativar a Aria.");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const atual = await tx.agenteIA.findUniqueOrThrow({ where: { id: ID_AGENTE } });
      if (!atual.pausadoEm) throw new ErroRegra("A Aria não está pausada.");
      await tx.agenteIA.update({
        where: { id: ID_AGENTE },
        data: { pausadoEm: null, pausadoPorId: null, motivoPausa: null },
      });
      await registrarEvento(tx, {
        tipo: "AriaReativada",
        agregadoTipo: "AgenteIA",
        agregadoId: ID_AGENTE,
        autorId: u.id,
        payload: {},
      });
    });
  });
}

export async function definirSupervisao(input: { ate: Date | null }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (input.ate === null) {
      await exigir(u, "desligarSupervisao", "Só o Administrador desliga a supervisão.");
    } else {
      await exigir(u, "ligarSupervisao", "Sem permissão para ligar a supervisão.");
      if (Number.isNaN(input.ate.getTime()) || input.ate.getTime() <= Date.now()) {
        throw new ErroRegra("A supervisão precisa terminar em uma data futura.");
      }
    }
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const atual = await tx.agenteIA.findUniqueOrThrow({ where: { id: ID_AGENTE } });
      await tx.agenteIA.update({ where: { id: ID_AGENTE }, data: { supervisaoAte: input.ate } });
      await registrarEvento(tx, {
        tipo: "AriaSupervisaoAlterada",
        agregadoTipo: "AgenteIA",
        agregadoId: ID_AGENTE,
        autorId: u.id,
        payload: { de: atual.supervisaoAte?.toISOString() ?? null, para: input.ate?.toISOString() ?? null },
      });
    });
  });
}
