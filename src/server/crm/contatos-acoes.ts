"use server";

import { atribuirTag, removerTag } from "./tags";
import { definirValorCampo } from "./campos";
import { editarPessoa, registrarNotaPessoa, registrarOptOut, type EditarPessoaInput } from "./contatos";
import { mesclarPessoas, previaMesclaPessoas } from "./duplicados";

export async function editarPessoaDaFicha(id: string, input: EditarPessoaInput) {
  return editarPessoa(id, input);
}

export async function registrarNotaDaFicha(id: string, texto: string, chaveIdempotencia?: string) {
  return registrarNotaPessoa(id, texto, chaveIdempotencia);
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

export async function previaMesclaDaLista(input: Parameters<typeof previaMesclaPessoas>[0]) {
  return previaMesclaPessoas(input);
}
