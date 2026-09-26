import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarHistoricoReplanejamento } from "@/server/agenda/replanejamento-historico";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function RevisoesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, busca = await searchParams;
  const pagina = Number(busca.pagina ?? 1);
  const [resultado, preferencia] = await Promise.all([
    consultarHistoricoReplanejamento({ calendarioId: id, pagina }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <div><VoltarPara href={`/academico/calendario/${id}`} para="Calendário" /><p role="alert">{resultado.ok ? "Histórico indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, r.calendario.fusoInstitucional);
  const data = (v: Date) => formatarInstanteExibicao(v, fusoExibicao, r.calendario.fusoInstitucional).texto;
  return <div className="space-y-4">
    <VoltarPara href={`/academico/calendario/${id}`} para="Calendário" />
    <h1 className="text-2xl font-medium">Revisões registradas · Calendário {r.calendario.versao}</h1>
    <p>Histórico de autoria e motivos das revisões. Guardar uma revisão não publica mudanças. Instantes administrativos exibidos em {fusoExibicao}; origem {r.calendario.fusoInstitucional}.</p>
    {!r.registros.length && <EstadoVazio bloco>Nenhuma revisão nesta página.</EstadoVazio>}
    <ol className="space-y-3">{r.registros.map((v) => <li key={v.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium"><Link className="underline" href={`/academico/calendario/${id}/revisoes/${v.id}`}>Revisão {v.versao} · Consultar conteúdo</Link></h2><p>{v.preparador.nome} · {data(v.criadoEm)} ({fusoExibicao}; origem {r.calendario.fusoInstitucional})</p>
      <p className="whitespace-pre-wrap">{v.motivo}</p>
    </li>)}</ol>
    <nav aria-label="Páginas das revisões" className="flex gap-4">
      {r.pagina > 1 && <Link className="underline" href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}
      {r.possuiMais && <Link className="underline" href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}
    </nav>
  </div>;
}
