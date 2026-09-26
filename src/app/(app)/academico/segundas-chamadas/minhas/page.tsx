import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarSegundasChamadasDocente } from "@/server/avaliacoes/segunda-chamada-docente";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { EstadoVazio } from "@/components/EstadoVazio";


export default async function MinhasSegundasChamadas({ searchParams }: { searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { depoisId } = await searchParams;
  const [resultado, preferencia] = await Promise.all([listarSegundasChamadasDocente({ ...(depoisId ? { depoisId } : {}) }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;

  return <section className="space-y-4">
    <Link className="underline" href="/academico/avaliacoes">Avaliações</Link>
    <h1 className="text-2xl font-medium">Minhas segundas chamadas designadas</h1>
    <p>Esta fila mostra somente reservas de segunda chamada designadas a você. A designação não concede acesso amplo à turma.</p>
    {d.itens.map(item => <article key={item.reservaId} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{item.aluno} · {item.codigoAvaliacao}</h2>
      <p>Matrícula {item.matriculaCodigo ?? "sem código"} · {item.turma}.</p>
      {(() => { const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, item.fusoOrigem); return <p>Horário: {formatarInstanteExibicao(item.inicio, fuso, item.fusoOrigem).texto} a {formatarInstanteExibicao(item.fim, fuso, item.fusoOrigem).texto} ({fuso}; origem {item.fusoOrigem}).</p>; })()}
      <p>Situação: {item.status}.</p>
      <p>{item.realizacao ? `Realização registrada em ${formatarInstanteExibicao(item.realizacao.realizadaEm, resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC"), "UTC").texto}.` : item.podeRealizar ? "O registro será revalidado ao enviar: a data efetiva precisa pertencer ao encontro e o histórico e a autorização aplicável serão conferidos." : "A realização ainda não está disponível nas condições atuais."}</p>
      <Link className="underline" href={`/academico/segundas-chamadas/minhas/${encodeURIComponent(item.reservaId)}`}>Abrir segunda chamada designada</Link>
    </article>)}
    {!d.itens.length && <EstadoVazio bloco>Nenhuma segunda chamada designada está disponível.</EstadoVazio>}
    {d.proximoId && <Link className="block underline" href={`?${new URLSearchParams({ depoisId: d.proximoId })}`}>Próximas segundas chamadas</Link>}
  </section>;
}
