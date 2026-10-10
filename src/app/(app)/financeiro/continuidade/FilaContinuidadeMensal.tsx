import Link from "next/link";
import type { ItemFilaContinuidadeMensal } from "@/server/matricula/continuidade-fila";
import { formatarDataCivil } from "@/lib/data-civil";
import { EstadoVazio } from "@/components/EstadoVazio";

const ESTADO_LABEL: Record<ItemFilaContinuidadeMensal["estado"], string> = {
  AGUARDAR_PRAZO: "Aguardar prazo",
  PRONTA: "Prazo alcançado",
  OFERTA_PENDENTE: "Oferta pendente",
  INDISPONIVEL: "Indisponibilidade registrada",
  CONFERENCIA: "Confirmação de oferta necessária",
  A_CONFERIR: "Conferência necessária",
};

/** `inicioDaFila`: link do início quando a leitura partiu de um cursor (fora do início); null no início, onde vazio quer dizer fila zerada. */
export function FilaContinuidadeMensal({ itens, inicioDaFila }: { itens: ItemFilaContinuidadeMensal[]; /** Obrigatório: esquecer o repasse faria um ponto da fila sem itens afirmar fila zerada. */ inicioDaFila: string | null }) {
  if (itens.length === 0) {
    return inicioDaFila !== null
      ? <EstadoVazio bloco acao={<Link className="underline" href={inicioDaFila}>Ir para o início da fila</Link>}>Nenhuma matrícula a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio>
      : <EstadoVazio bloco>Nenhuma matrícula precisa de acompanhamento na continuidade mensal.</EstadoVazio>;
  }

  return <div className="space-y-3">
    {itens.map((item) => {
      const matriculaUrl = `/matriculas/${encodeURIComponent(item.matriculaId)}`;
      return <article key={item.matriculaId} className="space-y-2 rounded border p-4">
        <h2 className="font-medium">{item.codigo ?? "Matrícula"} · {item.alunoNome}</h2>
        <p><strong>{ESTADO_LABEL[item.estado]}</strong>{item.motivo ? ` · ${item.motivo}` : ""}</p>
        {item.cobertura && <p>Cobertura prevista: {formatarDataCivil(item.cobertura.inicio)} a {formatarDataCivil(item.cobertura.fim)}.</p>}
        {item.vencimento && <p>Vencimento previsto: {formatarDataCivil(item.vencimento)}.</p>}
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="underline" href={`${matriculaUrl}/continuidade-mensal`}>Condições de continuidade</Link>
          <Link className="underline" href={`${matriculaUrl}/disponibilidade-oferta`}>Confirmação de oferta</Link>
          <Link className="underline" href={`${matriculaUrl}/indisponibilidade-oferta`}>Indisponibilidades</Link>
        </nav>
      </article>;
    })}
  </div>;
}
