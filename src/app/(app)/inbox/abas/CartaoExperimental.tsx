import { IconCalendarCheck } from "@tabler/icons-react";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import type { OportunidadeAtualPainel } from "@/server/inbox/painel-oportunidades";

type EstadoExperimental = Pick<OportunidadeAtualPainel, "etapa" | "experimentalConfirmada">;
export function statusExperimental(o: EstadoExperimental): "Agendada" | "Confirmada" | "Realizada" | "Não compareceu" {
  if (o.etapa === "NO_SHOW") return "Não compareceu";
  if (o.etapa === "EXPERIMENTAL_REALIZADA") return "Realizada";
  return o.experimentalConfirmada ? "Confirmada" : "Agendada";
}
/** Projeção do instante persistido; edição e autorização global continuam no Funil. */
export function CartaoExperimental({ oportunidade: o, fuso, fusoEscola, podeAbrirFunil = false }: {
  oportunidade: OportunidadeAtualPainel; fuso: string | null; fusoEscola: string; podeAbrirFunil?: boolean;
}) {
  if (!o.dataExperimental) return null;
  const quando = formatarInstanteExibicao(o.dataExperimental, fuso, fusoEscola);
  return <section aria-label="Aula experimental" className="min-w-0 space-y-2 rounded-[10px] border border-gray-200 bg-surface-muted p-3">
    <div className="flex items-center gap-2"><IconCalendarCheck size={16} aria-hidden /><h4 className="flex-1 text-[13px] font-semibold">Aula experimental</h4>
      {podeAbrirFunil && <a href={"/funil?o=" + encodeURIComponent(o.id)} className="inline-flex min-h-11 items-center text-[13px] text-brand-700 underline">Editar</a>}
    </div>
    <p className="text-[13px] [overflow-wrap:anywhere]"><time dateTime={o.dataExperimental} title={"Horário em " + quando.fuso}>{quando.texto}</time> · {o.professorExperimental ?? "Sem professor"}</p>
    <span className={"inline-flex min-h-[22px] items-center rounded-full px-2 text-xs font-semibold " + (o.etapa === "NO_SHOW" ? "bg-red-50 text-red-700" : "bg-brand-bg text-brand-700")}>{statusExperimental(o)}</span>
  </section>;
}
