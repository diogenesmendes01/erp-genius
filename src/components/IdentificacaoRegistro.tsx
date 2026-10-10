import type { ReactNode } from "react";
import Link from "next/link";

// Identificação do registro fora de /matriculas/[id] (docs/43-medicao-auditoria-ux.md §6 item 7; docs/42 E2):
// telas de decisão diziam a AÇÃO ("Proposta de utilização de crédito", "Adotar publicação corrigida") e não
// de QUEM era o registro — quem recebe só o link aprovava sem ver aluno nem matrícula. É a generalização do
// IdentificacaoAvaliacao (src/app/(app)/academico/avaliacoes/Identificacao.tsx), que passa a usar este
// componente: aluno, matrícula pelo CÓDIGO (nunca o id interno) e as linhas do registro em texto legível.
// A trava é src/app/identificacao-registro.test.ts.

export type DadosIdentificacao = {
  /** Nome do aluno. */
  aluno: string;
  /** Ficha do aluno, quando o papel da tela a abre. */
  alunoHref?: string;
  /** Código da matrícula; `null` = matrícula sem código; ausente = a tela não é de uma matrícula. */
  matriculaCodigo?: string | null;
  /** O que acompanha a matrícula na mesma linha (oferta, produto). */
  matriculaComplemento?: string;
  /** Linhas do registro (crédito, reposição, aula de origem…), em texto legível. */
  registro?: ReactNode[];
};

export function IdentificacaoRegistro({ rotulo, dados }: { rotulo: string; dados: DadosIdentificacao }) {
  return <aside aria-label={rotulo} className="space-y-1 rounded border p-3">
    <p className="font-medium">{dados.alunoHref ? <Link href={dados.alunoHref} className="text-brand-700 hover:underline">{dados.aluno}</Link> : dados.aluno}</p>
    {dados.matriculaCodigo !== undefined && <p>Matrícula: {dados.matriculaCodigo ?? "sem código"}{dados.matriculaComplemento ? ` · ${dados.matriculaComplemento}` : ""}</p>}
    {dados.registro?.map((linha, indice) => <p key={indice}>{linha}</p>)}
  </aside>;
}
