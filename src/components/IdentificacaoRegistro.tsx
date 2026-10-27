import type { ReactNode } from "react";
import Link from "next/link";

export type DadosIdentificacao = {
  aluno: string;
  alunoHref?: string;
  matriculaCodigo?: string | null;
  matriculaComplemento?: string;
  registro?: ReactNode[];
};

export function IdentificacaoRegistro({ rotulo, dados }: { rotulo: string; dados: DadosIdentificacao }) {
  return <aside aria-label={rotulo} className="space-y-1 rounded border p-3">
    <p className="font-medium">{dados.alunoHref ? <Link href={dados.alunoHref} className="text-brand-700 hover:underline">{dados.aluno}</Link> : dados.aluno}</p>
    {dados.matriculaCodigo !== undefined && <p>Matrícula: {dados.matriculaCodigo ?? "sem código"}{dados.matriculaComplemento ? ` · ${dados.matriculaComplemento}` : ""}</p>}
    {dados.registro?.map((linha, indice) => <p key={indice}>{linha}</p>)}
  </aside>;
}
