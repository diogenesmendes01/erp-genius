import type { EtapaLead } from "@prisma/client";
import { IconBriefcase, IconPlus } from "@tabler/icons-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { botaoClasses } from "@/components/Botao";
import { rotular, SITUACAO_OUTRA_OPORTUNIDADE_LABEL } from "@/lib/labels";
import { formatarMoedaOuIndefinida } from "@/lib/dinheiro";
import type { OutraOportunidadePainel } from "@/server/inbox/painel-oportunidades";

export function situacaoOutra(etapa: EtapaLead): string { return rotular(SITUACAO_OUTRA_OPORTUNIDADE_LABEL, etapa); }
export function hrefNovaOportunidade(pessoaId: string): string { return "/funil?nova=" + encodeURIComponent(pessoaId); }
export function OutrasOportunidades({ outras, pessoaId, podeCriar, verContato, podeAbrirFunil = false }: {
  outras: OutraOportunidadePainel[]; pessoaId: string | null; podeCriar: boolean; verContato: boolean; podeAbrirFunil?: boolean;
}) {
  return <section aria-label="Outras oportunidades deste contato" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Outras oportunidades deste contato</h3>
      {verContato && pessoaId && <a className="text-xs text-brand-700 underline" href={"/contatos?c=" + encodeURIComponent(pessoaId)}>Ver no contato</a>}
    </div>
    {outras.length ? <ul className="space-y-2">{outras.map(o => <li key={o.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border-soft bg-surface-muted p-3 text-sm">
      <IconBriefcase size={17} className="shrink-0 text-gray-500" aria-hidden />
      <div className="min-w-0 flex-1"><p className="[overflow-wrap:anywhere]">{podeAbrirFunil ? <a href={"/funil?o=" + encodeURIComponent(o.id)} className="text-brand-700 underline">{o.titulo}</a> : o.titulo}</p><p className="text-xs text-gray-600">{situacaoOutra(o.etapa)}</p></div>
      <span className="shrink-0 font-mono text-xs">{o.valor === null ? "Sem valor" : formatarMoedaOuIndefinida(o.valor, o.moeda)}</span>
    </li>)}</ul> : <EstadoVazio>Nenhuma outra. Rematrícula ou novo curso geram uma nova oportunidade.</EstadoVazio>}
    {podeCriar && pessoaId && <a href={hrefNovaOportunidade(pessoaId)} className={botaoClasses({ variante: "fantasma", tamanho: "md" }) + " w-full gap-2 border border-dashed border-border-soft"}><IconPlus size={17} aria-hidden />Nova oportunidade</a>}
  </section>;
}
