import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarVinculosAvaliacoes } from "@/server/avaliacoes/painel";
import { nomeCompleto } from "@/lib/nome";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function PainelAvaliacoes({ searchParams }: { searchParams: Promise<{ modo?: string; pagina?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const s = await searchParams, p = Number(s.pagina ?? 1), modo = s.modo === "designadas" ? "designadas" : s.modo === "historico" ? "historico" : "atuais";
  const [r, preferencia] = await Promise.all([
    listarVinculosAvaliacoes({ modo, pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-5">
    <h1 className="text-2xl font-medium">Avaliações por matrícula</h1>
    {usuario.papeis.includes(Papel.PROFESSOR) && <Link className="block underline" href="/academico/recuperacoes/designadas">Minhas recuperações e histórico</Link>}
    {usuario.papeis.includes(Papel.PROFESSOR) && <Link className="block underline" href="/academico/segundas-chamadas/minhas">Minhas segundas chamadas designadas</Link>}
    <nav aria-label="Filtro de vínculos" className="flex gap-4"><Link aria-current={modo === "atuais" ? "page" : undefined} className="underline" href="/academico/avaliacoes">Vínculos atuais</Link><Link aria-current={modo === "historico" ? "page" : undefined} className="underline" href="?modo=historico">Histórico com lançamentos</Link><Link aria-current={modo === "designadas" ? "page" : undefined} className="underline" href="?modo=designadas">Avaliações designadas a mim</Link></nav>
    {modo === "designadas" && <p>Acesso às avaliações pendentes que a gestão atribuiu a você. A designação não transfere a turma.</p>}
    <p>{modo === "historico" ? "Inclui vínculos encerrados com registros acessíveis. Professores sem atribuição atual consultam somente o próprio histórico, em leitura." : "Escolha a matrícula e a turma para consultar as avaliações. Cada vínculo possui seu próprio contexto acadêmico."}</p>
    {!d.itens.length && <p>Nenhum vínculo disponível neste filtro.</p>}
    {d.itens.map(v => <article key={v.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{nomeCompleto(v.aluno)}</h2>
      <p>{v.matricula?.codigo ?? "Matrícula sem código"} · {v.turma.nivel.idioma.nome} {v.turma.nivel.codigo} · {v.turma.nome ?? v.turma.codigo ?? "Turma"}</p>
      <p>{v.ativa ? "Vínculo ativo" : "Vínculo encerrado"}{v.encerradaEm ? ` em ${formatarInstanteExibicao(v.encerradaEm, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)` : ""}.</p>
      <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(v.id)}`}>Consultar avaliações deste vínculo</Link>
    </article>)}
    <nav aria-label="Páginas de vínculos" className="flex gap-4">{d.pagina > 1 && <Link href={`?modo=${modo}&pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?modo=${modo}&pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
