import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarRevisoesPorCorrecao } from "@/server/avaliacoes/revisoes-pendentes";
import { nomeCompleto } from "@/lib/nome";
import { PrepararCasosHistoricos } from "./PrepararCasosHistoricos";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
const estados = { PENDENTE: "Pendente", APROVADA: "Aprovada", EXECUTADA: "Executada", CANCELADA: "Cancelada", REJEITADA: "Rejeitada" };
export default async function RevisoesCorrecoesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const p = Number((await searchParams).pagina ?? 1);
  const [r, preferencia] = await Promise.all([
    listarRevisoesPorCorrecao({ pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-5"><h1 className="text-2xl font-medium">Revisões após correções acadêmicas</h1>
    <p>Correções de avaliações regulares, recuperação, aulas e conclusão de reposição que encontraram mudanças acadêmicas aprovadas ou executadas. A correção não desfaz a movimentação do aluno.</p>
    <p>Confira as notas corrigidas e os registros da mudança acadêmica para acompanhar cada caso.</p>
    {!d.itens.length && <p>Nenhum caso identificado.</p>}
    {d.itens.map(i => <article key={`${i.tipo}:${i.id}:${i.matricula.id}`} className="space-y-3 rounded border p-4"><h2 className="text-lg font-medium">{nomeCompleto(i.matricula.aluno)} · {i.matricula.codigo ?? "Matrícula sem código"}</h2>
      <p>{i.tipo === "AULA" ? i.labelAula ?? `Correção de aula — versão ${i.versaoCorrecao}` : i.tipo === "REPOSICAO" ? `${i.labelReposicao ?? "Conclusão de reposição"}: correção ${i.versaoCorrecao}` : i.tipo === "RECUPERACAO" ? `Recuperação: correção ${i.versaoCorrecao} de ${i.codigoAvaliacao}` : `Avaliação regular: correção ${i.versaoCorrecao} de ${i.codigoAvaliacao}`}, aplicada por {i.decisor} em {formatarInstanteExibicao(i.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p><p className="whitespace-pre-wrap">{i.motivo}</p>
      {i.impactos.map(m => <div key={m.solicitacaoId} className="rounded border p-3"><p>Destino: {m.destino ? `${m.destino.nome ?? m.destino.codigo ?? "Turma"} · ${m.destino.nivel.idioma.nome} ${m.destino.nivel.codigo}` : "Vínculo precisa de conferência"}</p>
        <p>Situação na correção: {estados[m.statusNaCorrecao]}. Situação atual: {m.statusAtual ? estados[m.statusAtual] : "Não localizada"}.</p>
        {m.casoId && <Link className="underline" href={`/academico/correcoes/revisoes/${encodeURIComponent(m.casoId)}`}>Ver situação da revisão</Link>}
      </div>)}
      {(i.tipo === "REGULAR" || i.tipo === "RECUPERACAO") && i.impactos.some(m => !m.casoId) && <PrepararCasosHistoricos tipo={i.tipo} decisaoId={i.id} />}
      <nav className="flex gap-4"><Link className="underline" href={i.tipo === "AULA" ? `/diario/encontros/${encodeURIComponent(i.encontroId!)}/correcao` : i.tipo === "REPOSICAO" ? `/academico/reposicoes/correcoes/${encodeURIComponent(i.reposicaoId!)}?conclusaoVersao=${encodeURIComponent(String(i.conclusaoVersao!))}` : i.tipo === "RECUPERACAO" ? `/academico/recuperacoes/correcoes/${encodeURIComponent(i.notaRecuperacaoId!)}` : `/academico/correcoes/${encodeURIComponent(i.lancamentoId!)}`}>{i.tipo === "AULA" ? "Conferir histórico da aula" : i.tipo === "REPOSICAO" ? "Conferir conclusão e correções" : "Conferir notas e correções"}</Link>
        <Link className="underline" href={`/alunos/${encodeURIComponent(i.matricula.alunoId)}/academico?matriculaId=${encodeURIComponent(i.matricula.id)}`}>Acompanhar mudanças desta matrícula</Link></nav>
    </article>)}
    <nav aria-label="Páginas de revisões" className="flex gap-4">{d.pagina > 1 && <Link href={`?pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
