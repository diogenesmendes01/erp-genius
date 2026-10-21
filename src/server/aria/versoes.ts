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
const MSG_RASCUNHO_MUDOU =
  "O rascunho foi alterado por outra pessoa desde que você abriu. Recarregue para ver a versão atual.";

/** Rascunho que o editor tinha aberto (null = não havia rascunho), para o controle de concorrência. */
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
  // ON CONFLICT em vez de `upsert`: no primeiro uso, dois salvamentos simultâneos não colidem na criação da linha
  // (o upsert do Prisma lê e depois insere, e o segundo caía na chave única; #166, lote 4).
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

/** Identificador de concorrência do rascunho atual (id + atualizadoEm), para a tela enviar de volta ao salvar. */
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

/**
 * Rascunho atual conferido contra o token que a tela abriu (chamar com o agente travado). Recusa se outra
 * pessoa salvou, publicou ou descartou o rascunho desde então; null só quando não há rascunho e a tela
 * também não tinha (N1 da R2 do #226: publicar e descartar usam o mesmo token de salvar e restaurar).
 */
async function rascunhoConferido(tx: Tx, aberto: RascunhoAberto) {
  const atual = await tx.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
  if (aberto === undefined || !mesmoRascunho(atual, aberto)) throw new ErroRegra(MSG_RASCUNHO_MUDOU);
  return atual;
}

/**
 * Grava `config` como rascunho (cria ou substitui o existente), recusando se o rascunho mudou desde que o
 * editor o abriu (`aberto`). Chamar com o agente travado (travarAgente) para serializar os editores.
 */
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
    // atualizadoEm estritamente crescente: dois salvamentos no mesmo milissegundo não podem repetir o token.
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
  /** Rascunho aberto na tela (de `rascunhoAtual` ou do último salvamento); null se não havia. */
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
      // Estado-alvo (#166): o rascunho atual já tem exatamente esta configuração, sobre a mesma versão publicada.
      // O reenvio depois de um resultado incerto chega com o token antigo; em vez de "o rascunho mudou", devolve o
      // rascunho como está, sem gravar nem registrar outro Evento.
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
  /** Rascunho aberto na tela (id + atualizadoEm): publica só se ainda é o mesmo. */
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
      // Estado-alvo (#166): o rascunho aberto na tela já foi publicado por este autor, com a mesma nota, e segue
      // como a versão em uso. O reenvio devolve o mesmo número, sem arquivar nem registrar nada de novo.
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

/** Descarta o rascunho aberto na tela (`aberto`), recusando se ele mudou desde então. */
export async function descartarRascunho(aberto: RascunhoAberto): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    await exigirCapacidade(u, "editarComportamento");
    await prisma.$transaction(async (tx) => {
      await travarAgente(tx);
      // Estado-alvo (#166): o rascunho aberto na tela já foi descartado por este autor. O reenvio devolve ok sem
      // registrar outro descarte.
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
