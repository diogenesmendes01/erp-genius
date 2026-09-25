import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTrocaFonteReposicaoGravacao } from "@/server/gravacoes/troca-fonte-reposicao";
import { TrocaFonteReposicao } from "./TrocaFonteReposicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function TrocaFonteReposicaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { id } = await params;
  const [dados, preferencia] = await Promise.all([consultarTrocaFonteReposicaoGravacao({ reposicaoId: id }), consultarPreferenciaFusoEquipe()]);
  return <section className="mx-auto max-w-3xl space-y-5 p-6">
    <VoltarPara href="/diario/reposicoes" para="Reposições" />
    <header><h1 className="text-2xl font-medium">Adotar publicação corrigida na reposição</h1><p className="mt-1 text-sm text-gray-700">A gestão escolhe apenas o material desta reposição; a publicação e suas revisões são resolvidas no servidor.</p></header>
    <TrocaFonteReposicao contexto={dados.contexto} propostas={dados.propostas.map((proposta) => ({
      ...proposta,
      criadaEm: proposta.criadaEm.toISOString(),
      decisao: proposta.decisao && { ...proposta.decisao, decididaEm: proposta.decisao.decididaEm.toISOString() },
    }))} fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC")} />
  </section>;
}
