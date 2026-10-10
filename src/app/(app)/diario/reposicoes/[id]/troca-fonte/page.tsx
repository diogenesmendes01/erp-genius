import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTrocaFonteReposicaoGravacao } from "@/server/gravacoes/troca-fonte-reposicao";
import { consultarIdentificacaoReposicao } from "@/server/identificacao-registro";
import { TrocaFonteReposicao } from "./TrocaFonteReposicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

// Quem aprova a troca (irreversível) vê de qual reposição e de quem se trata (docs/42 L1989; docs/43 §6
// item 7): aluno, matrícula e a aula de origem — o `contexto` só trazia ids.
export default async function TrocaFonteReposicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { id } = await params;
  const [dados, preferencia] = await Promise.all([consultarTrocaFonteReposicaoGravacao({ reposicaoId: id }), consultarPreferenciaFusoEquipe()]);
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const identificacao = await consultarIdentificacaoReposicao(usuario, { reposicaoId: dados.contexto.reposicaoId, matriculaId: dados.contexto.matriculaId });
  return <section className="mx-auto max-w-3xl space-y-5 p-6">
    <VoltarPara href="/diario/reposicoes" />
    <header><h1 className="text-2xl font-medium">Adotar publicação corrigida na reposição</h1><p className="mt-1 text-sm text-gray-700">A gestão escolhe apenas o material desta reposição; a publicação e suas revisões são resolvidas no servidor.</p></header>
    {identificacao && <IdentificacaoRegistro rotulo="Aluno e reposição desta troca" dados={{
      aluno: identificacao.aluno, alunoHref: `/alunos/${encodeURIComponent(identificacao.alunoId)}`, matriculaCodigo: identificacao.codigo, matriculaComplemento: identificacao.produto,
      registro: [`Reposição por gravação da aula de ${formatarInstanteExibicao(identificacao.aulaOrigemInicio, fusoExibicao, "UTC").texto} (${fusoExibicao})${identificacao.turma ? ` · turma ${identificacao.turma}` : ""}`],
    }} />}
    <TrocaFonteReposicao contexto={dados.contexto} propostas={dados.propostas.map((proposta) => ({
      ...proposta,
      criadaEm: proposta.criadaEm.toISOString(),
      decisao: proposta.decisao && { ...proposta.decisao, decididaEm: proposta.decisao.decididaEm.toISOString() },
    }))} fusoExibicao={fusoExibicao} />
  </section>;
}
