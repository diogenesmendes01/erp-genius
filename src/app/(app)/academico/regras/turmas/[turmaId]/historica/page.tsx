import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConferenciasRegraHistorica, consultarPreparacaoConferenciaRegraHistorica } from "@/server/avaliacoes/conferencia-regra-historica";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { ResumoRegra, type ConteudoRegra } from "../../../[nivelId]/ResumoRegra";
import { DecidirConferenciaRegraHistorica, PrepararConferenciaRegraHistorica } from "./ConferenciaRegraHistorica";
import { EstadoVazio } from "@/components/EstadoVazio";

type Fotografia = {
  turma: { nome: string | null; codigo: string | null; status: string; dataInicio: string | null; dataFim: string | null };
  destino: { versao: number; conteudo: ConteudoRegra; conteudoHash: string };
  encontros: unknown[];
  diarios: unknown[];
  alocacoes: unknown[];
};

function foto(valor: unknown): Fotografia | null {
  if (!valor || typeof valor !== "object") return null;
  const registro = valor as Partial<Fotografia>;
  return registro.turma && registro.destino && Array.isArray(registro.encontros) && Array.isArray(registro.diarios) && Array.isArray(registro.alocacoes) ? registro as Fotografia : null;
}

function Registro({ item, preferenciaFusoExibicao }: {
  item: {
    versao: number; motivo: string; evidencia: string; criadaEm: Date; snapshot: unknown; preparador: { nome: string };
    decisao: { aprovada: boolean; motivo: string; criadaEm: Date; decisor: { nome: string } } | null;
    id: string; estadoHash: string; podeDecidir: boolean; podeAprovar: boolean;
  };
  preferenciaFusoExibicao: string | null;
}) {
  const fotografia = foto(item.snapshot);
  const fusoExibicao = resolverFusoExibicao(preferenciaFusoExibicao, "UTC");
  return <article className="space-y-3 rounded border p-4">
    <h3 className="text-lg font-medium">Conferência {item.versao} — {item.decisao ? (item.decisao.aprovada ? "Aplicada" : "Rejeitada") : "Aguardando decisão"}</h3>
    <p>Preparada por {item.preparador.nome} em {formatarInstanteExibicao(item.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p>
    <p className="whitespace-pre-wrap"><strong>Motivo:</strong> {item.motivo}</p>
    <p className="whitespace-pre-wrap"><strong>Evidência:</strong> {item.evidencia}</p>
    {fotografia ? <section className="space-y-2 rounded bg-gray-50 p-3">
      <h4 className="font-medium">Fotografia conferida</h4>
      <p>Turma {fotografia.turma.nome ?? fotografia.turma.codigo ?? "sem identificação"} · {fotografia.turma.status}; início {fotografia.turma.dataInicio ?? "não informado"}.</p>
      <p>Versão preservada: {fotografia.destino.versao}; {fotografia.encontros.length} encontros, {fotografia.diarios.length} diários e {fotografia.alocacoes.length} alocações no momento da proposta.</p>
      <ResumoRegra conteudo={fotografia.destino.conteudo} />
    </section> : <p role="alert">Fotografia histórica indisponível para apresentação.</p>}
    {item.decisao ? <p>Decisão de {item.decisao.decisor.nome} em {formatarInstanteExibicao(item.decisao.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC): {item.decisao.motivo}</p>
      : item.podeDecidir ? <DecidirConferenciaRegraHistorica propostaId={item.id} estadoHash={item.estadoHash} podeAprovar={item.podeAprovar} />
        : <p role="status">Outra pessoa autorizada precisa registrar a decisão.</p>}
  </article>;
}

export default async function ConferenciaRegraHistoricaPage({ params, searchParams }: { params: Promise<{ turmaId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { turmaId } = await params;
  const pagina = Number((await searchParams).pagina ?? 1);
  const [preparacao, historico, preferencia] = await Promise.all([
    consultarPreparacaoConferenciaRegraHistorica({ turmaId }),
    consultarConferenciasRegraHistorica({ turmaId, pagina: Number.isInteger(pagina) && pagina > 0 && pagina <= 100000 ? pagina : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!preparacao.ok || !preparacao.dado) return <p role="alert">{preparacao.ok ? "Preparação indisponível." : preparacao.erro}</p>;
  if (!historico.ok || !historico.dado) return <p role="alert">{historico.ok ? "Histórico indisponível." : historico.erro}</p>;
  const d = preparacao.dado;
  const h = historico.dado;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  return <section className="space-y-6">
    <nav className="flex gap-4"><Link className="underline" href="/configuracao/turmas">Turmas</Link><Link className="underline" href={`/academico/regras/${d.turma.nivelId}`}>Regras do nível</Link></nav>
    <h1 className="text-2xl font-medium">Conferência da regra histórica</h1>
    <p>{d.turma.nivel.idioma.nome} — {d.turma.nivel.codigo}. {d.turma.regraAvaliacaoId ? "A regra já foi vinculada; o histórico permanece disponível." : "A turma não possui regra vinculada."}</p>
    {d.pendencia ? <p role="status" className="rounded border p-3">{d.pendencia}</p> : <PrepararConferenciaRegraHistorica turmaId={turmaId} destinos={d.destinos.map(regra => ({ id: regra.id, versao: regra.versao }))} />}
    <section className="space-y-4"><h2 className="text-xl font-medium">Histórico de conferências</h2>{!h.itens.length ? <EstadoVazio>Nenhuma conferência registrada.</EstadoVazio> : h.itens.map(item => <Registro key={item.id} item={item} preferenciaFusoExibicao={preferenciaFusoExibicao} />)}</section>
    <nav aria-label="Páginas de conferências" className="flex gap-4">{h.pagina > 1 && <Link href={`?pagina=${h.pagina - 1}`}>Anterior</Link>}<span>Página {h.pagina}</span>{h.temProxima && <Link href={`?pagina=${h.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
