import { ErroRegra } from "@/server/_shared/sessao";

type TipoAtual = { id: string; nome: string; validador: string; _count: { alunos: number } };
type TipoInformado = { id?: string; nome: string; validador: string };

/** Preserva IDs de documentos e aceita formulários antigos apenas quando a identidade é inequívoca. */
export function planejarTiposDocumento(atuais: TipoAtual[], informados: TipoInformado[]) {
  const usados = new Set<string>();
  const atualizar: (TipoInformado & { id: string })[] = [];
  const criar: { nome: string; validador: string }[] = [];
  for (const tipo of informados) {
    const existente = tipo.id
      ? atuais.find((a) => a.id === tipo.id)
      : atuais.find((a) => a.nome === tipo.nome && a.validador === tipo.validador && !usados.has(a.id));
    if (tipo.id && !existente) throw new ErroRegra("Tipo de documento não pertence a este país.");
    if (existente) {
      if (usados.has(existente.id)) throw new ErroRegra("Tipo de documento duplicado.");
      usados.add(existente.id);
      atualizar.push({ id: existente.id, nome: tipo.nome, validador: tipo.validador });
    } else criar.push({ nome: tipo.nome, validador: tipo.validador });
  }
  const remover = atuais.filter((a) => !usados.has(a.id));
  if (remover.some((a) => a._count.alunos > 0))
    throw new ErroRegra("Não é possível excluir tipo de documento usado por alunos. Preserve o tipo e seu histórico.");
  return { atualizar, criar, remover: remover.map((a) => a.id) };
}
