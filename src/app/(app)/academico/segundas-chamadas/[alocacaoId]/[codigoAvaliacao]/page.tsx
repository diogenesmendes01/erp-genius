import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { consultarSegundasChamadas } from "@/server/avaliacoes/segunda-chamada";
import { SegundaChamadaPainel } from "./SegundaChamadaPainel";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { STATUS_MATRICULA_LABEL, rotular } from "@/lib/labels";
export default async function SegundaChamadaPage({ params, searchParams }: { params: Promise<{ alocacaoId: string; codigoAvaliacao: string }>; searchParams: Promise<{ antesId?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigoAvaliacao } = await params, { antesId } = await searchParams;
  const [r, preferencia] = await Promise.all([consultarSegundasChamadas({ alocacaoId, codigoAvaliacao, antesId }), consultarPreferenciaFusoEquipe()]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const estado = r.dado.estado, fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, r.dado.fusoExibicao);
  const gestao = temPapel(usuario, Papel.GERENTE_PEDAGOGICO);
  const autorizacoes = `/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/autorizacoes`;
  const podePropor = estado.ativa && estado.statusMatricula === "ATIVA";
  // O formulário "Propor segunda chamada" sumia sem explicar quando a matrícula não estava ativa (docs/42 L1670;
  // docs/43 §6 item 7). No lugar dele: o motivo e o caminho — a autorização específica, que é da Gestão Pedagógica.
  const bloqueio = podePropor ? null : <div className="space-y-1 rounded border p-4">
    <h2 className="font-medium">Nova proposta indisponível</h2>
    <p>{!estado.ativa ? "O vínculo com a turma está inativo." : `A matrícula está ${rotular(STATUS_MATRICULA_LABEL, estado.statusMatricula).toLowerCase()}.`} Uma nova realização exige autorização específica.</p>
    {gestao ? <Link className="underline" href={autorizacoes}>Registrar a autorização específica</Link> : <p>Peça a autorização à Gestão Pedagógica.</p>}
  </div>;
  return <section className="space-y-4"><Link className="text-sm text-brand-700 underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Avaliações da matrícula</Link><h1 className="text-2xl font-medium">Segunda chamada · {codigoAvaliacao}</h1><p>A avaliação original continua pendente até a nota submetida e oficializada por outra pessoa. Não usa recuperação nem gera cobrança.</p><p role="status">Limite configurado: {estado.limiteBase}; extras aprovados: {estado.extrasAprovados}; reservas ou consumos: {estado.reservasOcupadas}; saldo atual: {estado.saldo}. Datas exibidas em {fusoExibicao}; origem {r.dado.fusoExibicao}.</p>{!estado.ativa && <p role="status">Vínculo inativo: histórico em leitura. Nova realização exige autorização específica.</p>}{gestao&&<><Link className="block underline" href={`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/historico`}>Histórico de reservas</Link><Link className="block underline" href={autorizacoes}>Autorizar e consultar realizações especiais</Link><Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/designacao`}>Designar professor para regularizar nota de avaliação já realizada</Link></>}<SegundaChamadaPainel alocacaoId={alocacaoId} codigoAvaliacao={codigoAvaliacao} itens={r.dado.itens} ativa={podePropor} bloqueio={bloqueio} fuso={fusoExibicao} fusoEntrada={r.dado.fusoExibicao} />{r.dado.proximoId && <Link className="underline" href={`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}?antesId=${encodeURIComponent(r.dado.proximoId)}`}>Propostas anteriores</Link>}</section>;
}
