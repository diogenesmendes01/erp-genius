import type { Prisma } from "@prisma/client";

// Lista da inbox (docs/42-auditoria-frontend-ux.md, E4): a consulta cortava em 200 conversas, em
// silêncio, e a busca só filtrava essas 200 no navegador — conversa mais antiga, mesmo com mensagem
// não lida (contada no badge do menu), simplesmente não aparecia. Agora: as 200 mais recentes MAIS
// todas as que têm não lidas, na mesma ordem por recência; e a busca vai ao servidor (?busca=).
// Módulo puro: sem Prisma client, testável.

export const LIMITE_CONVERSAS = 200;
/** Teto das não lidas trazidas além do limite (proteção; na prática são poucas). */
export const LIMITE_NAO_LIDAS_FORA = 500;

type Parametros = Record<string, string | string[] | undefined>;

/** Busca da URL: até 100 caracteres, sem espaços nas pontas. */
export function lerBuscaInbox(p: Parametros): string {
  const v = p.busca;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
}

/**
 * Condição da busca: cada palavra (até 6) precisa aparecer no nome do contato, do aluno ou do lead
 * — ou, com 3+ dígitos, no telefone (guardado em E.164: compara só os dígitos).
 */
export function whereBuscaConversas(busca: string): Prisma.AtendimentoWhatsAppWhereInput {
  const palavras = busca.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!palavras.length) return {};
  return {
    AND: palavras.map((palavra) => {
      const contem = { contains: palavra, mode: "insensitive" as const };
      const digitos = palavra.replace(/\D/g, "");
      return {
        OR: [
          { conversa: { contato: { nomeExibicao: contem } } },
          { aluno: { OR: [{ primeiroNome: contem }, { sobrenome: contem }] } },
          { lead: { nome: contem } },
          ...(digitos.length >= 3 ? [{ conversa: { contato: { telefoneE164: { contains: digitos } } } }] : []),
        ],
      };
    }),
  };
}

type ComRecencia = { id: string; ultimaMensagemEm: Date | null; criadoEm: Date };

/** Junta as recentes e as não lidas de fora do limite, sem repetir, na ordem da lista (recência). */
export function mesclarPorRecencia<T extends ComRecencia>(recentes: T[], naoLidasFora: T[]): T[] {
  const vistos = new Set(recentes.map((a) => a.id));
  const todas = [...recentes, ...naoLidasFora.filter((a) => !vistos.has(a.id))];
  const t = (d: Date | null) => (d ? d.getTime() : -Infinity);
  return todas.sort((a, b) => t(b.ultimaMensagemEm) - t(a.ultimaMensagemEm) || b.criadoEm.getTime() - a.criadoEm.getTime());
}

/**
 * Filtro por tipo de canal (SPEC-ERP-005 §5.5): "linha" = conversas das linhas comerciais (números
 * de VENDAS); "institucional" = o resto. Só restringe o escopo — quem não vê um tipo continua sem vê-lo.
 */
export type CanalInbox = "linha" | "institucional";

export function lerCanalInbox(p: Parametros): CanalInbox | "" {
  const v = Array.isArray(p.canal) ? p.canal[0] : p.canal;
  return v === "linha" || v === "institucional" ? v : "";
}

const DE_LINHA: Prisma.AtendimentoWhatsAppWhereInput = { finalidade: "COMERCIAL", conversa: { numero: { finalidade: "VENDAS" } } };

export function whereCanalInbox(canal: CanalInbox | ""): Prisma.AtendimentoWhatsAppWhereInput {
  if (canal === "linha") return DE_LINHA;
  if (canal === "institucional") return { NOT: DE_LINHA };
  return {};
}

/** Link da inbox mantendo a busca, o filtro de canal e, se houver, a conversa aberta. */
export function hrefInbox({ busca, c, canal }: { busca?: string; c?: string | null; canal?: CanalInbox | "" }): string {
  const q = new URLSearchParams();
  if (busca) q.set("busca", busca);
  if (canal) q.set("canal", canal);
  if (c) q.set("c", c);
  const s = q.toString();
  return s ? `/inbox?${s}` : "/inbox";
}
