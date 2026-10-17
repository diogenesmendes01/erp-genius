"use server";

import { atribuirTag, removerTag } from "./tags";
import { definirValorCampo } from "./campos";
import { editarPessoa, registrarNotaPessoa, registrarOptOut, type EditarPessoaInput } from "./contatos";
import { mesclarPessoas } from "./duplicados";

// Ações de servidor da tela /contatos. Os módulos de origem exportam constantes e tipos, então não podem ser "use server".
// Cada uma só repassa: sessão, capacidade, escopo e Evento ficam na ação de domínio.

export async function editarPessoaDaFicha(id: string, input: EditarPessoaInput) {
  return editarPessoa(id, input);
}

export async function registrarNotaDaFicha(id: string, texto: string) {
  return registrarNotaPessoa(id, texto);
}

export async function registrarOptOutDaFicha(pessoaId: string, motivo: string) {
  return registrarOptOut(pessoaId, motivo);
}

export async function atribuirTagDaFicha(input: { tagId: string; pessoaId: string }) {
  return atribuirTag(input);
}

export async function removerTagDaFicha(input: { tagId: string; pessoaId: string }) {
  return removerTag(input);
}

export async function definirCampoDaFicha(input: { campoId: string; pessoaId: string; valor: unknown }) {
  return definirValorCampo(input);
}

export async function mesclarContatosDaLista(input: Parameters<typeof mesclarPessoas>[0]) {
  return mesclarPessoas(input);
}
