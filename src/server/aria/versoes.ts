import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessao,
  numeroOuNull,
  registrarEvento,
  type Resultado,
  type UsuarioSessao,
} from "../_shared";
import { ConfigAriaSchema, configPadrao, type ConfigAria } from "./config-schema";
import { capacidadesAria, validarAlteracaoPorPapel, type CapacidadeAria } from "./permissoes-tela";

const MSG_CONFIG_MUDOU = "A configuração mudou desde que você abriu. Recarregue para ver a versão atual.";
const MSG_RASCUNHO_MUDOU =
  "O rascunho foi alterado por outra pessoa desde que você abriu. Recarregue para ver a versão atual.";

export type RascunhoAberto = { id: string; atualizadoEm: Date | string } | null;
const ID_AGENTE = "aria";

type Tx = Prisma.TransactionClient;

export async function versaoPublicada(
  tx?: Tx,
): Promise<{ id: string; numero: number; config: ConfigAria } | null> {
  const db = tx ?? prisma;
  const v = await db.versaoAgenteIA.findFirst({ where: { status: "PUBLICADA" } });
  if (!v) return null;
  return { id: v.id, numero: v.numero, config: ConfigAriaSchema.parse(v.config) };
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => igual(x, b[i]));
  if (ehObjeto(a) && ehObjeto(b)) return caminhos(a, b, "").length === 0;
  return false;
}

function caminhos(a: Record<string, unknown>, b: Record<string, unknown>, prefixo: string): string[] {
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const out: string[] = [];
  for (const k of chaves) {
    const va = a[k];
    const vb = b[k];
    if (va === undefined && vb === undefined) continue;
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (ehObjeto(va) && ehObjeto(vb)) out.push(...caminhos(va, vb, caminho));
    else if (!igual(va, vb)) out.push(caminho);
  }
  return out;
}

export function diffConfig(a: ConfigAria, b: ConfigAria): string[] {
  return caminhos(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, "");
}

async function exigirCapacidade(u: UsuarioSessao, cap: CapacidadeAria): Promise<void> {
  if (!capacidadesAria(u).has(cap)) throw new ErroPermissao("Sem acesso à configuração da Aria.");
}

async function comLimites(u: UsuarioSessao) {
  const l = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: { limiteDescontoTaxaPct: true, limiteDescontoMensalidadePct: true },
  });
  return {
    ...u,
    limiteDescontoTaxaPct: numeroOuNull(l?.limiteDescontoTaxaPct),
    limiteDescontoMensalidadePct: numeroOuNull(l?.limiteDescontoMensalidadePct),
  };
}

async function travarAgente(tx: Tx): Promise<void> {
  await tx.$executeRaw`INSERT INTO "AgenteIA" ("id") VALUES (${ID_AGENTE}) ON CONFLICT ("id") DO NOTHING`;
  await tx.$queryRaw`SELECT "id" FROM "AgenteIA" WHERE "id" = ${ID_AGENTE} FOR UPDATE`;
}

async function proximoNumero(tx: Tx, excetoId?: string): Promise<number> {
  const m = await tx.versaoAgenteIA.aggregate({
    _max: { numero: true },
    where: excetoId ? { id: { not: excetoId } } : undefined,
  });
  return (m._max.numero ?? 0) + 1;
}

export async function rascunhoAtual(tx?: Tx): Promise<{ id: string; atualizadoEm: Date } | null> {
  const r = await (tx ?? prisma).versaoAgenteIA.findFirst({
    where: { status: "RASCUNHO" },
    select: { id: true, atualizadoEm: true },
  });
  return r ? { id: r.id, atualizadoEm: r.atualizadoEm } : null;
}

function mesmoRascunho(atual: { id: string; atualizadoEm: Date } | null, aberto: RascunhoAberto): boolean {
  if (!atual || !aberto) return atual === null && aberto === null;
  const quando = new Date(aberto.atualizadoEm).getTime();
  return atual.id === aberto.id && atual.atualizadoEm.getTime() === quando;
}

async function rascunhoConferido(tx: Tx, aberto: RascunhoAberto) {
  const atual = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
  if (aberto === undefined || !mesmoRascunho(atual, aberto)) throw new ErroRegra(MSG_RASCUNHO_MUDOU);
  return atual;
}

async function gravarRascunho(
  tx: Tx,
  config: ConfigAria,
  baseVersaoId: string | null,
  autorId: string,
  aberto: RascunhoAberto,
): Promise<{ id: string; novo: boolean; atualizadoEm: Date }> {
  const atual = await rascunhoConferido(tx, aberto);
  const json = config as unknown as Prisma.InputJsonValue;
  if (atual) {
    const atualizadoEm = new Date(Math.max(Date.now(), atual.atualizadoEm.getTime() + 1));
    await tx.versaoAgenteIA.update({ where: { id: atual.id }, data: { config: json, baseVersaoId, atualizadoEm } });
    return { id: atual.id, novo: false, atualizadoEm };
  }
  const criada = await tx.versaoAgenteIA.create({
    data: {
      numero: await proximoNumero(tx),
      status: "RASCUNHO",
      config: json,
      baseVersaoId,
      criadaPorId: autorId,
    },
  });
  return { id: criada.id, novo: true, atualizadoEm: criada.atualizadoEm };
}

