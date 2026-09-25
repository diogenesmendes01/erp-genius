import { notFound, redirect } from "next/navigation";
import { consultarEntregaGravacaoPortalAluno, exigirReposicaoDoPortalAluno, estadoEntregaPortalAluno, type ReposicaoPortalAluno } from "@/server/portal-aluno/reposicoes";
import { EntregaGravacaoPortalAluno } from "./entrega-gravacao";
import { RelatarIndisponibilidadePortalAluno } from "./relatar-indisponibilidade";
import { VideoGravacaoPortalAluno } from "./video-gravacao";
import { autorizarReproducaoGravacao } from "@/server/gravacoes/autorizacao";
import { consultarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { ErroAutenticacao, ErroPermissao } from "@/server/_shared";
import { VoltarPara } from "@/components/VoltarPara";

export const dynamic = "force-dynamic";

export default async function ReposicaoPortalAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Mesmo padrão de .../resultados/page.tsx: o guard vive dentro de
  // exigirReposicaoDoPortalAluno (compartilhado com outras chamadas). ErroAutenticacao
  // vira redirect; ErroPermissao (reposição de outro aluno — id trocado na URL, link
  // velho, bookmark) vira notFound() — não é "sua sessão expirou" (não é isso que
  // aconteceu) nem deveria confirmar que o registro existe. ErroRegra (id ausente,
  // praticamente inalcançável por essa rota) continua subindo para error.tsx.
  let reposicao: ReposicaoPortalAluno;
  try {
    reposicao = await exigirReposicaoDoPortalAluno(id);
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) redirect("/portal-aluno/entrar");
    if (erro instanceof ErroPermissao) notFound();
    throw erro;
  }
  const [detalhe, preferencia] = await Promise.all([consultarEntregaGravacaoPortalAluno(id), consultarPreferenciaFusoPortalAluno()]);
  const fusoExibicao = resolverFusoExibicao(preferencia.fusoExibicao, "UTC");
  const data = (valor: Date | string) => formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto;
  const agora = new Date();
  const prazoAberto = !!detalhe?.prazoEtapaAte && new Date(detalhe.prazoEtapaAte) > agora && !detalhe.pausadaDesde && detalhe.disponivel;
  const estadoEntrega = estadoEntregaPortalAluno(reposicao, { prazoAberto, liberacaoEspecifica: !!detalhe?.liberacaoEspecifica });
  const correcaoPendente = detalhe?.correcoes.find((correcao) => correcao.situacao === "PENDENTE") ?? null;
  const etapaCorrecao = detalhe?.etapaEntrega === "CORRECAO";
  const motivoBloqueio = reposicao.modalidade !== "GRAVACAO" ? null
    : detalhe?.pausadaDesde ? "O material foi confirmado como indisponível. O prazo está pausado até a regularização pela escola."
    : !detalhe?.disponivel ? "O material oficial ainda não está disponível para esta reposição."
    : estadoEntrega === "PENDENTE_LIBERACAO" ? "A matrícula exige liberação específica, com prazo, antes de nova entrega."
    : estadoEntrega === "PRAZO_ENCERRADO" ? `O prazo para ${etapaCorrecao ? "responder à correção" : "enviar a entrega"} encerrou; a gestão pode registrar prorrogação com motivo.`
    : correcaoPendente ? `Há uma correção solicitada pelo professor até ${data(correcaoPendente.prazoAte)}. Envie a nova versão abaixo.`
    : null;
  const podeEntregar = estadoEntrega === "PODE_ENTREGAR" && (!detalhe?.entregas.length || etapaCorrecao);
  let podeReproduzir = false;
  if (reposicao.modalidade === "GRAVACAO") {
    try {
      await autorizarReproducaoGravacao(reposicao.id);
      podeReproduzir = true;
    } catch {
      // Histórico permanece visível; fonte e controles exigem autorização atual.
    }
  }
  return <section className="mx-auto max-w-3xl p-6 sm:p-10"><VoltarPara href="/portal-aluno" />
    <h1 className="mt-5 text-2xl font-medium">Reposição {reposicao.modalidade === "GRAVACAO" ? "por gravação" : "particular"}</h1>
    <dl className="mt-6 grid gap-3 rounded-lg border bg-surface p-5 text-sm"><div><dt className="text-gray-500">Situação</dt><dd>{reposicao.concluida ? (reposicao.dataResultado ? "Reposta em " + data(reposicao.dataResultado) : "Reposição concluída; data em conferência") : reposicao.autorizada ? "Autorizada" : "Aguardando autorização"}</dd></div><div><dt className="text-gray-500">Matrícula</dt><dd>{reposicao.statusMatricula}</dd></div></dl>
    <p className="mt-3 text-xs text-gray-500">Instantes exibidos em {fusoExibicao}.</p>
    {detalhe?.prazoEtapaAte && <p className="mt-4 text-sm text-gray-600">Prazo vigente {etapaCorrecao ? "para responder à correção" : "da entrega"}: {data(detalhe.prazoEtapaAte)}.</p>}
    {detalhe?.entregas.map((entrega) => {
      const validada = detalhe.entregaValidada?.entregaId === entrega.id;
      const correcao = detalhe.correcoes.find((item) => item.entregaId === entrega.id);
      return <article key={entrega.id} className="mt-4 rounded border bg-surface p-4 text-sm"><p className="font-medium">Entrega versão {entrega.versao} em {data(entrega.entregueEm)}</p>
        {validada && <p role="status" className="mt-2 font-medium text-green-700">Esta é a versão aprovada na reposição em {data(detalhe.entregaValidada!.validadaEm)}.</p>}
        {!validada && correcao && <p role="status" className="mt-2 text-amber-800">Esta versão foi encaminhada para correção; ela não é a versão aprovada.</p>}
        <p className="mt-2 whitespace-pre-wrap">Resumo: {entrega.resumo}</p><p className="mt-2 whitespace-pre-wrap">Atividade: {entrega.atividade}</p></article>;
    })}
    {detalhe?.correcoes.map((correcao) => {
      const entrega = detalhe.entregas.find((item) => item.id === correcao.entregaId);
      return <article key={correcao.id} className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-medium">{correcao.situacao === "PENDENTE" ? "Correção solicitada" : "Correção respondida"}{entrega ? ` para a versão ${entrega.versao}` : ""}</p><p className="mt-2 whitespace-pre-wrap">{correcao.comentario}</p><p className="mt-2">Prazo: {data(correcao.prazoAte)}</p></article>;
    })}
    {podeReproduzir && <VideoGravacaoPortalAluno reposicaoId={reposicao.id} />}
    {detalhe && reposicao.modalidade === "GRAVACAO" && <RelatarIndisponibilidadePortalAluno reposicaoId={reposicao.id} podeRelatar={podeReproduzir} relatos={detalhe.relatosIndisponibilidade} pausas={detalhe.pausasMaterial} fusoExibicao={fusoExibicao} />}
    {reposicao.modalidade === "GRAVACAO" && <EntregaGravacaoPortalAluno reposicaoId={reposicao.id} podeEntregar={podeEntregar} motivoBloqueio={motivoBloqueio} />}
  </section>;
}
