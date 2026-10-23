import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { formatarDataCivil } from "@/lib/data-civil";
import { ETAPA_LABEL, SETOR_ATENDIMENTO_LABEL, STATUS_COBRANCA_LABEL, rotular } from "@/lib/labels";
import type { PainelSetor as Painel } from "@/server/inbox/paineis";

const brl = (v: string) => `R$ ${v.replace(".", ",")}`;

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 py-1 text-sm"><dt className="text-gray-600">{rotulo}</dt><dd className="text-right">{children}</dd></div>;
}

/** Painel lateral por setor. Só apresenta o que o servidor já filtrou; nenhum telefone passa por aqui. */
export function PainelSetor({ painel }: { painel: Painel | null }) {
  if (!painel) return <p className="p-4 text-sm text-gray-600">Sem detalhes para este atendimento.</p>;
  return (
    <section aria-label={`Painel ${rotular(SETOR_ATENDIMENTO_LABEL, painel.setor)}`} className="p-4">
      {painel.setor === "COMERCIAL" && (painel.oportunidade
        ? <dl><Linha rotulo="Oportunidade"><Link href={`/funil?o=${encodeURIComponent(painel.oportunidade.id)}`} className="text-brand-800 underline">{painel.oportunidade.titulo}</Link></Linha><Linha rotulo="Etapa">{rotular(ETAPA_LABEL, painel.oportunidade.etapa)}</Linha>
            <Linha rotulo="Valor">{painel.oportunidade.valor ? brl(painel.oportunidade.valor) : "Sem valor"}</Linha></dl>
        : <p className="text-sm text-gray-600">Sem oportunidade visível para você.</p>)}
      {painel.setor === "FINANCEIRO" && (<>
        <dl><Linha rotulo="Matrícula">{painel.matriculaCodigo ?? "—"}</Linha></dl>
        {painel.cobrancas.length
          ? <ul className="mt-2 space-y-1 text-sm">{painel.cobrancas.map((c) => <li key={c.id} className="flex justify-between"><span>{formatarDataCivil(c.vencimento)}</span><span>{brl(c.valor)} · {rotular(STATUS_COBRANCA_LABEL, c.status)}</span></li>)}</ul>
          : <EstadoVazio className="mt-2">Nenhuma cobrança em aberto.</EstadoVazio>}
      </>)}
      {painel.setor === "SECRETARIA" && (
        <dl><Linha rotulo="Matrícula">{painel.matriculaCodigo ?? "—"}</Linha><Linha rotulo="Documentos pendentes">{painel.documentosPendentes ?? "—"}</Linha></dl>)}
      {painel.setor === "PEDAGOGICO" && (
        <dl><Linha rotulo="Turma">{painel.turma ?? "—"}</Linha><Linha rotulo="Frequência">{painel.frequenciaPct === null ? "Sem registros" : `${painel.frequenciaPct}%`}</Linha></dl>)}
    </section>
  );
}
