import Link from "next/link";
import { Papel } from "@prisma/client";
import { nomeCompleto } from "@/lib/nome";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCasoRevisaoProgressao } from "@/server/avaliacoes/revisao-progressao-consulta";
import { listarPropostasResolucaoRevisaoProgressao } from "@/server/avaliacoes/resolucao-revisao-progressao";
import { ResolucaoRevisaoProgressao } from "./ResolucaoRevisaoProgressao";

const statusMudanca = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  EXECUTADA: "Executada",
  CANCELADA: "Cancelada",
  REJEITADA: "Rejeitada",
};

const acoesResolucao = {
  REGISTRAR_CANCELAMENTO: "Cancelamento da solicitação registrado",
  RECONFIRMAR_EXECUTADA: "Execução reconfirmada com novo fechamento suficiente",
  ENCAMINHAR_REGULARIZACAO: "Encaminhamento para regularização acadêmica registrado",
};

function dataLegivel(data: Date) {
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export default async function DetalheRevisaoProgressaoPage({ params, searchParams }: { params: Promise<{ casoId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { casoId } = await params;
  const resultado = await consultarCasoRevisaoProgressao({ casoId });
  if (!resultado.ok || !resultado.dado) {
    return <section className="space-y-4"><Link className="underline" href="/academico/correcoes">Voltar às revisões</Link><p role="alert">{resultado.ok ? "Caso indisponível." : resultado.erro}</p></section>;
  }

  const caso = resultado.dado;
  const origem = caso.origem.tipo === "AULA" ? caso.origem.labelAula ?? "Correção de aula" : caso.origem.tipo === "REPOSICAO" ? caso.origem.labelReposicao ?? "Correção da conclusão de reposição" : caso.origem.tipo === "RECUPERACAO" ? "Correção de nota de recuperação" : "Correção de avaliação regular";
  const turmaOrigem = caso.solicitacao.turmaOrigem.nome ?? caso.solicitacao.turmaOrigem.codigo ?? "Turma de origem";
  const turmaDestino = caso.solicitacao.turmaDestino.nome ?? caso.solicitacao.turmaDestino.codigo ?? "Turma de destino";
  const paginaInformada = Number((await searchParams).pagina ?? 1);
  const pagina = Number.isInteger(paginaInformada) && paginaInformada > 0 && paginaInformada <= 100000 ? paginaInformada : 1;
  const historico = await listarPropostasResolucaoRevisaoProgressao({ solicitacaoId: caso.solicitacao.id, pagina });

  return <section className="space-y-5">
    <Link className="underline" href="/academico/correcoes">Voltar às revisões</Link>
    <header className="space-y-2"><h1 className="text-2xl font-medium">Revisão de impacto da correção</h1>
      <p>{nomeCompleto(caso.matricula.aluno)} · {caso.matricula.codigo ?? "Matrícula sem código"}</p>
    </header>

    <article className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Histórico</h2>
      <p>{origem}. Caso registrado em {dataLegivel(caso.criadaEm)} UTC.</p>
      <p>Na data da correção, a mudança acadêmica estava {statusMudanca[caso.statusNaCorrecao].toLowerCase()}.</p>
      <p>Trajeto informado: {turmaOrigem} para {turmaDestino}.</p>
      {caso.origem.tipo === "REPOSICAO" && caso.origem.reposicaoId && caso.origem.conclusaoVersao && <Link className="inline-block underline" href={`/academico/reposicoes/correcoes/${encodeURIComponent(caso.origem.reposicaoId)}?conclusaoVersao=${encodeURIComponent(String(caso.origem.conclusaoVersao))}`}>Conferir a conclusão de reposição corrigida</Link>}
      {caso.origem.tipo === "AULA" && caso.origem.encontroId && <Link className="inline-block underline" href={`/diario/encontros/${encodeURIComponent(caso.origem.encontroId)}/correcao`}>Conferir o histórico da aula corrigida</Link>}
    </article>

    <article className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Situação atual</h2>
      <p>A solicitação de mudança está {statusMudanca[caso.solicitacao.status].toLowerCase()}.</p>
      {caso.situacao === "PENDENTE_REVISAO" && <p role="status">A revisão pedagógica ainda está pendente. A correção não desfaz automaticamente uma mudança acadêmica já registrada.</p>}
    </article>

    {caso.situacao === "RESOLVIDA" && caso.resolucao && <article className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Resultado da revisão</h2>
      <p role="status">Revisão resolvida.</p>
      <p>{acoesResolucao[caso.resolucao.acao]}.</p>
      {caso.resolucao.decisao
        ? <><p>Decisão registrada em {dataLegivel(caso.resolucao.decisao.decididaEm)} UTC.</p><p className="whitespace-pre-wrap">Motivo: {caso.resolucao.decisao.motivo}</p></>
        : <p>O registro da decisão não está disponível para consulta.</p>}
    </article>}

    {historico.ok && historico.dado
      ? <><ResolucaoRevisaoProgressao key={`${caso.solicitacao.id}:${caso.solicitacao.status}:${caso.situacao}:${historico.dado.itens[0]?.versao ?? 0}`} solicitacaoId={caso.solicitacao.id} statusSolicitacao={caso.solicitacao.status} propostas={historico.dado.itens} permitirPreparacao={caso.situacao === "PENDENTE_REVISAO"} />
        <nav aria-label="Páginas do histórico de resoluções" className="flex gap-4">{historico.dado.pagina > 1 && <Link className="underline" href={`?pagina=${historico.dado.pagina - 1}`}>Anterior</Link>}<span>Página {historico.dado.pagina}</span>{historico.dado.temMais && <Link className="underline" href={`?pagina=${historico.dado.pagina + 1}`}>Próxima</Link>}</nav></>
      : <p role="alert">{historico.ok ? "Histórico de resoluções indisponível." : historico.erro}</p>}
  </section>;
}
