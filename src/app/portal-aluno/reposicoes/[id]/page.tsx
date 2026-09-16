import Link from "next/link";
import { consultarEntregaGravacaoPortalAluno, exigirReposicaoDoPortalAluno, estadoEntregaPortalAluno } from "@/server/portal-aluno/reposicoes";
import { EntregaGravacaoPortalAluno } from "./entrega-gravacao";
import { RelatarIndisponibilidadePortalAluno } from "./relatar-indisponibilidade";
import { VideoGravacaoPortalAluno } from "./video-gravacao";
import { autorizarReproducaoGravacao } from "@/server/gravacoes/autorizacao";

export const dynamic = "force-dynamic";

export default async function ReposicaoPortalAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reposicao = await exigirReposicaoDoPortalAluno(id);
  const detalhe = await consultarEntregaGravacaoPortalAluno(id);
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
    : correcaoPendente ? `Há uma correção solicitada pelo professor até ${new Date(correcaoPendente.prazoAte).toLocaleString("pt-BR")}. Envie a nova versão abaixo.`
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
  return <section className="mx-auto max-w-3xl p-6 sm:p-10"><Link href="/portal-aluno" className="text-sm text-brand-700 underline">Voltar às reposições</Link>
    <h1 className="mt-5 text-2xl font-medium">Reposição {reposicao.modalidade === "GRAVACAO" ? "por gravação" : "particular"}</h1>
    <dl className="mt-6 grid gap-3 rounded-lg border bg-white p-5 text-sm"><div><dt className="text-gray-500">Situação</dt><dd>{reposicao.concluida ? (reposicao.dataResultado ? "Reposta em " + reposicao.dataResultado.toLocaleDateString("pt-BR", { timeZone: "UTC" }) + " (UTC)" : "Reposição concluída; data em conferência") : reposicao.autorizada ? "Autorizada" : "Aguardando autorização"}</dd></div><div><dt className="text-gray-500">Matrícula</dt><dd>{reposicao.statusMatricula}</dd></div></dl>
    {detalhe?.prazoEtapaAte && <p className="mt-4 text-sm text-gray-600">Prazo vigente {etapaCorrecao ? "para responder à correção" : "da entrega"}: {new Date(detalhe.prazoEtapaAte).toLocaleString("pt-BR")}.</p>}
    {detalhe?.entregas.map((entrega) => {
      const validada = detalhe.entregaValidada?.entregaId === entrega.id;
      const correcao = detalhe.correcoes.find((item) => item.entregaId === entrega.id);
      return <article key={entrega.id} className="mt-4 rounded border bg-white p-4 text-sm"><p className="font-medium">Entrega versão {entrega.versao} em {new Date(entrega.entregueEm).toLocaleString("pt-BR")}</p>
        {validada && <p role="status" className="mt-2 font-medium text-green-700">Esta é a versão aprovada na reposição em {new Date(detalhe.entregaValidada!.validadaEm).toLocaleString("pt-BR")}.</p>}
        {!validada && correcao && <p role="status" className="mt-2 text-amber-800">Esta versão foi encaminhada para correção; ela não é a versão aprovada.</p>}
        <p className="mt-2 whitespace-pre-wrap">Resumo: {entrega.resumo}</p><p className="mt-2 whitespace-pre-wrap">Atividade: {entrega.atividade}</p></article>;
    })}
    {detalhe?.correcoes.map((correcao) => {
      const entrega = detalhe.entregas.find((item) => item.id === correcao.entregaId);
      return <article key={correcao.id} className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm"><p className="font-medium">{correcao.situacao === "PENDENTE" ? "Correção solicitada" : "Correção respondida"}{entrega ? ` para a versão ${entrega.versao}` : ""}</p><p className="mt-2 whitespace-pre-wrap">{correcao.comentario}</p><p className="mt-2">Prazo: {new Date(correcao.prazoAte).toLocaleString("pt-BR")}</p></article>;
    })}
    {podeReproduzir && <VideoGravacaoPortalAluno reposicaoId={reposicao.id} />}
    {detalhe && reposicao.modalidade === "GRAVACAO" && <RelatarIndisponibilidadePortalAluno reposicaoId={reposicao.id} podeRelatar={podeReproduzir} relatos={detalhe.relatosIndisponibilidade} pausas={detalhe.pausasMaterial} />}
    {reposicao.modalidade === "GRAVACAO" && <EntregaGravacaoPortalAluno reposicaoId={reposicao.id} podeEntregar={podeEntregar} motivoBloqueio={motivoBloqueio} />}
  </section>;
}
