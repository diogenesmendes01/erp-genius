import type { ReplanejamentoSnapshot } from "@/server/agenda/replanejamento-snapshot";

type Conteudo = Pick<ReplanejamentoSnapshot, "revisoes" | "recursos" | "pendencias"> & { particulares: readonly unknown[]; recuperacoes?: readonly unknown[] };
export function ConteudoRevisao({ r, historico = false }: { r: Conteudo; historico?: boolean }) {
  const nome = (encontroId: string) => {
    const turma = r.revisoes.find((t) => t.previsao?.propostas.some((p) => p.encontroId === encontroId));
    const indice = turma?.previsao?.propostas.findIndex((p) => p.encontroId === encontroId);
    return turma ? `${turma.codigo ?? "Turma sem código"}, encontro ${(indice ?? 0) + 1}` : "Encontro fora da grade revisada";
  };
  const data = (v: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(v));
  return <>
    <section className="space-y-2 rounded border p-4"><h2 className="font-medium">{historico ? "Pendências registradas na conferência" : "Conferências pendentes"}</h2>
      {r.pendencias.map((p) => <p key={p}>{p}</p>)}
      <p>{r.recursos.internos.length} conflitos entre propostas · {r.recursos.externos.length} conflitos com encontros existentes · {r.recursos.indisponibilidades.length} indisponibilidades · {r.recursos.semDocenteApto.length} encontros sem docente apto</p>
    </section>
    {!r.revisoes.length && <p>Nenhuma turma com encontro previsto futuro encontrada.</p>}
    {r.revisoes.map((t) => <section key={t.turmaId} className="space-y-3 rounded border bg-[var(--surface)] p-4">
      <h2 className="text-lg font-medium">{t.codigo ?? "Turma sem código"}</h2>
      {t.fusoOrigem && <p>Fuso: {t.fusoOrigem}</p>}
      {t.pendencias.map((p) => <p role="alert" key={p}>{p}</p>)}
      {t.previsao && t.fusoOrigem && <>
        <p>{t.previsao.propostas.filter((p) => p.alterado).length} encontros com alteração · {t.previsao.preservados.length} registros preservados</p>
        {t.previsao.previsaoTermino && <p>Previsão de término proposta: {data(t.previsao.previsaoTermino, t.fusoOrigem)}</p>}
        <ol className="space-y-3">{t.previsao.propostas.map((p, i) => {
          const internos = r.recursos.internos.filter((c) => c.primeiro === p.encontroId || c.segundo === p.encontroId);
          return <li key={p.encontroId} className="rounded border p-3">
            <h3 className="font-medium">Encontro {i + 1} · {p.alterado ? "Data proposta alterada" : "Horário mantido"}</h3>
            <p>{historico ? "Na conferência" : "Atual"}: {data(p.inicioAnterior, t.fusoOrigem!)} a {data(p.fimAnterior, t.fusoOrigem!)}</p>
            <p>Proposta: {data(p.inicioProposto, t.fusoOrigem!)} a {data(p.fimProposto, t.fusoOrigem!)}</p>
            {p.motivoAjuste && <p>Motivo do ajuste: {p.motivoAjuste}</p>}
            {!!p.periodosNaoLetivos?.length && <p className="text-red-700">Atinge período não letivo; exige decisão explícita da exceção deste encontro.</p>}
            {internos.map((c, j) => <p key={j} className="text-red-700">Conflito com {nome(c.primeiro === p.encontroId ? c.segundo : c.primeiro)}.</p>)}
            {r.recursos.externos.some((c) => c.encontroPropostoId === p.encontroId) && <p className="text-red-700">Conflito com encontro que permanece na agenda.</p>}
            {r.recursos.indisponibilidades.some((c) => c.encontroId === p.encontroId) && <p className="text-red-700">Professor indisponível no horário proposto.</p>}
            {r.recursos.semDocenteApto.includes(p.encontroId) && <p className="text-red-700">É necessário conferir a atribuição de um professor ativo.</p>}
          </li>;
        })}</ol>
        <details><summary>Registros preservados</summary><ul>{t.previsao.preservados.map((e) => <li key={e.id}>{data(e.inicio, t.fusoOrigem!)} a {data(e.fim, t.fusoOrigem!)} · {({ PREVISTO: "Previsto", MINISTRADO: "Ministrado", CANCELADO: "Cancelado", NAO_REALIZADO: "Não realizado", IMPEDIDO_ESCOLA: "Impedido pela escola", RASCUNHO: "Rascunho" })[e.status]}</li>)}</ul></details>
      </>}
    </section>)}
    {!!r.particulares.length && <section className="space-y-2 rounded border p-4"><h2 className="font-medium">Particulares para conferência</h2>
      <p>{r.particulares.length} encontros individuais {historico ? "constavam sem remarcação nesta revisão" : "permanecem nos horários atuais"}. Sua revisão precisa respeitar o que foi contratado.</p>
    </section>}
    {!!r.recuperacoes?.length && <section className="space-y-2 rounded border p-4"><h2 className="font-medium">Recuperações para conferência</h2>
      <p>{r.recuperacoes.length} avaliações {historico ? "constavam nesta revisão" : "aguardam revisão dos horários"}. Conferir avaliadores e prazos dos planos. A revisão não altera cobrança nem consome tentativas.</p>
    </section>}
  </>;
}
