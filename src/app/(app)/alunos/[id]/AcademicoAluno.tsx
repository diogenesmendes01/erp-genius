import Link from "next/link";

// Resumo de leitura na ficha. Os lançamentos acadêmicos e o acesso ao portal usam
// os fluxos consolidados, que preservam matrícula, permissões e auditoria.
export function AcademicoAluno({ alunoId, testes, certificados, podeEditar }: {
  alunoId: string;
  niveis: { id: string; label: string }[];
  testes: { id: string; nivel: string; pontuacao: number | null; dataISO: string }[];
  certificados: { nivel: string; codigoValidacao: string; emitidoEmISO: string }[];
  podeEditar: boolean;
}) {
  return <section className="rounded-lg border border-gray-200 bg-surface p-4">
    <h2 className="mb-3 font-medium">Acadêmico</h2>
    <div className="grid gap-4 md:grid-cols-2">
      <div><h3 className="mb-1 text-sm font-medium text-gray-700">Testes de nível</h3>{testes.length === 0 ? <p className="text-sm text-gray-400">Nenhum teste registrado.</p> : <ul className="space-y-1 text-sm text-gray-700">{testes.map((t) => <li key={t.id}>{t.nivel}{t.pontuacao !== null ? ` · ${t.pontuacao} pts` : ""} · <span className="text-gray-400">{new Date(t.dataISO).toLocaleDateString("pt-BR")}</span></li>)}</ul>}</div>
      <div><h3 className="mb-1 text-sm font-medium text-gray-700">Certificados</h3>{certificados.length === 0 ? <p className="text-sm text-gray-400">Nenhum certificado emitido.</p> : <ul className="space-y-1 text-sm text-gray-700">{certificados.map((c) => <li key={c.codigoValidacao}>{c.nivel} · código <span className="font-mono text-xs">{c.codigoValidacao}</span> · <span className="text-gray-400">{new Date(c.emitidoEmISO).toLocaleDateString("pt-BR")}</span></li>)}</ul>}<h3 className="mb-1 mt-4 text-sm font-medium text-gray-700">Portal do aluno</h3><p className="text-sm text-gray-500">Consulte o acesso no fluxo próprio do portal.</p></div>
    </div>
    {podeEditar && <div className="mt-4 flex flex-wrap gap-3 text-sm"><Link className="text-brand-700 underline" href={`/alunos/${alunoId}/academico`}>Gerenciar solicitações acadêmicas</Link><Link className="text-brand-700 underline" href={`/alunos/${alunoId}/portal`}>Gerenciar acesso ao portal</Link></div>}
  </section>;
}