export async function salvarRascunho(input: {
  config: unknown;
  baseVersaoId: string | null;
  rascunho: RascunhoAberto;
}): Promise<Resultado<{ versaoId: string; atualizadoEm: Date }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    await exigirCapacidade(sessao, "editarComportamento");
    const config = ConfigAriaSchema.parse(input.config);
    const u = await comLimites(sessao);
    return prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const pub = await versaoPublicada(tx);
      if ((pub?.id ?? null) !== input.baseVersaoId) throw new ErroRegra(MSG_CONFIG_MUDOU);
      validarAlteracaoPorPapel(u, pub?.config ?? configPadrao(), config);
      const atual = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
      const configAtual = atual && ConfigAriaSchema.safeParse(atual.config);
      if (atual && configAtual?.success && atual.baseVersaoId === (pub?.id ?? null) && diffConfig(configAtual.data, config).length === 0) {
        return { versaoId: atual.id, atualizadoEm: atual.atualizadoEm };
      }
      const r = await gravarRascunho(tx, config, pub?.id ?? null, u.id, input.rascunho);
      await registrarEvento(tx, {
        tipo: "AgenteIARascunhoSalvo",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: r.id,
        autorId: u.id,
        payload: { baseVersaoId: pub?.id ?? null },
      });
      return { versaoId: r.id, atualizadoEm: r.atualizadoEm };
    });
  });
}

export async function publicarRascunho(input: {
  nota?: string;
  rascunho: RascunhoAberto;
}): Promise<Resultado<{ numero: number }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    await exigirCapacidade(sessao, "publicar");
    const nota = input.nota?.trim() || null;
    if (nota && nota.length > 500) throw new ErroRegra("A nota da publicação aceita até 500 caracteres.");
    const u = await comLimites(sessao);
    return prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      if (input.rascunho) {
        const ja = await tx.versaoAgenteIA.findUnique({ where: { id: input.rascunho.id } });
        if (ja?.status === "PUBLICADA" && ja.publicadaPorId === u.id && (ja.notaPublicacao ?? null) === nota) return { numero: ja.numero };
      }
      const rascunho = await rascunhoConferido(tx, input.rascunho);
      if (!rascunho) throw new ErroRegra("Não há rascunho para publicar.");
      const pub = await versaoPublicada(tx);
      if ((pub?.id ?? null) !== rascunho.baseVersaoId) throw new ErroRegra(MSG_CONFIG_MUDOU);
      const config = ConfigAriaSchema.parse(rascunho.config);
      const anterior = pub?.config ?? configPadrao();
      validarAlteracaoPorPapel(u, anterior, config);
      const diff = diffConfig(anterior, config);
      if (pub) await tx.versaoAgenteIA.update({ where: { id: pub.id }, data: { status: "ARQUIVADA" } });
      const numero = await proximoNumero(tx, rascunho.id);
      await tx.versaoAgenteIA.update({
        where: { id: rascunho.id },
        data: { status: "PUBLICADA", numero, publicadaPorId: u.id, publicadaEm: new Date(), notaPublicacao: nota },
      });
      await tx.agenteIA.update({ where: { id: ID_AGENTE }, data: { versaoPublicadaId: rascunho.id } });
      await registrarEvento(tx, {
        tipo: "AgenteIAPublicado",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: rascunho.id,
        autorId: u.id,
        payload: { numero, diff, nota },
      });
      return { numero };
    });
  });
}

export async function descartarRascunho(aberto: RascunhoAberto): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigirCapacidade(u, "editarComportamento");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      if (aberto && !(await tx.versaoAgenteIA.findUnique({ where: { id: aberto.id }, select: { id: true } }))) {
        const descarte = await tx.evento.findFirst({
          where: { tipo: "AgenteIARascunhoDescartado", agregadoTipo: "VersaoAgenteIA", agregadoId: aberto.id, autorId: u.id }, select: { id: true },
        });
        if (descarte) return;
      }
      const rascunho = await rascunhoConferido(tx, aberto);
      if (!rascunho) throw new ErroRegra("Não há rascunho para descartar.");
      await tx.versaoAgenteIA.delete({ where: { id: rascunho.id } });
      await registrarEvento(tx, {
        tipo: "AgenteIARascunhoDescartado",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: rascunho.id,
        autorId: u.id,
        payload: { numero: rascunho.numero },
      });
    });
  });
}

export async function restaurarVersao(
  versaoId: string,
  rascunho: RascunhoAberto,
): Promise<Resultado<{ versaoId: string; atualizadoEm: Date }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    await exigirCapacidade(sessao, "editarComportamento");
    const u = await comLimites(sessao);
    return prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const antiga = await tx.versaoAgenteIA.findUnique({ where: { id: versaoId } });
      if (!antiga || antiga.status === "RASCUNHO") throw new ErroRegra("Versão não encontrada.");
      const config = ConfigAriaSchema.parse(antiga.config);
      const pub = await versaoPublicada(tx);
      validarAlteracaoPorPapel(u, pub?.config ?? configPadrao(), config);
      const r = await gravarRascunho(tx, config, pub?.id ?? null, u.id, rascunho);
      await registrarEvento(tx, {
        tipo: "AgenteIAVersaoRestaurada",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: r.id,
        autorId: u.id,
        payload: { deVersaoId: antiga.id, deNumero: antiga.numero },
      });
      return { versaoId: r.id, atualizadoEm: r.atualizadoEm };
    });
  });
}
