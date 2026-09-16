import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { consultarSegundasChamadas } from "@/server/avaliacoes/segunda-chamada";
import { SegundaChamadaPainel } from "./SegundaChamadaPainel";
export default async function SegundaChamadaPage({ params, searchParams }: { params: Promise<{ alocacaoId: string; codigoAvaliacao: string }>; searchParams: Promise<{ antesId?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigoAvaliacao } = await params, { antesId } = await searchParams;
  const r = await consultarSegundasChamadas({ alocacaoId, codigoAvaliacao, antesId });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const estado = r.dado.estado;
  return <section className="space-y-4"><Link className="text-sm text-brand-700 underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Avaliações da matrícula</Link><h1 className="text-2xl font-medium">Segunda chamada · {codigoAvaliacao}</h1><p>A avaliação original continua pendente até a nota submetida e oficializada por outra pessoa. Não usa recuperação nem gera cobrança.</p><p role="status">Limite configurado: {estado.limiteBase}; extras aprovados: {estado.extrasAprovados}; reservas ou consumos: {estado.reservasOcupadas}; saldo atual: {estado.saldo}. Datas exibidas em {r.dado.fusoExibicao}.</p>{!estado.ativa && <p role="status">Vínculo inativo: histórico em leitura. Nova realização exige autorização específica.</p>}{temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="block underline" href={`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/historico`}>Histórico de reservas</Link>}{temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="block underline" href={`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/autorizacoes`}>Autorizar e consultar realizações especiais</Link>}{temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}/designacao`}>Designar professor para regularizar nota de avaliação já realizada</Link>}<SegundaChamadaPainel alocacaoId={alocacaoId} codigoAvaliacao={codigoAvaliacao} itens={r.dado.itens} ativa={estado.ativa && estado.statusMatricula === "ATIVA"} fuso={r.dado.fusoExibicao} />{r.dado.proximoId && <Link className="underline" href={`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}?antesId=${encodeURIComponent(r.dado.proximoId)}`}>Propostas anteriores</Link>}</section>;
}


