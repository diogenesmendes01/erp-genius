import Link from "next/link";
import type { DiarioTurma, ProgressaoAluno } from "@/server/academico/consultas";

// A ficha da turma só resume o estado. Diário e avaliações usam os fluxos
// consolidados por encontro e alocação, que preservam rastreabilidade.
export function TurmaAcademico({ diario, progressao, podeAprovar }: { turmaId: string; diario: DiarioTurma; progressao: ProgressaoAluno[]; podeEditar: boolean; podeAprovar: boolean }) {
  return <section className="rounded-lg border border-gray-200 bg-surface p-4">
    <h2 className="mb-3 font-medium">Acadêmico da turma</h2>
    <div className="flex flex-wrap gap-3 text-sm"><Link className="text-brand-700 underline" href="/diario">Abrir diário de classe</Link><Link className="text-brand-700 underline" href="/academico/avaliacoes">Abrir avaliações</Link></div>
    <p className="mt-3 text-sm text-gray-600">{diario.aulas.length} aula(s) registrada(s) · {diario.avaliacoes.length} avaliação(ões) configurada(s).</p>
    {progressao.length > 0 && <ul className="mt-3 divide-y divide-gray-100 rounded border border-gray-200 text-sm">{progressao.map((p) => <li key={p.alunoId} className="flex justify-between gap-3 px-3 py-2"><span>{p.nome}</span><span>{p.certificado ? `Certificado ${p.certificado.codigoValidacao}` : p.aprovadoSugerido ? (podeAprovar ? "Elegível: concluir no fluxo acadêmico" : "Elegível") : "Em acompanhamento"}</span></li>)}</ul>}
  </section>;
}
