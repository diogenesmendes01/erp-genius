"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { listarAlunosParaChamada } from "./chamada";
import { salvarAulaDiario } from "./acoes";
import type { DiarioInput } from "./schema";

// Data e hora da aula DIGITADAS no diário (lote 3 do fuso pessoal nas telas): a tela manda o texto do
// `datetime-local` e o fuso escrito ao lado do campo (pessoal; sem preferência, o da escola); a conversão em
// instante é aqui, no servidor. Antes, o navegador convertia no fuso do dispositivo. Editar uma aula existente não
// muda a data (o campo fica travado) e segue com o instante gravado, por `salvarAulaDiario`.

/** Chamada da turma na data digitada (`ocorridaLocal`, no `fuso`). */
export async function listarAlunosParaChamadaLocal(input: { turmaId: string; ocorridaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => exigirInstanteDoCampoLocal(input.ocorridaLocal, input.fuso).toISOString());
  if (!r.ok) return { ok: false as const, erro: r.erro };
  return listarAlunosParaChamada({ turmaId: input.turmaId, ocorridaEm: r.dado! });
}

/** Registro de aula nova com a data digitada (`ocorridaLocal`, no `fuso`). */
export async function salvarAulaDiarioLocal(input: Omit<DiarioInput, "ocorridaEm"> & { ocorridaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => {
    const { ocorridaLocal, fuso, ...resto } = input;
    return { ...resto, ocorridaEm: exigirInstanteDoCampoLocal(ocorridaLocal, fuso).toISOString() };
  });
  if (!r.ok) return { ok: false as const, erro: r.erro };
  return salvarAulaDiario(r.dado!);
}
