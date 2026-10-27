import { IconBuilding } from "@tabler/icons-react";
import { Avatar, tomDoAvatar } from "@/components/Avatar";
import { PAPEL_PARTICIPANTE_LABEL } from "@/lib/labels";
import type { BlocoB2BPainel } from "@/server/inbox/painel-detalhes";

export function BlocoB2B({ bloco, verEmpresa }: { bloco: BlocoB2BPainel; verEmpresa: boolean }) {
  return <section aria-label="Contatos da empresa" className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <IconBuilding size={16} className="shrink-0 text-brand-700" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[13px] font-semibold [overflow-wrap:anywhere]">{bloco.empresa.nome}</span>
      {verEmpresa && <a className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-brand-700 underline-offset-4 hover:underline" href={`/empresas/${encodeURIComponent(bloco.empresa.id)}`}>Ver empresa</a>}
    </div>
    <p className="text-xs text-gray-600">Contatos nesta oportunidade</p>
    {bloco.participantes.map(p => <div key={p.pessoaId} className={`grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-2 ${p.naConversa ? "border-brand-solid" : "border-gray-200"}`}>
      <Avatar nome={p.nome} tamanho={32} tom={tomDoAvatar(p.pessoaId)} />
      <div className="min-w-0 leading-[1.3] [overflow-wrap:anywhere]">
        <p className="text-[13px] font-medium">{p.nome}</p>
        <p className="text-[11.5px] text-gray-600">{PAPEL_PARTICIPANTE_LABEL[p.papel]} · {p.cargo ?? "—"}</p>
      </div>
      {p.naConversa ? <span className="text-[11.5px] font-semibold text-brand-700">Na conversa</span> : p.hrefConversa ? <a href={p.hrefConversa} className="inline-flex min-h-11 items-center justify-center rounded-[7px] border border-gray-200 px-2 text-xs hover:bg-surface-muted">Falar com</a> : null}
    </div>)}
  </section>;
}
