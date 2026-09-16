import { z } from "zod";
const Schema = z.object({ fusoInstitucional: z.string().optional(), contratos: z.array(z.object({ agendaEncerramento: z.object({ pendencias: z.array(z.string()) }).optional(), impactosAcademicos: z.object({ matriculaId: z.string(), status: z.string(),
  vinculos: z.array(z.object({ id: z.string(), turmaId: z.string(), ativa: z.boolean() })),
  encontrosParticulares: z.array(z.object({ id: z.string(), inicio: z.string(), fusoOrigem: z.string(), status: z.string() })),
}).optional() })) });
export function ImpactosAcademicosAcerto({ snapshot }: { snapshot: unknown }) {
  const r = Schema.safeParse(snapshot);
  if (!r.success) return null;
  return <div className="space-y-2"><p>Fuso do acerto: {r.data.fusoInstitucional ?? "ausente nesta versão; prepare nova conferência"}.</p>{r.data.contratos.map((c, i) => {
    const a = c.impactosAcademicos;
    if (!a) return <p key={i}>Esta versão não contém a conferência acadêmica. Prepare uma nova versão antes de efetivar.</p>;
    return <details key={a.matriculaId}><summary>Vínculos e agenda da matrícula · {a.vinculos.filter(v => v.ativa).length} vínculo(s) ativo(s)</summary>
      <ul className="text-amber-800">{c.agendaEncerramento?.pendencias.map(p => <li key={p}>{p}</li>)}</ul><p>Alterações nestes vínculos ou encontros exigem nova conferência. O acerto ainda não encerrou vínculos nem cancelou aulas.</p>
      <ul>{a.vinculos.map(v => <li key={v.id}>Turma {v.turmaId} · {v.ativa ? "Vínculo ativo" : "Vínculo histórico"}</li>)}</ul>
      <ul>{a.encontrosParticulares.map(e => <li key={e.id}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: e.fusoOrigem }).format(new Date(e.inicio))} ({e.fusoOrigem}) · {e.status}</li>)}</ul>
    </details>;
  })}</div>;
}
