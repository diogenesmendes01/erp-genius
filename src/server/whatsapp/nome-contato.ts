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

/** De onde vem o nome mostrado: só "contato" é editável na thread; os demais são cadastro. */
export type FonteNome = "aluno" | "lead" | "responsavel" | "pedagogico" | "contato";

type AtendimentoComNome = {
  finalidade: string;
  aluno: { primeiroNome: string; sobrenome: string | null } | null;
  lead: { nome: string } | null;
  conversa: { contato: ContatoComNome & { responsavel?: { nome: string } | null } };
};

/**
 * Nome do atendimento na inbox: aluno do atendimento → lead → responsável do contato → contato.
 * O responsável não aparece no COMERCIAL (a busca comercial não vira diretório de responsáveis) e o
 * PEDAGOGICO sem cadastro não expõe perfil nem telefone.
 */
export function nomeEFonteDoAtendimento(a: AtendimentoComNome): { nome: string; fonte: FonteNome } {
  if (a.aluno) return { nome: nomeCompleto(a.aluno), fonte: "aluno" };
  if (a.lead?.nome) return { nome: a.lead.nome, fonte: "lead" };
  if (a.finalidade === "PEDAGOGICO") return { nome: "Atendimento pedagógico", fonte: "pedagogico" };
  const contato = a.conversa.contato;
  if (a.finalidade !== "COMERCIAL" && contato.responsavel?.nome) return { nome: contato.responsavel.nome, fonte: "responsavel" };
  return { nome: nomeDoContato(contato), fonte: "contato" };
}

export function nomeDoAtendimento(a: AtendimentoComNome): string {
  return nomeEFonteDoAtendimento(a).nome;
}
