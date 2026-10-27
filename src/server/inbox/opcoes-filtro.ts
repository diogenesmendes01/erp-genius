import { DriverWhatsApp, Papel, SessaoNumero, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { whereNumeroServeSetor } from "@/server/whatsapp/numero-setor";
import { setoresVisiveisNoInbox, type Setor } from "@/server/whatsapp/setor";

export type SaudeNumero = "conectado" | "instavel" | "desconectado";

export function saudeDoNumero(n: { driver: DriverWhatsApp; sessao: SessaoNumero; ativo: boolean }): SaudeNumero {
  if (!n.ativo) return "desconectado";
  if (n.driver === DriverWhatsApp.META_CLOUD || n.sessao === SessaoNumero.CONECTADO) return "conectado";
  return n.sessao === SessaoNumero.DESCONECTADO ? "desconectado" : "instavel";
}

export interface OpcoesFiltroInbox { setores: Setor[]; numeros: { id: string; rotulo: string; saude: SaudeNumero }[] }

export async function opcoesFiltroInbox(u: Pick<UsuarioSessao, "papeis">): Promise<OpcoesFiltroInbox> {
  const setores = setoresVisiveisNoInbox(u.papeis);
  if (!setores.length) return { setores, numeros: [] };
  const where: Prisma.NumeroWhatsAppWhereInput = u.papeis.includes(Papel.ADMINISTRADOR) ? {} : { OR: setores.map(whereNumeroServeSetor) };
  const numeros = await prisma.numeroWhatsApp.findMany({ where, select: { id: true, rotulo: true, driver: true, sessao: true, ativo: true }, orderBy: [{ rotulo: "asc" }, { id: "asc" }], take: 200 });
  return { setores, numeros: numeros.map((n) => ({ id: n.id, rotulo: n.rotulo, saude: saudeDoNumero(n) })) };
}
