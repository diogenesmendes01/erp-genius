import { nomeCompleto } from "@/lib/nome";

export interface ContatoComNome { nomeExibicao: string | null; nomePerfil: string | null; telefoneE164: string }

export function nomeDoContato(c: ContatoComNome): string {
  return c.nomeExibicao?.trim() || c.nomePerfil?.trim() || c.telefoneE164;
}

export function nomeConhecidoDoContato(c: Omit<ContatoComNome, "telefoneE164">): string | null {
  return c.nomeExibicao?.trim() || c.nomePerfil?.trim() || null;
}

export type FonteNome = "aluno" | "lead" | "responsavel" | "pedagogico" | "contato";

type AtendimentoComNome = {
  finalidade: string;
  aluno: { primeiroNome: string; sobrenome: string | null } | null;
  lead: { nome: string } | null;
  conversa: { contato: ContatoComNome & { responsavel?: { nome: string } | null } };
};

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
