import Link from "next/link";
import { exigirSessaoPortalAluno } from "@/server/portal-aluno/sessao";
import { listarReposicoesDoPortalAluno } from "@/server/portal-aluno/reposicoes";
import { SairPortalAluno } from "./sair";

export const dynamic = "force-dynamic";

export default async function InicioPortalAlunoPage() {
  const [sessao, reposicoes] = await Promise.all([exigirSessaoPortalAluno(), listarReposicoesDoPortalAluno()]);
  return <section className="mx-auto max-w-3xl p-6 sm:p-10"><header className="flex items-start justify-between gap-4"><div><p className="text-sm text-brand-700">Área do aluno</p><h1 className="mt-1 text-2xl font-medium">Suas reposições</h1><p className="mt-2 text-sm text-gray-600">Acesso individual: {sessao.email}</p><Link href="/portal-aluno/resultados" className="mt-3 inline-block text-sm text-brand-700 underline">Ver frente acadêmica e resultados parciais</Link></div><SairPortalAluno /></header>
    <div className="mt-8 space-y-3">{reposicoes.map((reposicao) => <article key={reposicao.id} className="rounded-lg border bg-white p-4"><p className="font-medium">Reposição {reposicao.modalidade === "GRAVACAO" ? "por gravação" : "particular"}</p><p className="mt-1 text-sm text-gray-600">{reposicao.concluida ? (reposicao.dataResultado ? "Reposta em " + reposicao.dataResultado.toLocaleDateString("pt-BR", { timeZone: "UTC" }) + " (UTC)" : "Reposição concluída; data em conferência") : reposicao.autorizada ? "Acompanhamento disponível" : "Aguardando autorização"}</p><Link href={`/portal-aluno/reposicoes/${encodeURIComponent(reposicao.id)}`} className="mt-3 inline-block text-sm text-brand-700 underline">Ver reposição</Link></article>)}{!reposicoes.length && <p className="rounded-lg border bg-white p-4 text-sm text-gray-600">Não há reposições para este acesso.</p>}</div>
  </section>;
}
