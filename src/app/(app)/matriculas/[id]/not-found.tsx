import Link from "next/link";

// Matrícula inexistente ou fora do alcance da função (E2): em português e dentro do shell, com
// caminhos de volta — em vez da página 404 padrão do Next.
export default function MatriculaNaoEncontrada() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium">Matrícula não encontrada</h1>
      <p className="text-sm text-gray-600">
        Ela pode não existir mais, ou não estar no alcance da sua função. Confira o link ou procure pelo aluno.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/alunos" className="text-brand-700 hover:underline">Ir para alunos</Link>
        <Link href="/secretaria" className="text-brand-700 hover:underline">Ir para a Secretaria</Link>
      </div>
    </div>
  );
}
