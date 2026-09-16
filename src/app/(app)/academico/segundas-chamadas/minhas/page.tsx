import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarSegundasChamadasDocente } from "@/server/avaliacoes/segunda-chamada-docente";

const dataHoraUtc = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(valor));

export default async function MinhasSegundasChamadas({ searchParams }: { searchParams: Promise<{ depoisId?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { depoisId } = await searchParams;
  const resultado = await listarSegundasChamadasDocente({ ...(depoisId ? { depoisId } : {}) });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;

  return <section className="space-y-4">
    <Link className="underline" href="/academico/avaliacoes">Avaliações</Link>
    <h1 className="text-2xl font-medium">Minhas segundas chamadas designadas</h1>
    <p>Esta fila mostra somente reservas de segunda chamada designadas a você. A designação não concede acesso amplo à turma.</p>
    {d.itens.map(item => <article key={item.reservaId} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{item.aluno} · {item.codigoAvaliacao}</h2>
      <p>Matrícula {item.matriculaCodigo ?? "sem código"} · {item.turma}.</p>
      <p>Horário: {dataHoraUtc(item.inicio)} a {dataHoraUtc(item.fim)} (UTC).</p>
      <p>Situação: {item.status}.</p>
      <p>{item.realizacao ? `Realização registrada em ${dataHoraUtc(item.realizacao.realizadaEm)} (UTC).` : item.podeRealizar ? "O registro será revalidado ao enviar: a data efetiva precisa pertencer ao encontro e o histórico e a autorização aplicável serão conferidos." : "A realização ainda não está disponível nas condições atuais."}</p>
      <Link className="underline" href={`/academico/segundas-chamadas/minhas/${encodeURIComponent(item.reservaId)}`}>Abrir segunda chamada designada</Link>
    </article>)}
    {!d.itens.length && <p>Nenhuma segunda chamada designada está disponível.</p>}
    {d.proximoId && <Link className="block underline" href={`?${new URLSearchParams({ depoisId: d.proximoId })}`}>Próximas segundas chamadas</Link>}
  </section>;
}
