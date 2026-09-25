import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostaSubstituicao } from "@/server/contratos/substituicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarMoeda } from "@/lib/dinheiro";
import { TextoPrevia } from "../../TextoPrevia";
import { DecidirSubstituicao } from "../Formularios";
import { AndamentoSubstituicao } from "../Andamento";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PropostaPage({ params, searchParams }: { params: Promise<{ id: string; propostaId: string }>; searchParams: Promise<{ retornos?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id, propostaId } = await params;
  const numero = Number((await searchParams).retornos ?? 1);
  const paginaObservacoes = Number.isInteger(numero) && numero > 0 && numero <= 100000 ? numero : 1;
  const [r, preferencia] = await Promise.all([
    consultarPropostaSubstituicao({ matriculaId: id, propostaId, paginaObservacoes }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const data = (valor: Date | string) => `${formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)`;
  return <div className="space-y-5">
    <VoltarPara href={`/matriculas/${encodeURIComponent(id)}/contrato/substituicoes`} para="Propostas" />
    <h1 className="text-2xl">Proposta de substituição · versão {d.versao}</h1>
    <p>Preparada por {d.preparadaPor} em {data(d.criadaEm)}.</p>
    <p className="whitespace-pre-wrap">{d.motivo}</p>
    <AndamentoSubstituicao dados={d.andamento} matriculaId={id} propostaId={propostaId} preferenciaFusoExibicao={fusoExibicao} />
    {d.superada && <p role="status">Existe uma proposta mais recente. Esta versão pode ser consultada ou rejeitada, mas não aprovada.</p>}
    <div className="grid gap-5 xl:grid-cols-2">{[{ titulo: "Original enviado", ...d.fonte }, { titulo: "Documento substituto", ...d.substituto }].map(doc => <section key={doc.artefatoId} className="space-y-3">
      <h2 className="text-xl">{doc.titulo}</h2>
      <a className="underline" href={`/api/matriculas/${encodeURIComponent(id)}/originais/${encodeURIComponent(doc.artefatoId)}/pdf`} target="_blank" rel="noopener noreferrer">Abrir PDF preservado · {doc.titulo}</a>
      <TextoPrevia dados={doc.texto} />
      <section className="space-y-2 rounded border p-3"><h3 className="font-medium">Pessoas identificadas para assinatura</h3>
        <ul>{doc.assinatura.participantes.map(p => <li key={`${p.papel}:${p.etapa}`}>{p.nome} · {p.email} · {p.papel.replaceAll("_", " ")} · {p.etapa === "CLIENTE" ? "cliente" : "escola"}</li>)}</ul>
        <p>Taxa: {formatarMoeda(doc.assinatura.taxa.valor, doc.assinatura.taxa.moeda)}. {doc.assinatura.taxa.confirmada ? "Recebimento confirmado." : "Recebimento não confirmado."}</p>
        <p>{doc.assinatura.regraTaxa === "CONFIRMACAO_PREVIA_EXIGIDA" ? "Assinatura exige taxa confirmada previamente." : "Assinatura sem pagamento prévio da taxa."}</p>
        <p>Reserva na revisão: {doc.assinatura.reserva.status.replaceAll("_", " ")} · prazo {data(doc.assinatura.reserva.expiraEm)}.</p>
      </section>
    </section>)}</div>
    {d.decisao ? <section className="rounded border p-4"><h2 className="text-xl">{d.decisao.aprovada ? "Proposta aprovada" : "Proposta rejeitada"}</h2><p>{d.decisao.decisor.nome} · {data(d.decisao.decididaEm)}</p><p className="whitespace-pre-wrap">{d.decisao.motivo}</p></section>
      : d.podeDecidir ? <DecidirSubstituicao propostaId={d.id} propostaHash={d.propostaHash} superada={d.superada} /> : <p>A decisão exige outra pessoa da Administração.</p>}
    <p role="status">A integração operacional com o serviço de assinatura ainda não está habilitada. O andamento acima apresenta os fatos já preservados no ERP.</p>
  </div>;
}
