import Link from "next/link";
import type { ItemFilaContinuidadeMensal } from "@/server/matricula/continuidade-fila";

const ESTADO_LABEL: Record<ItemFilaContinuidadeMensal["estado"], string> = {
  AGUARDAR_PRAZO: "Aguardar prazo",
  PRONTA: "Prazo alcançado",
  OFERTA_PENDENTE: "Oferta pendente",
  INDISPONIVEL: "Indisponibilidade registrada",
  CONFERENCIA: "Confirmação de oferta necessária",
  A_CONFERIR: "Conferência necessária",
};

export function FilaContinuidadeMensal({ itens }: { itens: ItemFilaContinuidadeMensal[] }) {
  if (itens.length === 0) {
    return <p>Nenhuma matrícula precisa de acompanhamento nesta página.</p>;
  }

  return <div className="space-y-3">
    {itens.map((item) => {
      const matriculaUrl = `/matriculas/${encodeURIComponent(item.matriculaId)}`;
      return <article key={item.matriculaId} className="space-y-2 rounded border p-4">
        <h2 className="font-medium">{item.codigo ?? "Matrícula"} · {item.alunoNome}</h2>
        <p><strong>{ESTADO_LABEL[item.estado]}</strong>{item.motivo ? ` · ${item.motivo}` : ""}</p>
        {item.cobertura && <p>Cobertura prevista: {item.cobertura.inicio} a {item.cobertura.fim}.</p>}
        {item.vencimento && <p>Vencimento previsto: {item.vencimento}.</p>}
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="underline" href={`${matriculaUrl}/continuidade-mensal`}>Condições de continuidade</Link>
          <Link className="underline" href={`${matriculaUrl}/disponibilidade-oferta`}>Confirmação de oferta</Link>
          <Link className="underline" href={`${matriculaUrl}/indisponibilidade-oferta`}>Indisponibilidades</Link>
        </nav>
      </article>;
    })}
  </div>;
}
