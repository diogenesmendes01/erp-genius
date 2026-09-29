import { nomeCompleto } from "@/lib/nome";

// NOME DO CONTATO NAS TELAS DO WHATSAPP: primeiro o que o ERP sabe (cadastro), depois o nome que a
// pessoa usa no perfil do WhatsApp e, sem nenhum dos dois, o próprio número. Nunca um rótulo genérico.

export interface ContatoComNome { nomeExibicao: string | null; nomePerfil: string | null; telefoneE164: string }

/** Nome salvo no ERP → nome de perfil → número. */
export function nomeDoContato(c: ContatoComNome): string {
  return c.nomeExibicao?.trim() || c.nomePerfil?.trim() || c.telefoneE164;
}

/** Nome que o ERP daria a um lead criado a partir do contato (vazio = o chamador decide). */
export function nomeConhecidoDoContato(c: Omit<ContatoComNome, "telefoneE164">): string | null {
  return c.nomeExibicao?.trim() || c.nomePerfil?.trim() || null;
}

/**
 * Nome do atendimento na inbox: aluno do atendimento → lead → responsável do contato → contato.
 * O responsável não aparece no COMERCIAL (a busca comercial não vira diretório de responsáveis) e o
 * PEDAGOGICO sem cadastro não expõe perfil nem telefone.
 */
export function nomeDoAtendimento(a: {
  finalidade: string;
  aluno: { primeiroNome: string; sobrenome: string | null } | null;
  lead: { nome: string } | null;
  conversa: { contato: ContatoComNome & { responsavel?: { nome: string } | null } };
}): string {
  if (a.aluno) return nomeCompleto(a.aluno);
  if (a.lead?.nome) return a.lead.nome;
  if (a.finalidade === "PEDAGOGICO") return "Atendimento pedagógico";
  const contato = a.conversa.contato;
  if (a.finalidade !== "COMERCIAL" && contato.responsavel?.nome) return contato.responsavel.nome;
  return nomeDoContato(contato);
}
