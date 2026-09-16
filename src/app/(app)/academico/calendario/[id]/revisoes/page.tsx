import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarHistoricoReplanejamento } from "@/server/agenda/replanejamento-historico";

export default async function RevisoesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, busca = await searchParams;
  const pagina = Number(busca.pagina ?? 1);
  const resultado = await consultarHistoricoReplanejamento({ calendarioId: id, pagina });
  if (!resultado.ok || !resultado.dado) return <div><Link href={`/academico/calendario/${id}`}>Voltar ao calendário</Link><p role="alert">{resultado.ok ? "Histórico indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  const data = (v: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: r.calendario.fusoInstitucional }).format(v);
  return <div className="space-y-4">
    <Link className="underline" href={`/academico/calendario/${id}`}>Voltar ao calendário</Link>
    <h1 className="text-2xl font-medium">Revisões registradas · Calendário {r.calendario.versao}</h1>
    <p>Histórico de autoria e motivos das revisões. Guardar uma revisão não publica mudanças. Horários em {r.calendario.fusoInstitucional}.</p>
    {!r.registros.length && <p>Nenhuma revisão nesta página.</p>}
    <ol className="space-y-3">{r.registros.map((v) => <li key={v.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium"><Link className="underline" href={`/academico/calendario/${id}/revisoes/${v.id}`}>Revisão {v.versao} · Consultar conteúdo</Link></h2><p>{v.preparador.nome} · {data(v.criadoEm)}</p>
      <p className="whitespace-pre-wrap">{v.motivo}</p>
    </li>)}</ol>
    <nav aria-label="Páginas das revisões" className="flex gap-4">
      {r.pagina > 1 && <Link className="underline" href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}
      {r.possuiMais && <Link className="underline" href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}
    </nav>
  </div>;
}
