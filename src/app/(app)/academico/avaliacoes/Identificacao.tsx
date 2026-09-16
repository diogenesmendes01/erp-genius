export function IdentificacaoAvaliacao({ dados }: { dados: { aluno: string; matriculaId: string; matriculaCodigo: string | null; oferta: string; turma: string; nivel: string } }) {
  return <aside aria-label="Aluno e matrícula desta avaliação" className="space-y-1 rounded border p-3">
    <p className="font-medium">{dados.aluno}</p>
    <p>Matrícula: {dados.matriculaCodigo ?? dados.matriculaId} · {dados.oferta}</p>
    <p>{dados.turma} · nível {dados.nivel}</p>
  </aside>;
}
