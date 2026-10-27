import type { Prisma } from "@prisma/client";

type Parametros = Record<string, string | string[] | undefined>;

export function lerBuscaInbox(p: Parametros): string {
  const v = p.busca;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
}

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
          { conversa: { contato: { nomePerfil: contem } } },
          { finalidade: { not: "COMERCIAL" as const }, conversa: { contato: { responsavel: { nome: contem } } } },
          { aluno: { OR: [{ primeiroNome: contem }, { sobrenome: contem }] } },
          { lead: { nome: contem } },
          ...(digitos.length >= 3 ? [{ conversa: { contato: { telefoneE164: { contains: digitos } } } }] : []),
        ],
      };
    }),
  };
}
