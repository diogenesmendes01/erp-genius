import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarReposicoesEquipe } from "@/server/diario/reposicao-consulta";
import { consultarOperacaoEntregaReposicao } from "@/server/diario/reposicao-entrega-operacional";
import { ReposicoesEquipe, SolicitarReposicao } from "@/app/(app)/diario/reposicoes/ReposicoesEquipe";
import type { OperacaoEntrega } from "@/app/(app)/diario/reposicoes/OperacaoEntregaReposicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function ReposicoesEquipePage({ searchParams }: { searchParams: Promise<{ matriculaId?: string; cursor?: string; origemCursor?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const podeOperarEntrega = usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO) || usuario.papeis.includes(Papel.ADMINISTRADOR);
  const { matriculaId, cursor, origemCursor } = await searchParams;
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <div className="space-y-5">
    <Link className="text-sm text-brand-700 underline" href="/academico">Voltar ao acadêmico</Link>
    {!matriculaId && <><h1 className="text-2xl font-medium">Reposições individuais</h1><p role="status">Abra esta tela pelo contexto da matrícula para consultar a ausência de origem e o histórico acadêmico.</p></>}
    {matriculaId && <Conteudo matriculaId={matriculaId} cursor={cursor} origemCursor={origemCursor} podeOperarEntrega={podeOperarEntrega} fusoExibicao={fusoExibicao} />}
  </div>;
}

async function Conteudo({ matriculaId, cursor, origemCursor, podeOperarEntrega, fusoExibicao }: { matriculaId: string; cursor?: string; origemCursor?: string; podeOperarEntrega: boolean; fusoExibicao: string }) {
  const r = await consultarReposicoesEquipe({ matriculaId, cursor, origemCursor });
  if (!r.ok) return <p role="alert">{r.erro}</p>;
  if (!r.dado) return <p role="alert">Não foi possível consultar as reposições desta matrícula.</p>;
  const dado = r.dado;
  const gravacoesAutorizadas = dado.reposicoes.filter((reposicao) => reposicao.modalidade === "GRAVACAO" && reposicao.decisao?.aprovada);
  const paines = podeOperarEntrega ? await Promise.all(gravacoesAutorizadas.map(async (reposicao) => ({
    reposicaoId: reposicao.id,
    painel: await consultarOperacaoEntregaReposicao({ reposicaoId: reposicao.id, matriculaId: dado.matricula.id }),
  }))) : [];
  const operacoes: Record<string, OperacaoEntrega> = {};
  let houveErroOperacional = false;
  for (const { reposicaoId, painel } of paines) {
    if (painel.ok && painel.dado) operacoes[reposicaoId] = painel.dado;
    else houveErroOperacional = true;
  }
  return <>
    <p className="text-sm text-gray-600">Matrícula {dado.matricula.codigo}. A frequência original permanece registrada; uma autorização não conclui nem regulariza a reposição.</p>
    {!dado.matricula.ativa && <p role="status">A matrícula não está ativa. O histórico permanece disponível, mas não há solicitação ou decisão disponível.</p>}
    {!podeOperarEntrega && gravacoesAutorizadas.length > 0 && <p role="status">Material, prazo, liberações e indisponibilidades da gravação são operados somente pela Gestão Pedagógica ou Administração.</p>}
    {houveErroOperacional && <p role="alert">Não foi possível carregar o estado operacional de uma reposição gravada. Atualize a consulta antes de operar.</p>}
    {dado.matricula.ativa && dado.origensElegiveis.length > 0 && <section className="space-y-4" aria-label="Ausências disponíveis para solicitação">
      <h2 className="text-xl font-medium">Solicitar a partir de ausência conferida</h2>
      {dado.origensElegiveis.map((origem) => {
        const rejeitadaAntes = dado.reposicoes.some((reposicao) => reposicao.origem.aulaOriginalId === origem.aulaOriginalId && reposicao.decisao && !reposicao.decisao.aprovada);
        return <div key={origem.aulaOriginalId} className="space-y-2"><SolicitarReposicao origem={{ ...origem, matriculaId: dado.matricula.id }} />{rejeitadaAntes && <p role="status" className="text-sm text-gray-600">Há pedido anterior rejeitado para esta ausência no histórico abaixo. Um novo pedido precisa de nova justificativa e seguirá nova decisão independente.</p>}</div>;
      })}
      {dado.proximoOrigemCursor && <Link className="inline-block text-sm text-brand-700 underline" href={`/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}&origemCursor=${encodeURIComponent(dado.proximoOrigemCursor)}`}>Ausências anteriores disponíveis</Link>}
    </section>}
    <ReposicoesEquipe reposicoes={dado.reposicoes} operacoes={operacoes} mostrarRelatoEquipe={!podeOperarEntrega} mostrarCorrecoes={podeOperarEntrega} fusoExibicao={fusoExibicao} />
    {dado.proximoCursor && <Link className="inline-block text-sm text-brand-700 underline" href={`/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}&cursor=${encodeURIComponent(dado.proximoCursor)}`}>Reposições anteriores</Link>}
  </>;
}
