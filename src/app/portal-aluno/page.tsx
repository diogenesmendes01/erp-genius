import Link from "next/link";
import { exigirSessaoPortalAlunoPagina } from "@/server/portal-aluno/sessao";
import { listarReposicoesDoPortalAluno } from "@/server/portal-aluno/reposicoes";
import { SairPortalAluno } from "./sair";
import { consultarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { EstadoVazio } from "@/components/EstadoVazio";

export const dynamic = "force-dynamic";

export default async function InicioPortalAlunoPage() {
  // Guard sequenciado ANTES do Promise.all: listarReposicoesDoPortalAluno chama o guard
  // que lança (exigirSessaoPortalAluno) internamente — rodar em paralelo criaria uma
  // corrida entre o redirect daqui e o throw de lá (quem resolve primeiro decide o
  // resultado do Promise.all). Aqui a sessão já está confirmada antes de prosseguir.
  const sessao = await exigirSessaoPortalAlunoPagina();
  const [reposicoes, preferencia] = await Promise.all([listarReposicoesDoPortalAluno(), consultarPreferenciaFusoPortalAluno()]);
  const fusoExibicao = resolverFusoExibicao(preferencia.fusoExibicao, "UTC");
  return <section className="mx-auto max-w-3xl p-6 sm:p-10"><header className="flex items-start justify-between gap-4"><div><p className="text-sm text-brand-700">Área do aluno</p><h1 className="mt-1 text-2xl font-medium">Suas reposições</h1><p className="mt-2 text-sm text-gray-600">Acesso individual: {sessao.email}</p><Link href="/portal-aluno/resultados" className="mt-3 inline-block text-sm text-brand-700 underline">Ver frente acadêmica e resultados parciais</Link><Link href="/portal-aluno/preferencias" className="ml-4 inline-block text-sm text-brand-700 underline">Preferências de horário</Link></div><SairPortalAluno /></header>
    <div className="mt-8 space-y-3">{reposicoes.map((reposicao) => <article key={reposicao.id} className="rounded-lg border bg-surface p-4"><p className="font-medium">Reposição {reposicao.modalidade === "GRAVACAO" ? "por gravação" : "particular"}</p><p className="mt-1 text-sm text-gray-600">{reposicao.concluida ? (reposicao.dataResultado ? `Reposta em ${formatarInstanteExibicao(reposicao.dataResultado, fusoExibicao, "UTC").texto} (${fusoExibicao})` : "Reposição concluída; data em conferência") : reposicao.autorizada ? "Acompanhamento disponível" : "Aguardando autorização"}</p><Link href={`/portal-aluno/reposicoes/${encodeURIComponent(reposicao.id)}`} className="mt-3 inline-block text-sm text-brand-700 underline">Ver reposição</Link></article>)}{!reposicoes.length && <EstadoVazio bloco>Não há reposições para este acesso.</EstadoVazio>}</div>
  </section>;
}
