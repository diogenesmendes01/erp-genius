import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarTentativasRecuperacaoDesignadas } from "@/server/avaliacoes/recuperacao-fila-docente";
import { AgendaPublicada } from "../AgendaPublicada";
import { EstadoVazio } from "@/components/EstadoVazio";
import { HABILIDADE_LABEL, rotular } from "@/lib/labels";

export default async function Designadas({ searchParams }: { searchParams: Promise<{ depoisId?: string; modo?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { depoisId, modo } = await searchParams;
  const r = await listarTentativasRecuperacaoDesignadas({ depoisId, modo: modo === "historico" ? "historico" : "pendentes" });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/avaliacoes">Avaliações</Link>
    <h1 className="text-2xl font-medium">Minhas recuperações</h1>
    <nav aria-label="Recuperações do professor" className="flex gap-4"><Link className="underline" aria-current={r.dado.modo === "pendentes" ? "page" : undefined} href="?modo=pendentes">Atribuições pendentes</Link><Link className="underline" aria-current={r.dado.modo === "historico" ? "page" : undefined} href="?modo=historico">Meu histórico</Link></nav>
    <p>{r.dado.modo === "historico" ? "Avaliações que você realizou ou cujas notas registrou. Quando a atribuição termina, o acesso permanece em leitura." : "Tentativas pendentes com designação vigente. Acesso limitado à habilidade atribuída; a designação não transfere a turma."}</p>
    {r.dado.itens.map(i => <article key={i.id} className="space-y-2 rounded border p-4"><h2 className="font-medium">{i.aluno} — {rotular(HABILIDADE_LABEL, i.habilidade)}</h2><p>Matrícula {i.matriculaCodigo ?? i.matriculaId} · {i.turma ?? "Turma"} · nível {i.nivel}.</p>
      <AgendaPublicada agenda={i.agenda} />
      {r.dado!.modo === "historico" && i.realizacaoId ? <Link className="underline" href={`/academico/recuperacoes/${encodeURIComponent(i.realizacaoId)}`}>Consultar registros desta recuperação</Link> : <><p>{i.realizada ? "Realização registrada; nota ou conferência pendente." : "Realização ainda não registrada."}</p><Link className="underline" href={`/academico/recuperacoes/tentativas/${encodeURIComponent(i.id)}`}>Abrir tentativa atribuída</Link></>}
    </article>)}
    {!r.dado.itens.length && (depoisId
      ? <EstadoVazio bloco acao={<Link className="underline" href={`?${new URLSearchParams({ modo: r.dado.modo })}`}>Ir para a primeira página</Link>}>Nenhuma tentativa disponível nesta página.</EstadoVazio>
      : <EstadoVazio bloco>{r.dado.modo === "historico" ? "Nenhuma avaliação de recuperação no seu histórico." : "Nenhuma tentativa pendente atribuída a você."}</EstadoVazio>)}
    {r.dado.proximoId && <Link className="underline" href={`?${new URLSearchParams({ depoisId: r.dado.proximoId, modo: r.dado.modo })}`}>Próximas tentativas</Link>}
  </section>;
}
