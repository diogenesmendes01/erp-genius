import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarRecuperacoesRealizadas } from "@/server/avaliacoes/recuperacao-consulta";
import { IdentificacaoAvaliacao } from "../avaliacoes/Identificacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function Recuperacoes({ searchParams }: { searchParams: Promise<{ alocacaoId?: string; depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId = "", depoisId } = await searchParams;
  const [r, preferencia] = await Promise.all([
    listarRecuperacoesRealizadas({ alocacaoId, depoisId }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-4">
    <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Avaliações da matrícula</Link>
    <h1 className="text-2xl font-medium">Notas de recuperação</h1>
    <IdentificacaoAvaliacao dados={r.dado.identificacao} />
    <p>Recuperações realizadas neste vínculo. Lançar a nota não dispensa a conferência independente.</p>
    {r.dado.realizacoes.map(item => <Link key={item.id} className="block rounded border p-3 underline" href={`/academico/recuperacoes/${encodeURIComponent(item.id)}`}>{item.habilidade.replaceAll("_", " ")} · {formatarInstanteExibicao(item.realizadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC) · {item.estado}</Link>)}
    {!r.dado.realizacoes.length && <EstadoVazio bloco>Nenhuma realização disponível nesta página.</EstadoVazio>}
    {r.dado.proximoId && <Link className="underline" href={`/academico/recuperacoes?${new URLSearchParams({ alocacaoId, depoisId: r.dado.proximoId })}`}>Próximas realizações</Link>}
  </section>;
}
