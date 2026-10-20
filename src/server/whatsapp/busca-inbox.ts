import type { Prisma } from "@prisma/client";

// Busca da inbox (docs/42-auditoria-frontend-ux.md, E4): vai ao servidor (?busca=) e entra como condição da
// consulta paginada (`inbox/consultas-pagina.ts`). Módulo puro: sem Prisma client, testável.

type Parametros = Record<string, string | string[] | undefined>;

/** Busca da URL: até 100 caracteres, sem espaços nas pontas. */
export function lerBuscaInbox(p: Parametros): string {
  const v = p.busca;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
}

/**
 * Condição da busca: cada palavra (até 6) precisa aparecer num nome que a inbox mostra (cadastro ou
 * perfil do contato, aluno, lead, responsável fora do comercial — ver nomeDoAtendimento) — ou, com 3+
 * dígitos, no telefone (guardado em E.164: compara só os dígitos).
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
