import type { StatusAtendimentoWhatsApp } from "@prisma/client";
import { SETORES, type Setor } from "@/server/whatsapp/setor";
import { lerBuscaInbox } from "@/server/whatsapp/busca-inbox";

export interface FiltrosInbox {
  setor?: Setor; numeroId?: string; responsavel?: "eu" | "fila" | string; status?: StatusAtendimentoWhatsApp;
  naoLidas?: boolean; prazoEstourado?: boolean; busca?: string;
}

const STATUS: readonly StatusAtendimentoWhatsApp[] = ["ABERTO_SEM_RESPONSAVEL", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "ENCERRADO"];

const um = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v ?? "").trim();

/** Lê os filtros da URL; valor desconhecido é ignorado (nunca vira erro nem filtro vazio). */
export function lerFiltrosInbox(p: Record<string, string | string[] | undefined>): FiltrosInbox {
  const f: FiltrosInbox = {};
  const setor = um(p.setor);
  if ((SETORES as readonly string[]).includes(setor)) f.setor = setor as Setor;
  const numeroId = um(p.numeroId).slice(0, 64);
  if (numeroId) f.numeroId = numeroId;
  const responsavel = um(p.responsavel).slice(0, 64);
  if (responsavel) f.responsavel = responsavel;
  const status = um(p.status);
  if ((STATUS as readonly string[]).includes(status)) f.status = status as StatusAtendimentoWhatsApp;
  if (["1", "true"].includes(um(p.naoLidas))) f.naoLidas = true;
  if (um(p.prazo) === "estourado") f.prazoEstourado = true;
  const busca = lerBuscaInbox(p);
  if (busca) f.busca = busca;
  return f;
}
