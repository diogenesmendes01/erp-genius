import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarMigracoesRegra, consultarPreparacaoMigracao } from "@/server/avaliacoes/migracao-regra";
import { ResumoRegra, type ConteudoRegra } from "../../[nivelId]/ResumoRegra";
import { DecidirMigracao, ProporMigracao } from "./Formularios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

const nomesCampos: Record<keyof ConteudoRegra, string> = {
  titulo: "Título", aplicacao: "Condições de aplicação", escala: "Escala de notas", minimoGeral: "Mínimo da média geral",
  frequenciaMinimaPercentual: "Frequência mínima", habilidades: "Pesos, mínimos e limites por habilidade",
  avaliacoes: "Avaliações, pesos e segundas chamadas", recuperacao: "Prazos de recuperação", segundaChamada: "Prazos de segunda chamada",
};
type Versao = { versao: number; conteudo: ConteudoRegra };
function Comparacao({ origem, destino, alteracoes, encontros, alocacoes }: { origem: Versao | null; destino: Versao;
  alteracoes: (keyof ConteudoRegra)[]; encontros: number; alocacoes: number }) {
  return <div className="space-y-3">
    <p>{encontros} encontros registrados e {alocacoes} alocações ativas na revisão.</p>
    <p>{alteracoes.length ? `Campos alterados: ${alteracoes.map(c => nomesCampos[c]).join("; ")}.` : "Conteúdo equivalente; a referência da versão será atualizada."}</p>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="space-y-2 rounded border p-3"><h3 className="font-medium">Origem {origem ? `— versão ${origem.versao}` : "— sem regra vinculada"}</h3>{origem ? <ResumoRegra conteudo={origem.conteudo} /> : <p>Primeira vinculação sujeita à aprovação.</p>}</section>
      <section className="space-y-2 rounded border p-3"><h3 className="font-medium">Destino — versão {destino.versao}</h3><ResumoRegra conteudo={destino.conteudo} /></section>
    </div>
  </div>;
}

export default async function MigracaoPage({ params, searchParams }: { params: Promise<{ turmaId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { turmaId } = await params; const p = Number((await searchParams).pagina ?? 1);
  const base = await consultarPreparacaoMigracao({ turmaId });
  if (!base.ok || !base.dado) return <p role="alert">{base.ok ? "Consulta indisponível." : base.erro}</p>;
  const [historico, preferencia] = await Promise.all([
    consultarMigracoesRegra({ turmaId, pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!historico.ok || !historico.dado) return <p role="alert">{historico.ok ? "Histórico indisponível." : historico.erro}</p>;
  const d = base.dado, h = historico.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-6">
    <nav className="flex gap-4"><Link className="underline" href="/configuracao/turmas">Turmas</Link><Link className="underline" href={`/academico/regras/${d.turma.nivelId}`}>Regras do nível</Link></nav>
    <h1 className="text-2xl font-medium">Regras da turma {d.turma.nome ?? d.turma.codigo ?? "selecionada"}</h1>
    <p>{d.turma.nivel.idioma.nome} — {d.turma.nivel.codigo}. {d.turma.regraAvaliacao ? `Versão vinculada: ${d.turma.regraAvaliacao.versao}.` : "Nenhuma regra vinculada."}</p>
    {d.pendencia && <p role="status" className="rounded border p-3">{d.pendencia}</p>}
    {d.revisao && <section className="space-y-4"><h2 className="text-xl font-medium">Nova proposta de mudança</h2>
      <Comparacao origem={d.revisao.origem} destino={d.revisao.destino} alteracoes={d.revisao.alteracoes} encontros={d.revisao.encontrosRevisados} alocacoes={d.revisao.alocacoesAtivasRevisadas} />
      <ProporMigracao key={`${d.revisao.estadoHash}:${d.revisao.versaoEsperada}`} turmaId={turmaId} destinoId={d.revisao.destino.id} estadoHash={d.revisao.estadoHash} versaoEsperada={d.revisao.versaoEsperada} />
    </section>}
    <Link className="underline" href={`/academico/regras/turmas/${turmaId}/historica`}>Conferência e histórico de regra legada</Link>
    <h2 className="text-xl font-medium">Histórico de propostas</h2>
    {!h.propostas.length && <p>Nenhuma mudança proposta.</p>}
    {h.propostas.map(v => <article key={v.id} className="space-y-4 rounded border p-4">
      <h3 className="text-lg font-medium">Proposta {v.versao} — {v.decisao ? v.decisao.aprovada ? "Aplicada" : "Rejeitada" : "Aguardando decisão"}</h3>
      <p>Preparada por {v.preparador.nome} em {formatarInstanteExibicao(v.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p><p className="whitespace-pre-wrap">{v.motivo}</p>
      <Comparacao origem={v.origem} destino={v.destino} alteracoes={v.alteracoes} encontros={v.encontrosRevisados} alocacoes={v.alocacoesAtivasRevisadas} />
      {v.pendencia && <p role="status" className="font-medium text-amber-800">{v.pendencia}</p>}
      {v.decisao && <p className="whitespace-pre-wrap">Decisão de {v.decisao.decisor.nome} em {formatarInstanteExibicao(v.decisao.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC): {v.decisao.motivo}</p>}
      {v.podeDecidir && <DecidirMigracao propostaId={v.id} estadoHash={v.estadoHash} podeAprovar={v.podeAprovar} />}
      {!v.decisao && !v.podeDecidir && <p>Outra pessoa autorizada precisa registrar a decisão.</p>}
    </article>)}
    <nav aria-label="Páginas de propostas" className="flex gap-4">{h.pagina > 1 && <Link href={`?pagina=${h.pagina - 1}`}>Anterior</Link>}<span>Página {h.pagina}</span>{h.temProxima && <Link href={`?pagina=${h.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
