import { DriverWhatsApp, Papel, SessaoNumero, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { whereNumeroServeSetor } from "@/server/whatsapp/numero-setor";
import { ehGerenteDoSetor, setoresVisiveisNoInbox, type Setor } from "@/server/whatsapp/setor";

export type SaudeNumero = "conectado" | "instavel" | "desconectado";

export function saudeDoNumero(n: { driver: DriverWhatsApp; sessao: SessaoNumero; ativo: boolean }): SaudeNumero {
  if (!n.ativo) return "desconectado";
  if (n.driver === DriverWhatsApp.META_CLOUD || n.sessao === SessaoNumero.CONECTADO) return "conectado";
  return n.sessao === SessaoNumero.DESCONECTADO ? "desconectado" : "instavel";
}

export interface OpcoesFiltroInbox { setores: Setor[]; numeros: { id: string; rotulo: string; saude: SaudeNumero }[] }

const PAPEIS_ALEM_DE_VENDEDOR: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.GERENTE_COMERCIAL,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
];

export function ehVendedorExclusivo(papeis: readonly Papel[]): boolean {
  return papeis.includes(Papel.VENDEDOR) && !papeis.some((p) => PAPEIS_ALEM_DE_VENDEDOR.includes(p));
}

export function vendedorSemWhatsAppConectado(
  papeis: readonly Papel[],
  numeros: readonly { saude: SaudeNumero }[],
): boolean {
  if (!ehVendedorExclusivo(papeis)) return false;
  return !numeros.some((n) => n.saude === "conectado");
}

export async function opcoesFiltroInbox(u: Pick<UsuarioSessao, "papeis"> & { id?: string }): Promise<OpcoesFiltroInbox> {
  const setores = setoresVisiveisNoInbox(u.papeis);
  if (!setores.length) return { setores, numeros: [] };
  const where: Prisma.NumeroWhatsAppWhereInput = u.papeis.includes(Papel.ADMINISTRADOR)
    ? {}
    : {
        OR: setores.map((setor) =>
          setor === "COMERCIAL" && !ehGerenteDoSetor(u.papeis, "COMERCIAL")
            ? { donoId: u.id ?? "__sem_dono__" }
            : whereNumeroServeSetor(setor),
        ),
      };
  const numeros = await prisma.numeroWhatsApp.findMany({ where, select: { id: true, rotulo: true, driver: true, sessao: true, ativo: true }, orderBy: [{ rotulo: "asc" }, { id: "asc" }], take: 200 });
  return { setores, numeros: numeros.map((n) => ({ id: n.id, rotulo: n.rotulo, saude: saudeDoNumero(n) })) };
}
