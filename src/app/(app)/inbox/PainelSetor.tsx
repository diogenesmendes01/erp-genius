import type { PainelSetor as Painel } from "@/server/inbox/paineis";

const brl = (v: string) => `R$ ${v.replace(".", ",")}`;

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 py-1 text-sm"><dt className="text-muted-foreground">{rotulo}</dt><dd className="text-right">{children}</dd></div>;
}

/** Painel lateral por setor. Só apresenta o que o servidor já filtrou; nenhum telefone passa por aqui. */
export function PainelSetor({ painel }: { painel: Painel | null }) {
  if (!painel) return <p className="p-4 text-sm text-muted-foreground">Sem detalhes para este atendimento.</p>;
  return (
    <section aria-label={`Painel ${painel.setor}`} className="p-4">
      {painel.setor === "COMERCIAL" && (painel.oportunidade
        ? <dl><Linha rotulo="Oportunidade">{painel.oportunidade.titulo}</Linha><Linha rotulo="Etapa">{painel.oportunidade.etapa}</Linha>
            <Linha rotulo="Valor">{painel.oportunidade.valor ? brl(painel.oportunidade.valor) : "Sem valor"}</Linha></dl>
        : <p className="text-sm text-muted-foreground">Sem oportunidade visível para você.</p>)}
      {painel.setor === "FINANCEIRO" && (<>
        <dl><Linha rotulo="Matrícula">{painel.matriculaCodigo ?? "—"}</Linha></dl>
        {painel.cobrancas.length
          ? <ul className="mt-2 space-y-1 text-sm">{painel.cobrancas.map((c) => <li key={c.id} className="flex justify-between"><span>{c.vencimento}</span><span>{brl(c.valor)} · {c.status}</span></li>)}</ul>
          : <p className="mt-2 text-sm text-muted-foreground">Nenhuma cobrança em aberto.</p>}
      </>)}
      {painel.setor === "SECRETARIA" && (
        <dl><Linha rotulo="Matrícula">{painel.matriculaCodigo ?? "—"}</Linha><Linha rotulo="Documentos pendentes">{painel.documentosPendentes}</Linha></dl>)}
      {painel.setor === "PEDAGOGICO" && (
        <dl><Linha rotulo="Turma">{painel.turma ?? "—"}</Linha><Linha rotulo="Frequência">{painel.frequenciaPct === null ? "Sem registros" : `${painel.frequenciaPct}%`}</Linha></dl>)}
    </section>
  );
}
