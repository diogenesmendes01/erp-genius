import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarEncontrosDocente } from "@/server/agenda/encontros-docente";
import { VoltarPara } from "@/components/VoltarPara";
import { STATUS_ENCONTRO_LABEL } from "@/lib/labels";

export default async function EncontrosDocentePage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
  const { cursor } = await searchParams;
  const r = await consultarEncontrosDocente({ cursor });
  const rotulo = STATUS_ENCONTRO_LABEL;
  return <div className="space-y-4">
    <VoltarPara href="/diario" />
    <h1 className="text-2xl font-medium">Encontros atribuídos</h1>
    <p className="text-sm text-gray-500">Consulte os horários e o professor responsável por cada encontro.</p>
    {!r.ok && <p role="alert" className="text-red-700">{r.erro}</p>}
    {r.ok && r.dado?.encontros.length === 0 && <p>Nenhum encontro disponível.</p>}
    {r.ok && r.dado?.encontros.map((e) => {
      const data = (v: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: e.fusoExibicao }).format(new Date(v));
      return <article key={e.id} className="space-y-2 rounded border bg-[var(--surface)] p-4">
        <h2 className="font-medium">{e.turma} · {rotulo[e.status]}</h2>
        <p>{data(e.inicio)} — {data(e.fim)}</p><p className="text-sm">Exibido em {e.fusoExibicao}; origem {e.fusoOrigem} · {e.professor}</p>
        {e.particular && <Link href={`/diario/encontros/${e.id}/cancelamento`} className="block text-brand-700 underline">Cancelamento da particular</Link>}
        {e.atribuicaoPropria && (e.particular || e.status === "PREVISTO" && new Date(e.fim) <= new Date()) && <Link href={`/diario/encontros/${e.id}`} className="inline-block text-brand-700 underline">{e.particular ? "Diário e ocorrências" : "Abrir chamada"}</Link>}
      </article>;
    })}
    {r.ok && r.dado?.proximoCursor && <Link className="text-brand-700 underline" href={`/diario/encontros?cursor=${encodeURIComponent(r.dado.proximoCursor)}`}>Próximos encontros</Link>}
  </div>;
}

