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
import { ultimoEventoDoAutor } from "../_shared/idempotencia";
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
  // ON CONFLICT em vez de `upsert`, como em `versoes.ts` (#166, lote 4): no primeiro uso, dois cliques simultâneos em
  // pausar ou mudar o estado não colidem na criação da linha (o upsert do Prisma lê e depois insere; #166, 7º lote).
  await tx.$executeRaw`INSERT INTO "AgenteIA" ("id") VALUES (${ID_AGENTE}) ON CONFLICT ("id") DO NOTHING`;
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
      if (atual.pausadoEm) {
        // Idempotência por natureza (#166, 7º lote): a mesma pausa, de quem pausou e com o mesmo motivo, devolve ok sem
        // outro Evento (o agente travado acima serializa o clique duplo). Pausada por outra pessoa, segue recusada.
        if (atual.pausadoPorId === u.id && atual.motivoPausa === motivo) return;
        throw new ErroRegra("A Aria já está pausada.");
      }
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
      if (!atual.pausadoEm) {
        // Idempotência por natureza (#166, 7º lote): reativada por último por quem repete, devolve ok sem outro Evento.
        if (await ultimoEventoDoAutor(tx, { tipo: "AriaReativada", agregadoTipo: "AgenteIA", agregadoId: ID_AGENTE, autorId: u.id })) return;
        throw new ErroRegra("A Aria não está pausada.");
      }
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
      // Encurtar uma supervisão vigente equivale a desligá-la (DF5-13): só quem pode desligar.
      if (
        input.ate !== null &&
        atual.supervisaoAte !== null &&
        atual.supervisaoAte.getTime() > Date.now() &&
        input.ate.getTime() < atual.supervisaoAte.getTime()
      ) {
        await exigir(u, "desligarSupervisao", "Só o Administrador encurta a supervisão em vigor.");
      }
      // Já está no estado-alvo (ex.: reenvio após resultado incerto): nada a gravar, sem Evento.
      if ((atual.supervisaoAte?.getTime() ?? null) === (input.ate?.getTime() ?? null)) return;
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
