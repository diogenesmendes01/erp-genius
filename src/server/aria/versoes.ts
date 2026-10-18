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

// Versões da configuração da Aria (ADR-F5-01): no máximo 1 RASCUNHO e 1 PUBLICADA (índices parciais
// na migration). Descartar o rascunho é a única remoção física permitida: rascunho não é dado de
// negócio (nada o referencia) e o descarte fica auditado em Evento.

const MSG_CONFIG_MUDOU = "A configuração mudou desde que você abriu. Recarregue para ver a versão atual.";
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

/** Caminhos folha alterados entre duas configurações (ex.: "confianca.executaAPartirDe"); listas contam como um valor. */
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

/** Serializa os editores: cria a linha do agente se faltar e a trava até o fim da transação. */
async function travarAgente(tx: Tx): Promise<void> {
  await tx.agenteIA.upsert({ where: { id: ID_AGENTE }, create: { id: ID_AGENTE }, update: {} });
  await tx.$queryRaw`SELECT "id" FROM "AgenteIA" WHERE "id" = ${ID_AGENTE} FOR UPDATE`;
}

async function proximoNumero(tx: Tx, excetoId?: string): Promise<number> {
  const m = await tx.versaoAgenteIA.aggregate({
    _max: { numero: true },
    where: excetoId ? { id: { not: excetoId } } : undefined,
  });
  return (m._max.numero ?? 0) + 1;
}

/** Grava `config` como rascunho (cria ou substitui o existente). */
async function gravarRascunho(
  tx: Tx,
  config: ConfigAria,
  baseVersaoId: string | null,
  autorId: string,
): Promise<{ id: string; novo: boolean }> {
  const atual = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
  const json = config as unknown as Prisma.InputJsonValue;
  if (atual) {
    await tx.versaoAgenteIA.update({ where: { id: atual.id }, data: { config: json, baseVersaoId } });
    return { id: atual.id, novo: false };
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
  return { id: criada.id, novo: true };
}

export async function salvarRascunho(input: {
  config: unknown;
  baseVersaoId: string | null;
}): Promise<Resultado<{ versaoId: string }>> {
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
      const r = await gravarRascunho(tx, config, pub?.id ?? null, u.id);
      await registrarEvento(tx, {
        tipo: "AgenteIARascunhoSalvo",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: r.id,
        autorId: u.id,
        payload: { baseVersaoId: pub?.id ?? null },
      });
      return { versaoId: r.id };
    });
  });
}

export async function publicarRascunho(input: { nota?: string }): Promise<Resultado<{ numero: number }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    await exigirCapacidade(sessao, "publicar");
    const nota = input.nota?.trim() || null;
    if (nota && nota.length > 500) throw new ErroRegra("A nota da publicação aceita até 500 caracteres.");
    const u = await comLimites(sessao);
    return prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const rascunho = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
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

export async function descartarRascunho(): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigirCapacidade(u, "editarComportamento");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      const rascunho = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
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

export async function restaurarVersao(versaoId: string): Promise<Resultado<{ versaoId: string }>> {
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
      const r = await gravarRascunho(tx, config, pub?.id ?? null, u.id);
      await registrarEvento(tx, {
        tipo: "AgenteIAVersaoRestaurada",
        agregadoTipo: "VersaoAgenteIA",
        agregadoId: r.id,
        autorId: u.id,
        payload: { deVersaoId: antiga.id, deNumero: antiga.numero },
      });
      return { versaoId: r.id };
    });
  });
}
